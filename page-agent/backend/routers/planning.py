"""玄策 · 项目统筹 —— 内容排期 × 外包任务 × 客户需求 × 运营活动 时间轴"""
import json
from datetime import date

from fastapi import APIRouter
from database import get_db

router = APIRouter(prefix="/api/planning", tags=["planning"])


@router.get("/overview")
def get_overview(days: int = 30):
    """聚合未来 days 天内的周期节点"""
    conn = get_db()
    cur = conn.cursor()
    today = date.today().isoformat()
    items = []

    # 内容排期（含近 7 天，覆盖逾期/明天截止，方便统筹）
    cur.execute(
        """SELECT id, platform, title, scheduled_at, status FROM content_posts
           WHERE scheduled_at != '' AND date(scheduled_at) >= date('now','-7 days') AND status NOT IN ('failed')
           ORDER BY scheduled_at LIMIT 60""",
    )
    for r in cur.fetchall():
        items.append({
            "id": f"c{r['id']}", "kind": "content", "group": "内容",
            "title": f"[{r['platform']}] {r['title']}",
            "start": r["scheduled_at"], "end": r["scheduled_at"],
            "status": r["status"],
        })

    # 外包任务（含近 7 天，逾期项纳入，红色高亮）
    cur.execute(
        """SELECT t.id, t.task, t.deadline, t.status, t.overdue_days, s.name as supplier_name
           FROM supply_tasks t JOIN suppliers s ON s.id = t.supplier_id
           WHERE t.deadline != '' AND t.deadline >= date('now','-7 days') AND t.status NOT IN ('已验收')
           ORDER BY t.deadline LIMIT 60""",
    )
    for r in cur.fetchall():
        items.append({
            "id": f"t{r['id']}", "kind": "task", "group": "外包",
            "title": f"[{r['supplier_name']}] {r['task']}",
            "start": r["deadline"], "end": r["deadline"],
            "status": r["status"],
        })

    # 客户需求
    cur.execute(
        """SELECT id, client, title, deadline, status, priority FROM client_requirements
           WHERE deadline != '' AND deadline >= date('now','-7 days') AND status NOT IN ('已交付','已关闭')
           ORDER BY deadline LIMIT 40""",
    )
    for r in cur.fetchall():
        items.append({
            "id": f"r{r['id']}", "kind": "req", "group": "需求",
            "title": f"[{r['client']}] {r['title']}",
            "start": r["deadline"], "end": r["deadline"],
            "status": r["status"], "priority": r["priority"],
        })

    # 运营活动（取当前 IP）
    cur.execute("SELECT id FROM ips ORDER BY id LIMIT 1")
    ip = cur.fetchone()
    if ip:
        cur.execute(
            """SELECT id, title, start_date, end_date, status FROM activities
               WHERE ip_id = ? AND start_date != '' AND date(start_date) >= date('now','-7 days')
               ORDER BY start_date LIMIT 40""",
            (ip["id"],),
        )
        for r in cur.fetchall():
            items.append({
                "id": f"a{r['id']}", "kind": "activity", "group": "活动",
                "title": r["title"],
                "start": r["start_date"], "end": r["end_date"] or r["start_date"],
                "status": r["status"],
            })

    conn.close()
    items.sort(key=lambda x: x["start"])
    return {"data": items}