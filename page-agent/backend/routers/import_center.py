"""玄策 · 数据导入中心 API（Plan C：全链路智能导入）

上传原始内容（CSV/JSON/JSONL/TXT）→ GLM-4-Flash 分批整理 → 预览确认 → 分批入库 → 可回滚。
同时支持把 MediaCrawler 真实抓取数据一键导入（复用 community 的 jsonl 扫描）。
"""
import json
from datetime import date

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

from database import get_db
from services.import_center import (
    TARGETS, NO_ANALYZE_TARGETS, analyze_batch, create_task, get_task, list_tasks,
    update_task, log_batch, write_batch, _dedup_existing,
)

router = APIRouter(prefix="/api/import", tags=["import"])

BATCH_SIZE = 50


class AnalyzeBody(BaseModel):
    use_llm: bool = True


class CommitBody(BaseModel):
    batch_size: int = BATCH_SIZE


@router.get("/targets")
def targets():
    return {"data": [{"key": k, "fields": v} for k, v in TARGETS.items()]}


@router.get("/tasks")
def tasks(limit: int = 50):
    return {"data": list_tasks(limit)}


@router.get("/tasks/{task_id}")
def task_detail(task_id: int):
    t = get_task(task_id)
    if not t:
        raise HTTPException(404, "任务不存在")
    return t


@router.post("/upload")
async def upload(file: UploadFile = File(...), target: str = Form("community_feedback")):
    """上传原始文件 → 创建导入任务。
    文本类目标（社区反馈/速报）状态=pending，需 GLM 整理后提交；
    结构化目标（平台指标/粉丝历史/角色日指标）数据即所需格式，直接置 ready 可提交。"""
    if target not in TARGETS:
        raise HTTPException(400, f"目标表不支持：{target}")
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "文件为空")
    from services.import_center import _parse_file
    rows = _parse_file(file.filename or "", raw)
    if not rows:
        raise HTTPException(400, "未能从文件中解析出任何内容行")
    from ai.llm import resolve_llm
    cfg = resolve_llm()
    model = cfg["model"] if cfg else ""
    tid = create_task(file.filename or f"导入{date.today()}", "file", target, rows, model)
    no_analyze = target in NO_ANALYZE_TARGETS
    if no_analyze:
        update_task(tid, status="ready", processed=len(rows))
    return {"task_id": tid, "rows": len(rows), "target": target, "model": model,
            "status": "ready" if no_analyze else "pending",
            "message": f"已解析 {len(rows)} 行，创建任务 #{tid}" + ("（结构化数据，可直接提交）" if no_analyze else "（待 GLM 整理）")}


@router.post("/tasks/{task_id}/analyze")
def analyze(task_id: int, body: AnalyzeBody):
    """GLM-4-Flash 分批整理 → 状态 ready（含结构化 payload，可预览）"""
    t = get_task(task_id)
    if not t:
        raise HTTPException(404, "任务不存在")
    if t["status"] not in ("pending", "failed"):
        raise HTTPException(400, f"当前状态 {t['status']} 不允许重新整理（仅 pending/failed 可整理）")
    raw_rows = [r.get("content", "") if isinstance(r, dict) else str(r) for r in t["payload"]]
    items = [{"content": c} for c in raw_rows]
    update_task(task_id, status="analyzing", processed=0, errors="[]")
    try:
        structured = analyze_batch(items, use_llm=body.use_llm)
        update_task(task_id, status="ready", payload=json.dumps(structured, ensure_ascii=False),
                    processed=len(structured), model=t["model"] or "")
        return {"task_id": task_id, "status": "ready", "total": len(structured),
                "message": f"整理完成 {len(structured)} 条（模型：{t['model'] or '规则降级'}），可预览后提交"}
    except Exception as e:
        update_task(task_id, status="failed", errors=json.dumps([str(e)], ensure_ascii=False))
        raise HTTPException(500, f"整理失败：{e}")


