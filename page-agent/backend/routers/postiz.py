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
    cur.execute("""INSERT INTO content_posts (platform,postiz_channel_id,title,body,media_urls,scheduled_at,status,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?)""",
        (body.platform, body.postizChannelId, body.title, body.body, ",".join(body.mediaUrls), body.scheduledAt, body.status, now, now))
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
    conn = get_db(); cur = conn.cursor()
    now = datetime.now(timezone.utc).isoformat()
    cur.execute("UPDATE content_posts SET status=?,updated_at=? WHERE id=?", (status, now, post_id))
    conn.commit(); conn.close()
    return {"message": f"状态已更新为 {status}"}

@router.delete("/posts/{post_id}")
def delete_post(post_id: int):
    conn = get_db(); cur = conn.cursor()
    cur.execute("DELETE FROM content_posts WHERE id=?", (post_id,)); conn.commit(); conn.close()
    return {"deleted": True, "id": post_id}
