"""玄策 · 社区运营 CRUD API + MediaCrawler 真实抓取数据同步"""
import sqlite3
import glob
from datetime import date
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_db

router = APIRouter(prefix="/api/community", tags=["community"])

class FeedbackBody(BaseModel):
    platform: str; user_name: str; content: str; sentiment: str = "neutral"; role_type: str = ""; date: str = ""

class EventBody(BaseModel):
    title: str; level: str = "green"; action: str = ""; date: str = ""

class PersonaBody(BaseModel):
    type: str; pct: int = 0; desc: str = ""; action: str = ""

@router.get("/feedback/stats")
def feedback_stats():
    """社区反馈分类统计：平台 / 情感 / 角色类型 各维度计数（支撑前端分类 Tab 角标）"""
    conn = get_db(); cur = conn.cursor()

    def _counts(col: str) -> dict[str, int]:
        expr = _CANON_SQL if col == "platform" else col
        cur.execute(f"SELECT {expr} AS k, COUNT(*) AS c FROM community_feedback GROUP BY {expr}")
        return {str(r["k"] or "未分类"): r["c"] for r in cur.fetchall()}

    cur.execute("SELECT COUNT(*) AS c FROM community_feedback")
    total = cur.fetchone()["c"]
    stats = {
        "total": total,
        "platform": _counts("platform"),
        "sentiment": _counts("sentiment"),
        "role_type": _counts("role_type"),
    }
    conn.close()
    return stats


@router.get("/feedback")
def list_feedback(
    platform: str = "",
    sentiment: str = "",
    role_type: str = "",
    limit: int = 50,
    offset: int = 0,
):
    """社区反馈列表：支持平台/情感/角色类型筛选 + 服务端分页（数据量大时避免一次全量加载）"""
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    where, args = [], []
    if platform:
        where.append(f"({_CANON_SQL})=?"); args.append(_CANON.get(platform, platform))
    if sentiment:
        where.append("sentiment=?"); args.append(sentiment)
    if role_type:
        where.append("role_type=?"); args.append(role_type)
    cond = (" WHERE " + " AND ".join(where)) if where else ""

    conn = get_db(); cur = conn.cursor()
    cur.execute(f"SELECT COUNT(*) AS c FROM community_feedback{cond}", args)
    total = cur.fetchone()["c"]
    cur.execute(
        f"SELECT * FROM community_feedback{cond} ORDER BY date DESC, id DESC LIMIT ? OFFSET ?",
        args + [limit, offset],
    )
    rows = [dict(r) for r in cur.fetchall()]; conn.close()
    for r in rows:
        r["platform"] = _CANON.get(r["platform"], r["platform"])
    return {"data": rows, "total": total, "limit": limit, "offset": offset}

@router.post("/feedback")
def create_feedback(body: FeedbackBody):
    conn = get_db(); cur = conn.cursor()
    cur.execute("INSERT INTO community_feedback (platform,user_name,content,sentiment,role_type,date) VALUES (?,?,?,?,?,?)",
        (body.platform, body.user_name, body.content, body.sentiment, body.role_type, body.date or ""))
    fid = cur.lastrowid; conn.commit(); conn.close()
    return {"id": fid, "message": "反馈已添加"}

@router.delete("/feedback/{fid}")
def delete_feedback(fid: int):
    conn = get_db(); cur = conn.cursor()
    cur.execute("DELETE FROM community_feedback WHERE id=?", (fid,)); conn.commit(); conn.close()
    return {"message": "已删除"}

@router.get("/events")
def list_events():
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT * FROM community_events ORDER BY date DESC"); rows = [dict(r) for r in cur.fetchall()]; conn.close()
    return {"data": rows}

@router.post("/events")
def create_event(body: EventBody):
    conn = get_db(); cur = conn.cursor()
    cur.execute("INSERT INTO community_events (date,title,level,action) VALUES (?,?,?,?)",
        (body.date, body.title, body.level, body.action))
    eid = cur.lastrowid; conn.commit(); conn.close()
    return {"id": eid, "message": "事件已添加"}

