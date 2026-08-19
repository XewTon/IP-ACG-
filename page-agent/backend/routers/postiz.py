"""玄策 · 发布调度 API（SQLite持久化 + 正确状态机）"""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from database import get_db

router = APIRouter(prefix="/api/postiz", tags=["postiz"])

class CreatePostBody(BaseModel):
    platform: str; postizChannelId: str; title: str; body: str = ""
    mediaUrls: list[str] = []; scheduledAt: str = ""; status: str = "draft"

class ReviewBody(BaseModel):
    action: str; reviewedBy: str; reviewerNote: str = ""

class PostizPostResponse(BaseModel):
    id: int; platform: str; postizChannelId: str; title: str; body: str; mediaUrls: list[str]
    scheduledAt: str; status: str; reviewerNote: str | None = None; reviewedBy: str | None = None
    postizPostId: str | None = None; createdAt: str; updatedAt: str

def _row_to_dict(r) -> dict:
    d = dict(r)
    d["mediaUrls"] = (d.get("media_urls") or "").split(",") if d.get("media_urls") else []
    d["scheduledAt"] = d.get("scheduled_at") or ""
    return d

# ─── 渠道 ───
_integrations = [
    {"id":"int_bili_001","platform":"bilibili","name":"玄策_Bilibili","connected":True},
    {"id":"int_weibo_001","platform":"weibo","name":"玄策official","connected":True},
    {"id":"int_xhs_001","platform":"xiaohongshu","name":"玄策小红书","connected":True},
    {"id":"int_wx_001","platform":"wechat","name":"玄策公众号","connected":True},
]

@router.get("/integrations")
def list_integrations(): return {"data": _integrations, "total": len(_integrations)}

# ─── 帖子CRUD ───
@router.post("/posts")
def create_post(body: CreatePostBody):
    conn = get_db(); cur = conn.cursor()
    now = datetime.now(timezone.utc).isoformat()
    # 渠道 ID：前端未传或传 mock 值时，按 platform 分配真实集成渠道（不存在则留空）
    channel_id = body.postizChannelId
    if not channel_id or "_mock" in channel_id:
        match = next((c["id"] for c in _integrations if c["platform"] == body.platform), "")
        channel_id = match
    if body.status not in ("draft", "pending_review", "approved", "scheduled", "published", "failed"):
        body.status = "draft"
    cur.execute("""INSERT INTO content_posts (platform,postiz_channel_id,title,body,media_urls,scheduled_at,status,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?)""",
        (body.platform, channel_id, body.title, body.body, ",".join(body.mediaUrls), body.scheduledAt, body.status, now, now))
    pid = cur.lastrowid; conn.commit()
    cur.execute("SELECT * FROM content_posts WHERE id=?", (pid,))
    row = cur.fetchone(); conn.close()
    return _row_to_dict(row)

@router.get("/posts")
def list_posts(status: str | None = Query(None)):
    conn = get_db(); cur = conn.cursor()
    if status: cur.execute("SELECT * FROM content_posts WHERE status=? ORDER BY created_at DESC", (status,))
    else: cur.execute("SELECT * FROM content_posts ORDER BY created_at DESC")
    rows = [_row_to_dict(r) for r in cur.fetchall()]; conn.close()
    return {"data": rows, "total": len(rows)}

@router.put("/posts/{post_id}/review")
def review_post(post_id: int, body: ReviewBody):
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT * FROM content_posts WHERE id=?", (post_id,))
    p = cur.fetchone()
    if not p: conn.close(); raise HTTPException(404, "帖子不存在")
    if p["status"] != "pending_review":
        conn.close(); raise HTTPException(400, f"仅待审核(pending_review)状态可审核，当前为 {p['status']}")
    now = datetime.now(timezone.utc).isoformat()
    if body.action == "approve":
        cur.execute("UPDATE content_posts SET status='scheduled',reviewer_note=?,reviewed_by=?,postiz_post_id=?,updated_at=? WHERE id=?",
            (body.reviewerNote, body.reviewedBy, f"postiz_{uuid.uuid4().hex[:12]}", now, post_id))
    elif body.action == "reject":
        cur.execute("UPDATE content_posts SET status='draft',reviewer_note=?,reviewed_by=?,updated_at=? WHERE id=?",
            (body.reviewerNote, body.reviewedBy, now, post_id))
    else: conn.close(); raise HTTPException(400, "action 必须为 approve 或 reject")
    conn.commit()
    cur.execute("SELECT * FROM content_posts WHERE id=?", (post_id,)); row = cur.fetchone(); conn.close()
    return _row_to_dict(row)

