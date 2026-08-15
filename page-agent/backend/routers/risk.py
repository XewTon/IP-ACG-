"""玄策 · 风险预警 —— 外包逾期 / 内容空档 / 验收积压"""
from datetime import date, timedelta

from fastapi import APIRouter
from database import get_db

router = APIRouter(prefix="/api/risk", tags=["risk"])


@router.get("/alerts")
def get_alerts():
    conn = get_db()
    cur = conn.cursor()
    today = date.today()
    alerts = []

    # 1) 外包逾期（overdue_days>0 或 已过 deadline 未完结）
    unsettled = ("已验收", "已关闭")
    cur.execute(
        """SELECT t.id, t.task, t.deadline, t.overdue_days, t.supplier_id, s.name as supplier_name
           FROM supply_tasks t JOIN suppliers s ON s.id = t.supplier_id
           WHERE t.overdue_days > 0 OR (t.deadline != '' AND t.deadline < ? AND t.status NOT IN (?,?,?,?))
           ORDER BY t.overdue_days DESC LIMIT 8""",
        (today.isoformat(), *unsettled, "逾期", "待派单"),
    )
    overdue = [dict(r) for r in cur.fetchall()]
    if overdue:
        alerts.append({
            "level": "red",
            "type": "overdue",
            "title": f"外包逾期 {len(overdue)} 项",
            "detail": "；".join(f"[{r['supplier_name']}] {r['task']}" for r in overdue[:3]),
            "count": len(overdue),
            "link": "/outsourcing",
        })

    # 2) 内容空档（未来 7 天已排期数量不足）
    week_later = (today + timedelta(days=7)).isoformat()
    cur.execute(
        """SELECT COUNT(*) AS c FROM content_posts
           WHERE date(scheduled_at) BETWEEN ? AND ? AND status IN ('approved','scheduled')""",
        (today.isoformat(), week_later),
    )
    scheduled = cur.fetchone()["c"]
    if scheduled == 0:
        alerts.append({
            "level": "yellow",
            "type": "content_gap",
            "title": "未来 7 天无排期内容",
            "detail": "内容池空档，请尽快在内容运营中心排期，避免断更",
            "count": 1,
            "link": "/content",
        })
    elif scheduled < 3:
        alerts.append({
            "level": "yellow",
            "type": "content_light",
            "title": f"未来 7 天仅 {scheduled} 条排期",
            "detail": "低于周更节奏，建议补充排期",
            "count": scheduled,
            "link": "/content",
        })

    # 3) 待验收积压（内部反馈/待验收 >= 2）
    cur.execute(
        "SELECT COUNT(*) AS c FROM supply_tasks WHERE status IN ('内部反馈','待验收')",
    )
    wait = cur.fetchone()["c"]
    if wait >= 2:
        alerts.append({
            "level": "yellow",
            "type": "acceptance_backlog",
            "title": f"待验收积压 {wait} 项",
            "detail": "尽快推进验收，避免外包档期被动",
            "count": wait,
            "link": "/outsourcing",
        })

    conn.close()
    alerts.sort(key=lambda a: 0 if a["level"] == "red" else 1)
    return {"data": alerts, "critical": alerts[0]["level"] if alerts else None}