@router.delete("/events/{eid}")
def delete_event(eid: int):
    conn = get_db(); cur = conn.cursor()
    cur.execute("DELETE FROM community_events WHERE id=?", (eid,)); conn.commit(); conn.close()
    return {"message": "已删除"}

@router.get("/personas")
def list_personas():
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT * FROM user_personas ORDER BY id"); rows = [dict(r) for r in cur.fetchall()]; conn.close()
    return {"data": rows}

@router.put("/personas/{pid}")
def update_persona(pid: int, body: PersonaBody):
    conn = get_db(); cur = conn.cursor()
    cur.execute("UPDATE user_personas SET type=?,pct=?,description=?,action=? WHERE id=?",
        (body.type, body.pct, body.desc, body.action, pid))
    conn.commit(); conn.close()
    return {"message": "画像已更新"}


# ==================== MediaCrawler 真实抓取数据同步 ====================
_CHAR_NAMES = ("盖聂", "天明", "少司命", "卫庄", "雪女", "韩非", "焰灵姬", "紫女",
               "武庚", "白菜", "唐三", "小舞", "比比东", "李景珑", "孔鸿俊",
               "罗峰", "李长寿", "霍雨浩", "唐舞桐")
_POS = ("好", "爱", "绝", "赞", "喜欢", "期待", "好看", "支持", "燃", "神", "美", "强", "牛")
_NEG = ("差", "难看", "弃", "失望", "烂", "退", "烦", "太慢", "拉", "崩", "水")


def _classify(content: str) -> tuple[str, str]:
    """规则情感 + 用户角色分类（无 LLM key 时的轻量降级）"""
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
    return sentiment, role


def _ensure_columns(conn, cur) -> None:
    """community_feedback 补充 source / crawled_at 列（幂等）"""
    cols = [r["name"] for r in cur.execute("PRAGMA table_info(community_feedback)").fetchall()]
    if "source" not in cols:
        cur.execute("ALTER TABLE community_feedback ADD COLUMN source TEXT DEFAULT ''")
    if "crawled_at" not in cols:
        cur.execute("ALTER TABLE community_feedback ADD COLUMN crawled_at TEXT DEFAULT ''")
    conn.commit()


# ---- MediaCrawler 抓取数据源：sqlite 库 + jsonl 文件（默认 SAVE_DATA_OPTION=jsonl） ----
_PLATFORM_MAP = {
    "bili": "bilibili", "bilibili": "bilibili", "weibo": "weibo", "xhs": "xiaohongshu",
    "xiaohongshu": "xiaohongshu", "tieba": "tieba", "zhihu": "zhihu",
    "douyin": "douyin", "kuaishou": "kuaishou",
}

# 平台名归一化：抓取侧英文名 → 运营侧中文名（与手工登记口径一致，保证分类统计不分裂）
_CANON = {
    "bilibili": "B站", "weibo": "微博", "xiaohongshu": "小红书",
    "wechat": "公众号", "weixin": "公众号", "tieba": "贴吧",
    "zhihu": "知乎", "douyin": "抖音", "kuaishou": "快手",
    "other": "其他",
}

# 读取侧同样归一化（兼容历史已入库的英文平台名）
_CANON_SQL = """CASE platform
  WHEN 'bilibili' THEN 'B站' WHEN 'weibo' THEN '微博' WHEN 'xiaohongshu' THEN '小红书'
  WHEN 'wechat' THEN '公众号' WHEN 'weixin' THEN '公众号' WHEN 'tieba' THEN '贴吧'
  WHEN 'zhihu' THEN '知乎' WHEN 'douyin' THEN '抖音' WHEN 'kuaishou' THEN '快手'
  ELSE platform END"""


