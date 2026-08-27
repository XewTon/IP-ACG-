"""
玄策 · 数据导入中心（Plan C：全链路智能导入）

流程：上传原始内容（CSV/JSON/JSONL/TXT）→ GLM-4-Flash 分批整理（清洗/去重/分类/情感/角色归属/摘要）
     → 预览确认 → 分批写入目标表（community_feedback / xuanji_feed / character_daily_metrics）。

GLM-4-Flash 能力：免费、支持 JSON 输出、可分批并发调用。
本项目已配置 zhipu_config.json（model=glm-4-flash + apiKey），复用 ai.llm 统一接入。
无 key / 调用失败时降级为规则整理（_rule_analyze），保证管道始终可用。
"""
from __future__ import annotations

import csv
import io
import json
import re
from datetime import date
from pathlib import Path

from database import get_db

# 目标表 → 允许字段
TARGETS = {
    "community_feedback": ["platform", "user_name", "content", "sentiment", "role_type", "date"],
    "xuanji_feed": ["title", "url", "summary", "category", "score", "interview_value", "keyword"],
    "character_daily_metrics": ["character_id", "date", "discussions", "search_index", "fan_growth", "fanworks", "commercial_score"],
    "metrics": ["platform", "followers", "reads_views", "interactions", "recorded_at"],
    "follower_history": ["date", "platform", "followers"],
}

# 结构化数值目标：无需 GLM 文本整理，上传即可提交（跳过 analyze）
NO_ANALYZE_TARGETS = {"metrics", "follower_history", "character_daily_metrics"}

_POS = ("好", "爱", "绝", "赞", "喜欢", "期待", "好看", "支持", "燃", "神", "美", "强", "牛", "推荐", "顶")
_NEG = ("差", "难看", "弃", "失望", "烂", "退", "烦", "太慢", "拉", "崩", "水", "糊", "骗")
_CHAR_NAMES = ("盖聂", "天明", "少司命", "卫庄", "雪女", "韩非", "焰灵姬", "紫女",
               "武庚", "白菜", "唐三", "小舞", "比比东", "李景珑", "孔鸿俊",
               "罗峰", "李长寿", "霍雨浩", "唐舞桐")
_IP_KEYWORDS = {
    "秦时明月": ("秦时明月", "秦时", "明月", "百步飞剑", "沧海横流", "盖聂", "天明", "少司命", "卫庄", "雪女"),
    "天行九歌": ("天行九歌", "天行", "韩非", "焰灵姬", "紫女"),
    "武庚纪": ("武庚纪", "武庚", "白菜"),
    "斗罗大陆": ("斗罗大陆", "斗罗", "唐三", "小舞", "比比东", "绝世唐门", "霍雨浩", "唐舞桐"),
    "天宝伏妖录": ("天宝伏妖录", "天宝", "李景珑", "孔鸿俊"),
    "吞噬星空": ("吞噬星空", "吞噬", "罗峰"),
    "师兄啊师兄": ("师兄啊师兄", "师兄", "李长寿"),
    "牧神记": ("牧神记",),
    "天谕": ("天谕",),
}

SYSTEM_PROMPT = """你是玄机科技（国漫IP运营）的数据整理助手。把用户输入的原始文本逐条整理成结构化 JSON 数组，每项字段：
- content: 清洗后的正文（去多余空白、截断 300 字）
- sentiment: positive / neutral / negative（情感）
- role_type: 路人 / 角色党 / 美术党 / 剧情党（用户类型）
- ip_name: 命中哪个玄机 IP（秦时明月/天行九歌/武庚纪/斗罗大陆/天宝伏妖录/吞噬星空/师兄啊师兄/牧神记/天谕），未命中填 ""
- character_name: 命中哪个角色（盖聂/天明/少司命/卫庄/雪女/韩非/焰灵姬/紫女/唐三/小舞/比比东/武庚/白菜/李景珑/孔鸿俊/罗峰/李长寿/霍雨浩/唐舞桐），未命中填 ""
- summary: 20 字内摘要
只输出 JSON 数组，不要输出任何其他文字。"""


