"""玄策 · 供应链协同 CRUD API"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_db

router = APIRouter(prefix="/api/supply", tags=["supply"])

class SupplierBody(BaseModel):
    name: str; category: str = ""; budget: str = ""; mode: str = ""
    on_time: int = 0; revisions: float = 0; score: float = 0; contact: str = ""

class TaskBody(BaseModel):
    supplier_id: int; task: str; deadline: str = ""; status: str = "待派单"; overdue: int | None = None

@router.get("/suppliers")
def list_suppliers():
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT * FROM suppliers ORDER BY id"); rows = [dict(r) for r in cur.fetchall()]; conn.close()
    return {"data": rows}

@router.post("/suppliers")
def create_supplier(body: SupplierBody):
    conn = get_db(); cur = conn.cursor()
    cur.execute("INSERT INTO suppliers (name,category,budget,mode,on_time,revisions,score,contact) VALUES (?,?,?,?,?,?,?,?)",
        (body.name, body.category, body.budget, body.mode, body.on_time, body.revisions, body.score, body.contact))
    sid = cur.lastrowid; conn.commit(); conn.close()
    return {"id": sid, "message": "供应商已添加"}

@router.put("/suppliers/{sid}")
def update_supplier(sid: int, body: SupplierBody):
    conn = get_db(); cur = conn.cursor()
    cur.execute("UPDATE suppliers SET name=?,category=?,budget=?,mode=?,on_time=?,revisions=?,score=?,contact=? WHERE id=?",
        (body.name, body.category, body.budget, body.mode, body.on_time, body.revisions, body.score, body.contact, sid))
    conn.commit(); conn.close()
    return {"message": "供应商已更新"}

@router.delete("/suppliers/{sid}")
def delete_supplier(sid: int):
    conn = get_db(); cur = conn.cursor()
    cur.execute("DELETE FROM supply_tasks WHERE supplier_id=?", (sid,))
    cur.execute("DELETE FROM suppliers WHERE id=?", (sid,)); conn.commit(); conn.close()
    return {"message": "已删除"}

@router.get("/tasks")
def list_tasks():
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT t.*,s.name as supplier_name FROM supply_tasks t JOIN suppliers s ON s.id=t.supplier_id ORDER BY t.id")
    rows = [dict(r) for r in cur.fetchall()]; conn.close()
    return {"data": rows}

@router.post("/tasks")
def create_task(body: TaskBody):
    conn = get_db(); cur = conn.cursor()
    cur.execute("INSERT INTO supply_tasks (supplier_id,task,deadline,status,overdue_days) VALUES (?,?,?,?,?)",
        (body.supplier_id, body.task, body.deadline, body.status, body.overdue or 0))
    tid = cur.lastrowid; conn.commit(); conn.close()
    return {"id": tid, "message": "任务已添加"}

@router.put("/tasks/{tid}")
def update_task(tid: int, body: TaskBody):
    conn = get_db(); cur = conn.cursor()
    cur.execute("UPDATE supply_tasks SET supplier_id=?,task=?,deadline=?,status=?,overdue_days=? WHERE id=?",
        (body.supplier_id, body.task, body.deadline, body.status, body.overdue or 0, tid))
    conn.commit(); conn.close()
    return {"message": "任务已更新"}

@router.delete("/tasks/{tid}")
def delete_task(tid: int):
    conn = get_db(); cur = conn.cursor()
    cur.execute("DELETE FROM supply_tasks WHERE id=?", (tid,)); conn.commit(); conn.close()
    return {"message": "已删除"}