def _find_crawler_db(repo: Path) -> Path | None:
    candidates = [repo / "MediaCrawler" / "database" / "sqlite_tables.db"]
    candidates += [Path(p) for p in glob.glob(str(repo / "MediaCrawler" / "**" / "*.db"), recursive=True)]
    return next((p for p in candidates if p.exists()), None)


def _iter_jsonl(repo: Path):
    """遍历 MediaCrawler/data/<platform>/jsonl/*.jsonl 的每一行 dict"""
    import json as _json
    files = glob.glob(str(repo / "MediaCrawler" / "data" / "**" / "jsonl" / "*.jsonl"), recursive=True)
    for fp in files:
        parts = Path(fp).parts
        platform = next((_PLATFORM_MAP[p] for p in reversed(parts) if p in _PLATFORM_MAP), "other")
        try:
            with open(fp, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        item = _json.loads(line)
                    except Exception:
                        continue
                    yield platform, item
        except Exception:
            continue


def _pick(item: dict, *keys):
    for k in keys:
        v = item.get(k)
        if v not in (None, ""):
            return v
    return ""


def _extract(item: dict):
    """从抓取 dict 中提取 (内容, 昵称, 时间) —— 兼容各平台字段名"""
    content = _pick(item, "content", "desc", "title", "content_text")
    nick = _pick(item, "nickname", "user_nickname", "user_name")
    t = _pick(item, "create_time", "time", "publish_time", "create_date_time", "created_time", "pub_ts")
    return str(content or ""), str(nick or "采集用户")[:20], t


def _time_to_date(t) -> str:
    from datetime import date
    if not t:
        return date.today().isoformat()
    s = str(t)
    try:
        num = int(s)
        if num > 10**12:
            return date.fromtimestamp(num / 1000).isoformat()
        if num > 10**9:
            return date.fromtimestamp(num).isoformat()
    except (ValueError, TypeError, OverflowError):
        pass
    return s[:10] if len(s) >= 10 else date.today().isoformat()


@router.post("/sync-crawler")
def sync_crawler():
    """读取 MediaCrawler 抓取数据（sqlite 库 或 data/*/jsonl 文件），导入社区反馈池（source=crawler）"""
    repo = Path(__file__).resolve().parent.parent.parent.parent  # 仓库根
    db_path = _find_crawler_db(repo)

    conn = get_db(); cur = conn.cursor()
    _ensure_columns(conn, cur)
    today = date.today().isoformat()

    # 已存在内容去重（整行 hash，避免前120字截断导致真实数据误丢）
    import hashlib
    cur.execute("SELECT content, platform, user_name FROM community_feedback WHERE source='crawler'")
    seen = set()
    for r in cur.fetchall():
        key = hashlib.md5(f"{r['content']}|{r['platform']}|{r['user_name']}".encode("utf-8")).hexdigest()
        seen.add(key)

    imported = 0
    per_platform = {}
    sync_errors: list[str] = []

    def _add(platform: str, content: str, nick: str, t) -> None:
        nonlocal imported
        platform = _CANON.get(platform, platform)  # 入库即归一化平台名（bilibili→B站 等）
        content = content.strip()
        if len(content) < 8:
            return
        content = content[:300]
        key = hashlib.md5(f"{content}|{platform}|{nick}".encode("utf-8")).hexdigest()
        if key in seen:
            return
        sentiment, role = _classify(content)
        cur.execute(
            """INSERT INTO community_feedback (platform,user_name,content,sentiment,role_type,date,source,crawled_at)
               VALUES (?,?,?,?,?,?,?,?)""",
            (platform, nick, content, sentiment, role, _time_to_date(t), "crawler", today),
        )
        seen.add(key)
        imported += 1
        per_platform[platform] = per_platform.get(platform, 0) + 1

    # 1) sqlite 库
    if db_path:
        try:
            s = sqlite3.connect(str(db_path))
            s.row_factory = sqlite3.Row
            tables_meta = [
                ("bilibili_video", "bilibili", "nickname", "desc", "create_time"),
                ("bilibili_video_comment", "bilibili", "nickname", "content", "create_time"),
                ("weibo_note", "weibo", "nickname", "content", "create_time"),
                ("weibo_note_comment", "weibo", "nickname", "content", "create_time"),
                ("xhs_note", "xiaohongshu", "nickname", "desc", "time"),
                ("xhs_note_comment", "xiaohongshu", "nickname", "content", "create_time"),
                ("tieba_note", "tieba", "user_nickname", "desc", "publish_time"),
                ("tieba_comment", "tieba", "user_nickname", "content", "publish_time"),
                ("zhihu_content", "zhihu", "user_nickname", "desc", "created_time"),
                ("zhihu_comment", "zhihu", "user_nickname", "content", "publish_time"),
                ("douyin_aweme", "douyin", "nickname", "desc", "create_time"),
                ("douyin_aweme_comment", "douyin", "nickname", "content", "create_time"),
            ]
            for table, platform, nick_col, content_col, time_col in tables_meta:
                try:
                    rows = s.execute(f'SELECT * FROM "{table}" ORDER BY rowid DESC LIMIT 500').fetchall()
                except sqlite3.OperationalError:
                    continue
                for r in rows:
                    _add(platform, str(r[content_col] or ""), str(r[nick_col] or "采集用户")[:20], r[time_col])
            s.close()
        except Exception as e:
            sync_errors.append(f"sqlite 导入失败: {e}")
            print(f"[community] sqlite sync failed: {e}")

    # 2) jsonl 文件（默认存储格式）
    jsonl_count = 0
    for platform, item in _iter_jsonl(repo):
        if not isinstance(item, dict):
            continue
        jsonl_count += 1
        content, nick, t = _extract(item)
        _add(platform, content, nick, t)

    conn.commit()
    cur.execute("SELECT * FROM community_feedback WHERE source='crawler' ORDER BY date DESC LIMIT 200")
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()

    if db_path or jsonl_count:
        msg = f"同步完成：新增 {imported} 条抓取数据" if imported else "无新增（已同步过或库中无内容）"
        if sync_errors:
            msg += f"；注意：{sync_errors[0]}"
        return {
            "data": rows, "db_found": bool(db_path), "jsonl_files": jsonl_count,
            "imported": imported, "per_platform": per_platform,
            "message": msg, "errors": sync_errors,
        }
    return {
        "data": [], "db_found": False, "jsonl_files": 0, "imported": 0,
        "message": "未找到 MediaCrawler 抓取数据（无 sqlite 库、无 data/*/jsonl 文件）。请先在「数据采集」页运行一次抓取（cookie 就绪后），再回来同步。",
    }


@router.get("/crawler-status")
def crawler_status():
    """MediaCrawler 抓取数据状态（sqlite 库 / jsonl 文件是否存在及规模）"""
    repo = Path(__file__).resolve().parent.parent.parent.parent
    db_path = _find_crawler_db(repo)
    jsonl_files = glob.glob(str(repo / "MediaCrawler" / "data" / "**" / "jsonl" / "*.jsonl"), recursive=True)
    result = {
        "db_found": bool(db_path),
        "jsonl_files": len(jsonl_files),
        "message": "MediaCrawler 服务未运行或尚未抓取任何数据（先到「数据采集」页抓取）",
    }
    if db_path:
        try:
            s = sqlite3.connect(str(db_path))
            tables = [r[0] for r in s.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
            counts = {}
            for t in tables:
                try:
                    counts[t] = s.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
                except sqlite3.OperationalError:
                    pass
            s.close()
            result["tables"] = counts
            result["message"] = "发现 MediaCrawler sqlite 抓取库"
        except Exception as e:
            result["error"] = str(e)
    elif jsonl_files:
        result["message"] = f"发现 MediaCrawler jsonl 抓取文件 {len(jsonl_files)} 个（data/*/jsonl）"
    return result