def _parse_file(filename: str, raw: bytes) -> list[dict]:
    """按扩展名解析上传文件 → 统一行列表 [{"content": str, "extra": {...}}]"""
    name = (filename or "").lower()
    text = raw.decode("utf-8", errors="replace")
    rows: list[dict] = []
    if name.endswith(".jsonl") or name.endswith(".ndjson"):
        for line in text.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                rows.append(_pick_text(obj))
            except Exception:
                rows.append({"content": line})
    elif name.endswith(".json"):
        try:
            data = json.loads(text)
            if isinstance(data, list):
                for obj in data:
                    rows.append(_pick_text(obj))
            elif isinstance(data, dict):
                rows.append(_pick_text(data))
        except Exception:
            rows.append({"content": text})
    elif name.endswith(".csv"):
        reader = csv.DictReader(io.StringIO(text))
        for row in reader:
            content = row.get("content") or row.get("正文") or row.get("text") or ""
            rows.append({"content": str(content).strip(), **row})
    else:  # txt / 其他
        for line in text.splitlines():
            line = line.strip()
            if line:
                rows.append({"content": line})
    return rows


def _pick_text(obj: dict) -> dict:
    content = (obj.get("content") or obj.get("desc") or obj.get("title")
               or obj.get("正文") or obj.get("text") or "")
    return {"content": str(content).strip(), **{k: v for k, v in obj.items() if k != "content"}}


def _rule_analyze(content: str) -> dict:
    """无 LLM key 降级：规则情感 + 角色/IP 归属（与 community._classify 同源）"""
    content = content.strip()[:300]
    if any(w in content for w in _NEG):
        sentiment = "negative"
    elif any(w in content for w in _POS):
        sentiment = "positive"
    else:
        sentiment = "neutral"
    role = "路人"
    if any(n in content for n in _CHAR_NAMES):
        role = "角色党"
    elif any(k in content for k in ("美术", "画风", "壁纸", "立绘", "原画")):
        role = "美术党"
    elif any(k in content for k in ("剧情", "世界观", "设定", "结局", "主线")):
        role = "剧情党"
    ip_name, char_name = "", ""
    for ipn, kws in _IP_KEYWORDS.items():
        if any(k in content for k in kws):
            ip_name = ipn
            for c in _CHAR_NAMES:
                if c in content:
                    char_name = c
                    break
            break
    return {
        "content": content, "sentiment": sentiment, "role_type": role,
        "ip_name": ip_name, "character_name": char_name,
        "summary": content[:20],
    }


def analyze_batch(items: list[dict], use_llm: bool = True, batch_size: int = 0) -> list[dict]:
    """分批整理：LLM（glm-4-flash，JSON 输出）或规则降级。返回结构化行列表。
    batch_size<=0 时自动缩放：>200 条用 50/批（减少调用次数），否则 20/批。"""
    from ai.llm import resolve_llm, llm_chat
    results: list[dict] = []
    cfg = resolve_llm()
    can_llm = use_llm and cfg is not None
    if batch_size <= 0:
        batch_size = 50 if len(items) > 200 else 20

    for start in range(0, len(items), batch_size):
        chunk = items[start:start + batch_size]
        texts = [r.get("content", "") for r in chunk]
        if can_llm:
            try:
                user_prompt = json.dumps(texts, ensure_ascii=False)
                content = llm_chat([
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ], temperature=0.2, timeout=90)
                # 容错解析：去掉 markdown 围栏 / 前缀文字
                m = re.search(r"\[[\s\S]*\]", content)
                parsed = json.loads(m.group(0)) if m else []
                if not isinstance(parsed, list):
                    parsed = []
                for i, row in enumerate(parsed[:len(chunk)]):
                    if isinstance(row, dict) and row.get("content"):
                        results.append(row)
                    else:
                        results.append(_rule_analyze(texts[i] if i < len(texts) else ""))
                # 批次缺行补齐
                if len(results) < len(chunk):
                    for i in range(len(results), len(chunk)):
                        results.append(_rule_analyze(texts[i] if i < len(texts) else ""))
                continue
            except Exception as e:
                print(f"[import] LLM batch failed ({start//batch_size}), fallback rules: {e}")
        for t in texts:
            results.append(_rule_analyze(t))
    return results