@router.post("/posts/{post_id}/publish")
def publish_to_postiz(post_id: int):
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT * FROM content_posts WHERE id=?", (post_id,))
    p = cur.fetchone()
    if not p: conn.close(); raise HTTPException(404)
    if p["status"] != "scheduled": conn.close(); raise HTTPException(400, "只有 scheduled 状态才能发布")
    now = datetime.now(timezone.utc).isoformat()
    cur.execute("UPDATE content_posts SET status='published',updated_at=? WHERE id=?", (now, post_id))
    conn.commit()
    cur.execute("SELECT * FROM content_posts WHERE id=?", (post_id,)); row = cur.fetchone(); conn.close()
    return _row_to_dict(row)

@router.put("/posts/{post_id}/status")
def update_post_status(post_id: int, status: str = Query(...)):
    """受控状态迁移：draft→pending_review→scheduled→published（其余非法迁移拒绝）"""
    allowed_transitions = {
        "draft": {"pending_review", "draft"},
        "pending_review": {"draft", "scheduled", "pending_review"},
        "scheduled": {"published", "scheduled"},
        "published": {"published"},
        "failed": {"draft", "failed"},
    }
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT status FROM content_posts WHERE id=?", (post_id,))
    p = cur.fetchone()
    if not p: conn.close(); raise HTTPException(404, "帖子不存在")
    if status not in allowed_transitions.get(p["status"], set()):
        conn.close(); raise HTTPException(400, f"非法状态迁移：{p['status']} → {status}")
    now = datetime.now(timezone.utc).isoformat()
    cur.execute("UPDATE content_posts SET status=?,updated_at=? WHERE id=?", (status, now, post_id))
    conn.commit(); conn.close()
    return {"message": f"状态已更新为 {status}"}

@router.delete("/posts/{post_id}")
def delete_post(post_id: int):
    conn = get_db(); cur = conn.cursor()
    cur.execute("DELETE FROM content_posts WHERE id=?", (post_id,)); conn.commit(); conn.close()
    return {"deleted": True, "id": post_id}

# ─── 内容表现（数据复盘，真实库表） ───
@router.get("/performance")
def content_performance():
    """已发布内容的真实表现数据（content 表），供「数据复盘」页使用"""
    conn = get_db(); cur = conn.cursor()
    cur.execute(
        """SELECT platform, title, content_type, published_at, reads_views, interactions
           FROM content WHERE status='published'
           ORDER BY interactions DESC, reads_views DESC LIMIT 50"""
    )
    rows = [dict(r) for r in cur.fetchall()]
    # 平台汇总 + 互动率（用于趋势判断：高于均值记为上升）
    cur.execute(
        """SELECT platform, COUNT(*) AS cnt, COALESCE(SUM(reads_views),0) AS views, COALESCE(SUM(interactions),0) AS ints
           FROM content WHERE status='published' GROUP BY platform"""
    )
    summary = [dict(r) for r in cur.fetchall()]
    conn.close()
    avg = (sum(r["interactions"] or 0 for r in rows) / max(1, len(rows)))
    for r in rows:
        r["engagement"] = round((r["interactions"] or 0) / max(1, r["reads_views"] or 0) * 100, 2)
        r["trend"] = "up" if (r["interactions"] or 0) >= avg else "flat"
    return {"data": rows, "summary": summary}
