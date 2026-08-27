"""玄策 · 动态知识库 API —— 定时抓取 + LLM分析 + 前端展示"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from datetime import date
from database import get_db
from services.news_fetcher import run_fetch, read_zhipu_config, write_zhipu_config

router = APIRouter(prefix="/api/news", tags=["news"])


class ConfigBody(BaseModel):
    keyword: str
    category: str = "ip"
    enabled: int = 1


class ZhipuBody(BaseModel):
    apiKey: str = ""
    model: str = "glm-4.5"


# ─── 关键词配置 ───
@router.get("/config")
def get_config():
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT * FROM xuanji_news_config ORDER BY id")
    keywords = [dict(r) for r in cur.fetchall()]
    zc = read_zhipu_config()
    conn.close()
    return {"keywords": keywords, "zhipu": {"configured": bool(zc.get("apiKey")), "model": zc.get("model", "glm-4.5")}}


@router.post("/config")
def add_keyword(body: ConfigBody):
    conn = get_db(); cur = conn.cursor()
    cur.execute("INSERT INTO xuanji_news_config (keyword,category,enabled) VALUES (?,?,?)",
        (body.keyword, body.category, body.enabled))
    conn.commit(); conn.close()
    return {"message": "关键词已添加"}


@router.delete("/config/{kid}")
def delete_keyword(kid: int):
    conn = get_db(); cur = conn.cursor()
    cur.execute("DELETE FROM xuanji_news_config WHERE id=?", (kid,))
    conn.commit(); conn.close()
    return {"message": "关键词已删除"}


@router.post("/zhipu")
def save_zhipu(body: ZhipuBody):
    write_zhipu_config({"apiKey": body.apiKey.strip(), "model": body.model})
    return {"configured": True, "message": "智谱配置已保存"}


@router.delete("/zhipu")
def clear_zhipu():
    write_zhipu_config({"apiKey": "", "model": "glm-4.5"})
    return {"configured": False}


def _norm_title(title: str) -> str:
    """标题归一化：去空白/标点，用于去重比对"""
    return "".join(ch for ch in title if ch.strip()).lower()[:40]


# ─── 抓取 ───
@router.post("/fetch")
def fetch_now(keyword: Optional[str] = Query(None)):
    """手动触发抓取。指定 keyword 抓单个，否则抓所有启用的关键词。
    去重规则：
    1. 同一批内同标题 → 只保留分数最高的一条（跨关键词）
    2. 库里已存在的标题 → 跳过（历史去重）
    """
    conn = get_db(); cur = conn.cursor()
    if keyword:
        keywords = [{"keyword": keyword}]
    else:
        cur.execute("SELECT keyword FROM xuanji_news_config WHERE enabled=1")
        keywords = [dict(r) for r in cur.fetchall()]
        if not keywords:
            # 默认关键词（与 pipeline/config.py SEARCH_KEYWORDS 一致）
            keywords = [{"keyword": k} for k in [
                "玄机科技", "玄机科技 IPO", "玄机科技 北交所", "玄机科技 问询",
                "秦时明月", "天行九歌 真人剧", "武庚纪", "斗罗大陆 动画",
                "吞噬星空 动画", "牧神记 动画",
            ]]

    # 1. 收集所有原始条目（单关键词失败不拖垮全批）
    raw_items = []
    kw_errors = []
    for kw in keywords:
        try:
            result = run_fetch(kw["keyword"])
            for item in result["items"]:
                raw_items.append({"keyword": kw["keyword"], **item})
        except Exception as e:
            kw_errors.append(f"{kw['keyword']}: {e}")
            print(f"[news] fetch failed for {kw['keyword']}: {e}")

    # 2. 内存去重：同标题保留最高分，最高分相同时保留第一个关键词
    best_by_title: dict[str, dict] = {}
    for it in raw_items:
        key = _norm_title(it.get("title", ""))
        if not key:
            continue
        if key not in best_by_title or it.get("score", 0) > best_by_title[key].get("score", 0):
            best_by_title[key] = it

    # 3. 历史去重：跳过库里已有的标题
    cur.execute("SELECT title FROM xuanji_feed")
    existing = {_norm_title(r["title"]) for r in cur.fetchall()}

    inserted = 0
    skipped_dup = 0
    skipped_mock = 0
    for it in best_by_title.values():
        # 降级 mock 数据（example.com 假链接）不写库，避免假新闻混入真实看板
        if "example.com" in str(it.get("url", "")) or "example.com" in str(it.get("title", "")):
            skipped_mock += 1
            continue
        if _norm_title(it.get("title", "")) in existing:
            skipped_dup += 1
            continue
        cur.execute(
            """INSERT INTO xuanji_feed (fetch_date, keyword, category, title, url, summary, score, interview_value, raw_content)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (date.today().isoformat(), it["keyword"], it.get("category", "ip"),
             it.get("title", ""), it.get("url", ""), it.get("summary", ""),
             it.get("score", 0), it.get("interview_value", ""),
             it.get("content", "")),
        )
        inserted += 1
        existing.add(_norm_title(it.get("title", "")))
    conn.commit()
    conn.close()
    msg = f"抓取完成：新增 {inserted} 条，去重跳过 {skipped_dup} 条，跳过演示数据 {skipped_mock} 条"
    if kw_errors:
        msg += f"；失败关键词 {len(kw_errors)} 个（{'; '.join(kw_errors[:3])}）"
    return {
        "message": msg,
        "count": inserted, "skipped_dup": skipped_dup, "skipped_mock": skipped_mock,
        "errors": kw_errors,
    }


# ─── 抓取结果（分页） ───
@router.get("/feed")
def list_feed(date_: Optional[str] = Query(None, alias="date"),
              keyword: Optional[str] = Query(None),
              category: Optional[str] = Query(None),
              min_score: int = Query(0, ge=0, le=5),
              page: int = Query(1, ge=1),
              page_size: int = Query(20, ge=1, le=100)):
    conn = get_db(); cur = conn.cursor()
    q = "FROM xuanji_feed WHERE 1=1"
    params = []
    if date_:
        q += " AND fetch_date=?"; params.append(date_)
    if keyword:
        q += " AND keyword=?"; params.append(keyword)
    if category:
        q += " AND category=?"; params.append(category)
    if min_score > 0:
        q += " AND score>=?"; params.append(min_score)

    cur.execute(f"SELECT COUNT(*) AS c {q}", params)
    total = cur.fetchone()["c"]

    q += " ORDER BY fetch_date DESC, score DESC LIMIT ? OFFSET ?"
    offset = (page - 1) * page_size
    cur.execute(f"SELECT * {q}", [*params, page_size, offset])
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return {
        "data": rows, "total": total,
        "page": page, "page_size": page_size,
        "pages": max(1, -(-total // page_size)) if page_size else 1,
    }


@router.delete("/feed/{fid}")
def delete_feed(fid: int):
    conn = get_db(); cur = conn.cursor()
    cur.execute("DELETE FROM xuanji_feed WHERE id=?", (fid,))
    conn.commit(); conn.close()
    return {"message": "已删除"}