def _dedup_existing(cur, target: str) -> set[str]:
    """目标表已存在内容 hash（用于导入去重）"""
    seen: set[str] = set()
    if target == "community_feedback":
        for r in cur.execute("SELECT content, platform, user_name FROM community_feedback"):
            seen.add(hashlib_md5(f"{r['content']}|{r['platform']}|{r['user_name']}"))
    elif target == "xuanji_feed":
        for r in cur.execute("SELECT title FROM xuanji_feed"):
            seen.add(hashlib_md5(f"title|{r['title']}"))
    return seen


def hashlib_md5(s: str) -> str:
    import hashlib
    return hashlib.md5(s.encode("utf-8")).hexdigest()


def write_batch(cur, task_id: int, seq: int, rows: list[dict], target: str, seen: set[str]) -> dict:
    """写入一批到目标表（去重 + 来源标记 source='import'）。返回 {inserted, skipped, message}"""
    inserted = skipped = 0
    today = date.today().isoformat()

    if target == "community_feedback":
        for row in rows:
            content = str(row.get("content") or "").strip()[:300]
            if len(content) < 4:
                continue
            platform = str(row.get("platform") or "其他")[:20]
            uname = str(row.get("user_name") or "导入用户")[:20]
            key = hashlib_md5(f"{content}|{platform}|{uname}")
            if key in seen:
                skipped += 1
                continue
            cur.execute(
                """INSERT INTO community_feedback
                   (platform,user_name,content,sentiment,role_type,date,source,crawled_at)
                   VALUES (?,?,?,?,?,?,?,?)""",
                (platform, uname, content,
                 row.get("sentiment") or "neutral", row.get("role_type") or "路人",
                 row.get("date") or today, f"import:{task_id}", today))
            seen.add(key)
            inserted += 1

    elif target == "xuanji_feed":
        for row in rows:
            title = str(row.get("title") or row.get("content") or "").strip()[:120]
            if not title:
                continue
            key = hashlib_md5(f"title|{title}")
            if key in seen:
                skipped += 1
                continue
            cur.execute(
                """INSERT INTO xuanji_feed (fetch_date,keyword,category,title,url,summary,score,interview_value,raw_content)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (row.get("date") or today, row.get("keyword") or "导入", row.get("category") or "ip",
                 title, str(row.get("url") or "")[:500], str(row.get("summary") or "")[:300],
                 int(row.get("score") or 0), str(row.get("interview_value") or "")[:200],
                 json.dumps(row, ensure_ascii=False)[:2000]))
            seen.add(key)
            inserted += 1

    elif target == "metrics":
        # 平台快照导入：CSV 每行一个平台（platform/followers/reads_views/interactions/recorded_at）
        for row in rows:
            platform = str(row.get("platform") or row.get("平台") or "").strip()
            if not platform:
                continue
            pkey = platform
            if pkey in ("B站", "b站"):
                pkey = "bilibili"
            elif pkey in ("微博",):
                pkey = "weibo"
            elif pkey in ("小红书",):
                pkey = "xiaohongshu"
            elif pkey in ("公众号", "微信"):
                pkey = "wechat"
            rec_at = str(row.get("recorded_at") or row.get("日期") or today)
            cur.execute("SELECT id FROM metrics WHERE platform=? AND recorded_at=?", (pkey, rec_at))
            dup = cur.fetchone()
            if dup:
                skipped += 1
                continue
            # followers 缺省(0) 时沿用该平台已有最新粉丝，避免覆盖为 0
            followers = int(row.get("followers") or row.get("粉丝") or 0)
            if followers <= 0:
                cur.execute(
                    "SELECT followers FROM metrics WHERE platform=? ORDER BY recorded_at DESC LIMIT 1",
                    (pkey,))
                prev = cur.fetchone()
                if prev and prev["followers"]:
                    followers = prev["followers"]
            cur.execute(
                """INSERT INTO metrics (platform,followers,reads_views,interactions,engagement_rate,top_content,recorded_at,source)
                   VALUES (?,?,?,?,?,?,?,?)""",
                (pkey, followers,
                 int(row.get("reads_views") or row.get("播放") or row.get("阅读") or 0),
                 int(row.get("interactions") or row.get("互动") or 0),
                 float(row.get("engagement_rate") or 0), "[]", rec_at, f"import:{task_id}"))
            inserted += 1

    elif target == "follower_history":
        # 粉丝历史导入：CSV 每行 date/platform/followers
        for row in rows:
            d = str(row.get("date") or row.get("日期") or "").strip()
            platform = str(row.get("platform") or row.get("平台") or "").strip()
            if not d or not platform:
                continue
            pkey = platform
            if pkey in ("B站", "b站"):
                pkey = "bilibili"
            elif pkey in ("微博",):
                pkey = "weibo"
            elif pkey in ("小红书",):
                pkey = "xiaohongshu"
            elif pkey in ("公众号", "微信"):
                pkey = "wechat"
            cur.execute("SELECT id FROM follower_history WHERE date=? AND platform=?", (d, pkey))
            dup = cur.fetchone()
            if dup:
                skipped += 1
                continue
            cur.execute(
                "INSERT INTO follower_history (date,platform,followers,source) VALUES (?,?,?,?)",
                (d, pkey, int(row.get("followers") or row.get("粉丝") or 0), f"import:{task_id}"))
            inserted += 1

    elif target == "character_daily_metrics":
        for row in rows:
            cid = row.get("character_id")
            d = str(row.get("date") or today)
            if not cid or not d:
                continue
            cur.execute("SELECT id FROM characters WHERE id=?", (cid,))
            if not cur.fetchone():
                continue
            cur.execute(
                "SELECT id FROM character_daily_metrics WHERE character_id=? AND date=? AND source LIKE 'import%'",
                (cid, d))
            dup = cur.fetchone()
            if dup:
                skipped += 1
                continue
            cur.execute(
                """INSERT INTO character_daily_metrics
                   (character_id,date,search_index,discussions,fan_growth,fanworks,commercial_score,source)
                   VALUES (?,?,?,?,?,?,?,?)""",
                (cid, d, int(row.get("search_index") or 0), int(row.get("discussions") or 0),
                 int(row.get("fan_growth") or 0), int(row.get("fanworks") or 0),
                 float(row.get("commercial_score") or 0), f"import:{task_id}"))
            inserted += 1

    return {"inserted": inserted, "skipped": skipped, "message": f"批次{seq}: +{inserted} / 去重跳过 {skipped}"}


def create_task(name: str, source_type: str, target: str, rows: list[dict], model: str) -> int:
    conn = get_db(); cur = conn.cursor()
    cur.execute(
        """INSERT INTO import_tasks (name,source_type,target,status,total,model,payload)
           VALUES (?,?,?,?,?,?,?)""",
        (name, source_type, target, "pending", len(rows), model, json.dumps(rows, ensure_ascii=False)))
    tid = cur.lastrowid
    conn.commit(); conn.close()
    return tid


def get_task(tid: int) -> dict | None:
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT * FROM import_tasks WHERE id=?", (tid,))
    row = cur.fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    d["payload"] = json.loads(d.get("payload") or "[]")
    d["errors"] = json.loads(d.get("errors") or "[]")
    return d


def update_task(tid: int, **kw) -> None:
    conn = get_db(); cur = conn.cursor()
    cols = ", ".join(f"{k}=?" for k in kw)
    cur.execute(f"UPDATE import_tasks SET {cols} WHERE id=?", (*kw.values(), tid))
    conn.commit(); conn.close()


def list_tasks(limit: int = 50) -> list[dict]:
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT * FROM import_tasks ORDER BY id DESC LIMIT ?", (limit,))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    for r in rows:
        r["errors"] = json.loads(r.get("errors") or "[]")
    return rows


def log_batch(cur, task_id: int, seq: int, result: dict) -> None:
    cur.execute(
        """INSERT INTO import_batches (task_id,seq,status,inserted,skipped,message)
           VALUES (?,?,?,?,?,?)""",
        (task_id, seq, "done", result.get("inserted", 0), result.get("skipped", 0), result.get("message", "")))
