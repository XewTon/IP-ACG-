"""玄策 · 客户需求单 CRUD —— 对接客户需求 → 拆分任务 → 关联外包 → 验收回传"""
import json
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_db

router = APIRouter(prefix="/api/requirements", tags=["requirements"])

STATUSES = ["未处理", "拆解中", "制作中", "验收中", "已交付", "已关闭"]
PRIORITIES = ["高", "中", "低"]


class ReqBody(BaseModel):
    client: str
    title: str
    description: str = ""
    source: str = ""
    priority: str = "中"
    deadline: str = ""
    status: str = "未处理"


class LinkBody(BaseModel):
    task_id: int
    linked: bool = True


def row_to_dict(r) -> dict:
    d = dict(r)
    try:
        d["linked_task_ids"] = json.loads(d.get("linked_task_ids") or "[]")
    except Exception:
        d["linked_task_ids"] = []
    return d


def attach_tasks(conn, item: dict) -> dict:
    if not item["linked_task_ids"]:
        item["tasks"] = []
        return item
    cur = conn.cursor()
    placeholders = ",".join("?" * len(item["linked_task_ids"]))
    cur.execute(
        f"SELECT id, task, status, overdue_days FROM supply_tasks WHERE id IN ({placeholders})",
        item["linked_task_ids"],
    )
    rows = cur.fetchall()
    by_id = {r["id"]: dict(r) for r in rows}
    item["tasks"] = [by_id.get(t) for t in item["linked_task_ids"] if by_id.get(t)]
    item["task_count"] = len(item["tasks"])
    return item


def find_req(conn, req_id: int) -> dict:
    cur = conn.cursor()
    cur.execute("SELECT * FROM client_requirements WHERE id = ?", (req_id,))
    r = cur.fetchone()
    if not r:
        raise HTTPException(404, "需求不存在")
    return row_to_dict(r)


@router.get("")
def list_requirements():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM client_requirements ORDER BY id DESC")
    items = [attach_tasks(conn, row_to_dict(r)) for r in cur.fetchall()]
    conn.close()
    return {"data": items}


@router.post("")
def create_requirement(body: ReqBody):
    if body.priority not in PRIORITIES:
        raise HTTPException(400, "优先级须为 高/中/低")
    if body.status not in STATUSES:
        raise HTTPException(400, "状态非法")
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO client_requirements (client, title, description, source, priority, deadline, status)
           VALUES (?,?,?,?,?,?,?)""",
        (body.client, body.title, body.description, body.source, body.priority, body.deadline, body.status),
    )
    rid = cur.lastrowid
    conn.commit()
    conn.close()
    return {"id": rid, "message": "需求已登记"}


@router.put("/{req_id}")
def update_requirement(req_id: int, body: ReqBody):
    conn = get_db()
    find_req(conn, req_id)
    cur = conn.cursor()
    cur.execute(
        """UPDATE client_requirements SET client=?, title=?, description=?, source=?, priority=?, deadline=?, status=?,
           updated_at=datetime('now','localtime') WHERE id=?""",
        (body.client, body.title, body.description, body.source, body.priority, body.deadline, body.status, req_id),
    )
    conn.commit()
    conn.close()
    return {"message": "需求已更新"}


@router.put("/{req_id}/status")
def set_status(req_id: int, status: str):
    if status not in STATUSES:
        raise HTTPException(400, "状态非法")
    conn = get_db()
    find_req(conn, req_id)
    cur = conn.cursor()
    cur.execute(
        "UPDATE client_requirements SET status=?, updated_at=datetime('now','localtime') WHERE id=?",
        (status, req_id),
    )
    conn.commit()
    conn.close()
    return {"message": "状态已更新"}


@router.put("/{req_id}/link")
def link_task(req_id: int, body: LinkBody):
    conn = get_db()
    item = find_req(conn, req_id)
    cur = conn.cursor()
    cur.execute("SELECT id FROM supply_tasks WHERE id = ?", (body.task_id,))
    if not cur.fetchone():
        conn.close()
        raise HTTPException(404, "任务不存在")
    ids = item["linked_task_ids"]
    if body.linked:
        if body.task_id not in ids:
            ids.append(body.task_id)
    else:
        ids = [t for t in ids if t != body.task_id]
    cur.execute(
        "UPDATE client_requirements SET linked_task_ids=?, updated_at=datetime('now','localtime') WHERE id=?",
        (json.dumps(ids), req_id),
    )
    conn.commit()
    conn.close()
    return {"message": "已关联" if body.linked else "已解除关联", "linked_task_ids": ids}


@router.delete("/{req_id}")
def delete_requirement(req_id: int):
    conn = get_db()
    find_req(conn, req_id)
    cur = conn.cursor()
    cur.execute("DELETE FROM client_requirements WHERE id=?", (req_id,))
    conn.commit()
    conn.close()
    return {"message": "需求已删除"}