@router.post("/tasks/{task_id}/commit")
def commit(task_id: int, body: CommitBody):
    """分批写入目标表（source='import:<task_id>'，可回滚）"""
    t = get_task(task_id)
    if not t:
        raise HTTPException(404, "任务不存在")
    if t["status"] != "ready":
        raise HTTPException(400, f"当前状态 {t['status']}，需先整理（analyze）且状态为 ready 才能提交")
    rows = t["payload"]
    target = t["target"]
    conn = get_db(); cur = conn.cursor()
    seen = _dedup_existing(cur, target)
    total_ins = total_skip = 0
    bs = max(1, min(body.batch_size, 200))
    update_task(task_id, status="committing")
    try:
        for i in range(0, len(rows), bs):
            chunk = rows[i:i + bs]
            result = write_batch(cur, task_id, i // bs + 1, chunk, target, seen)
            total_ins += result["inserted"]; total_skip += result["skipped"]
            log_batch(cur, task_id, i // bs + 1, result)
        conn.commit()
    except Exception as e:
        conn.rollback(); conn.close()
        update_task(task_id, status="failed", errors=json.dumps([str(e)], ensure_ascii=False))
        raise HTTPException(500, f"写入失败（已回滚本批次）：{e}")
    conn.close()
    update_task(task_id, status="done", succeeded=total_ins, failed=total_skip,
                finished_at=date.today().isoformat())
    return {"task_id": task_id, "status": "done", "inserted": total_ins, "skipped": total_skip,
            "message": f"入库完成：新增 {total_ins} 条，去重跳过 {total_skip} 条（来源 import:{task_id}）"}


@router.post("/tasks/{task_id}/rollback")
def rollback(task_id: int):
    """回滚：删除该任务写入的所有行（source='import:<task_id>'）"""
    t = get_task(task_id)
    if not t:
        raise HTTPException(404, "任务不存在")
    conn = get_db(); cur = conn.cursor()
    marker = f"import:{task_id}"
    deleted = 0
    if t["target"] == "community_feedback":
        cur.execute("DELETE FROM community_feedback WHERE source=?", (marker,))
    elif t["target"] == "xuanji_feed":
        cur.execute("DELETE FROM xuanji_feed WHERE keyword LIKE ?", ("导入%",))  # 导入行 keyword 前缀标记
        cur.execute("DELETE FROM xuanji_feed WHERE raw_content LIKE ?", (f'%{marker}%',))
    elif t["target"] == "character_daily_metrics":
        cur.execute("DELETE FROM character_daily_metrics WHERE source=?", (marker,))
    elif t["target"] == "metrics":
        cur.execute("DELETE FROM metrics WHERE source=?", (marker,))
    elif t["target"] == "follower_history":
        cur.execute("DELETE FROM follower_history WHERE source=?", (marker,))
    deleted = cur.rowcount
    conn.commit()
    cur.execute("DELETE FROM import_batches WHERE task_id=?", (task_id,))
    conn.commit(); conn.close()
    update_task(task_id, status="rolled_back")
    return {"task_id": task_id, "deleted": deleted, "message": f"已回滚，删除 {deleted} 行（来源 {marker}）"}


@router.post("/mediacrawler")
def import_mediacrawler(target: str = "community_feedback"):
    """一键导入 MediaCrawler 真实抓取数据 → 整理 → 入库（全链路自动）
    - community_feedback/xuanji_feed/character_daily_metrics：文本整理（大批量规则，小批量 GLM）
    - metrics：从 search_contents 聚合真实 B站播放量/评论数写入（无需 LLM）
    - follower_history：从 search_contents 聚合每日粉丝相关记录写入
    """
    if target not in TARGETS:
        raise HTTPException(400, f"目标表不支持：{target}")
    from routers.community import _iter_jsonl, _extract, _time_to_date, _CANON

    if target in ("metrics", "follower_history"):
        # ---- 播放量聚合模式：读 search_contents 真实 video_play_count/video_comment ----
        from collections import defaultdict
        agg = defaultdict(lambda: {"reads_views": 0, "interactions": 0, "count": 0})
        today = date.today().isoformat()
        for platform, item in _iter_jsonl(Path(__file__).resolve().parent.parent.parent.parent):
            if not isinstance(item, dict) or platform != "bilibili":
                continue
            play = 0
            try:
                play = int(item.get("video_play_count") or 0)
            except (ValueError, TypeError):
                pass
            comment = 0
            try:
                comment = int(item.get("video_comment") or 0)
            except (ValueError, TypeError):
                pass
            if play <= 0 and comment <= 0:
                continue
            agg["bilibili"]["reads_views"] += play
            agg["bilibili"]["interactions"] += comment
            agg["bilibili"]["count"] += 1
        if not agg:
            raise HTTPException(404, "未找到 MediaCrawler B站 search_contents 数据（含 video_play_count），请先抓取")
        rows = []
        if target == "metrics":
            rows = [{"platform": "bilibili", "followers": 0, "reads_views": agg["bilibili"]["reads_views"],
                     "interactions": agg["bilibili"]["interactions"], "recorded_at": today}]
        else:
            rows = [{"date": today, "platform": "bilibili", "followers": agg["bilibili"]["reads_views"]}]
        tid = create_task(f"MediaCrawler B站播放量 {today}", "mediacrawler", target, rows, "规则聚合")
        conn = get_db(); cur = conn.cursor()
        seen = _dedup_existing(cur, target)
        result = write_batch(cur, tid, 1, rows, target, seen)
        conn.commit(); conn.close()
        update_task(tid, status="done", succeeded=result["inserted"], failed=result["skipped"],
                    finished_at=today)
        return {"task_id": tid, "scanned": agg["bilibili"]["count"], "inserted": result["inserted"],
                "skipped": result["skipped"], "model": "规则聚合(video_play_count)",
                "message": f"聚合 {agg['bilibili']['count']} 条真实B站内容 → 播放 {agg['bilibili']['reads_views']:,} / 评论 {agg['bilibili']['interactions']:,} → 写入 {target}"}

    # ---- 文本整理模式 ----
    items: list[dict] = []
    for platform, item in _iter_jsonl(Path(__file__).resolve().parent.parent.parent.parent):
        if not isinstance(item, dict):
            continue
        content, nick, t = _extract(item)
        if not content or len(str(content).strip()) < 8:
            continue
        items.append({"content": str(content).strip()[:300], "platform": _CANON.get(platform, platform),
                      "user_name": str(nick)[:20], "date": _time_to_date(t)})
    if not items:
        raise HTTPException(404, "未找到 MediaCrawler 抓取数据（data/*/jsonl 为空），请先抓取")
    from ai.llm import resolve_llm
    cfg = resolve_llm()
    model = cfg["model"] if cfg else ""
    # 大批量规则整理（快），小批量 GLM 智能整理
    use_llm = len(items) <= 300
    tid = create_task(f"MediaCrawler 自动导入 {date.today()}", "mediacrawler", target, items, model if use_llm else "规则整理(大批量)")
    structured = analyze_batch(items, use_llm=use_llm)
    update_task(tid, status="ready", payload=json.dumps(structured, ensure_ascii=False), processed=len(structured))
    conn = get_db(); cur = conn.cursor()
    seen = _dedup_existing(cur, target)
    result = write_batch(cur, tid, 1, structured, target, seen)
    conn.commit(); conn.close()
    update_task(tid, status="done", succeeded=result["inserted"], failed=result["skipped"],
                finished_at=date.today().isoformat())
    return {"task_id": tid, "scanned": len(items), "inserted": result["inserted"],
            "skipped": result["skipped"], "model": model if use_llm else "规则整理(大批量)",
            "message": f"扫描 {len(items)} 条真实抓取 → {'GLM-4-Flash 整理' if use_llm else '规则整理(大批量)'} → 入库 {result['inserted']} 条（去重跳过 {result['skipped']}）"}


from pathlib import Path
