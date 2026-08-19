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

    # 1) 外包逾期（overdue_days>0 或 已过 deadline 未完结，含待派单/逾期状态）
    unsettled = ("已验收", "已关闭")
    cur.execute(
        """SELECT t.id, t.task, t.deadline, t.overdue_days, t.supplier_id, s.name as supplier_name
           FROM supply_tasks t JOIN suppliers s ON s.id = t.supplier_id
           WHERE t.overdue_days > 0 OR (t.deadline != '' AND t.deadline < ? AND t.status NOT IN (?,?))
           ORDER BY t.overdue_days DESC LIMIT 8""",
        (today.isoformat(), *unsettled),
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
            "suggestion": "立即联系对应供应商确认交付时间：评估拆解延期任务、协调加急档期，必要时启动备用供应商；同步向客户更新预期交付日，避免二次违约。",
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
            "suggestion": "本周内补齐至少 3 条排期：B站视频（周四/周五 18:00）+ 微博动态（10:00/12:30/21:00）+ 小红书笔记（12:00/20:00），优先复用文案模板库快速产出。",
        })
    elif scheduled < 3:
        alerts.append({
            "level": "yellow",
            "type": "content_light",
            "title": f"未来 7 天仅 {scheduled} 条排期",
            "detail": "低于周更节奏，建议补充排期",
            "count": scheduled,
            "link": "/content",
            "suggestion": "在下一次发布前补充排期至每周节奏：参照「平台发布时段」与文案模板生成初稿，走完审核流后再排期。",
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
            "suggestion": "按优先级今日完成验收：先处理关联高优先级客户需求的任务，输出书面验收意见并推动返修闭环，避免外包档期被动。",
        })

    conn.close()
    alerts.sort(key=lambda a: 0 if a["level"] == "red" else 1)
    return {"data": alerts, "critical": alerts[0]["level"] if alerts else None}