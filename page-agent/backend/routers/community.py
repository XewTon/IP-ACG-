"""玄策 · 社区运营 CRUD API"""
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

@router.get("/feedback")
def list_feedback():
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT * FROM community_feedback ORDER BY date DESC"); rows = [dict(r) for r in cur.fetchall()]; conn.close()
    return {"data": rows}

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
