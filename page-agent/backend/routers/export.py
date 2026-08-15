"""玄策 · 数据导出 —— CSV（UTF-8 BOM，Excel 直接打开不乱码）"""
import csv
import io
import json
from datetime import date

from fastapi import APIRouter
from fastapi.responses import Response
from database import get_db

router = APIRouter(prefix="/api/export", tags=["export"])


def _platform_rows(cur):
    cur.execute(
        """SELECT m.platform, m.followers, m.reads_views, m.interactions, m.engagement_rate, m.recorded_at
           FROM metrics m
           INNER JOIN (SELECT platform, MAX(recorded_at) AS max_d FROM metrics GROUP BY platform) t
           ON m.platform = t.platform AND m.recorded_at = t.max_d"""
    )
    return [dict(r) for r in cur.fetchall()]


@router.get("/summary")
def export_summary():
    conn = get_db()
    cur = conn.cursor()
    buf = io.StringIO()
    writer = csv.writer(buf)

    writer.writerow(["玄策 · 运营数据汇总", date.today().isoformat()])
    writer.writerow([])

    # 平台指标
    rows = _platform_rows(cur)
    writer.writerow(["平台", "粉丝", "阅读/播放", "互动", "互动率%", "记录日期"])
    for r in rows:
        writer.writerow([r["platform"], r["followers"], r["reads_views"], r["interactions"], r["engagement_rate"], r["recorded_at"]])
    total_fans = sum(r["followers"] for r in rows)
    total_reads = sum(r["reads_views"] for r in rows)
    total_ints = sum(r["interactions"] for r in rows)
    writer.writerow(["合计", total_fans, total_reads, total_ints, "", ""])
    writer.writerow([])

    # 内容表现（content 表：已发布数据）
    cur.execute(
        "SELECT platform, title, status, scheduled_at, published_at, reads_views, interactions FROM content ORDER BY id DESC LIMIT 50"
    )
    content_rows = [dict(r) for r in cur.fetchall()]
    if content_rows:
        writer.writerow([])
        writer.writerow(["内容表现（content）"])
        writer.writerow(["平台", "标题", "状态", "排期", "发布时间", "阅读", "互动"])
        for r in content_rows:
            writer.writerow([r["platform"], r["title"], r["status"], r["scheduled_at"], r["published_at"], r["reads_views"] or 0, r["interactions"] or 0])

    # 排期内容（content_posts）
    cur.execute(
        "SELECT id, platform, title, status, scheduled_at, created_at FROM content_posts ORDER BY id DESC LIMIT 50"
    )
    posts = cur.fetchall()
    if posts:
        writer.writerow([])
        writer.writerow(["排期内容（content_posts）"])
        writer.writerow(["平台", "标题", "状态", "排期", "创建时间"])
        for r in posts:
            writer.writerow([r["platform"], r["title"], r["status"], r["scheduled_at"], r["created_at"]])

    # 外包任务
    cur.execute(
        """SELECT t.task, s.name, t.deadline, t.status, t.overdue_days
           FROM supply_tasks t JOIN suppliers s ON s.id = t.supplier_id ORDER BY t.id"""
    )
    tasks = cur.fetchall()
    if tasks:
        writer.writerow([])
        writer.writerow(["外包任务"])
        writer.writerow(["任务", "供应商", "截止", "状态", "逾期天数"])
        for r in tasks:
            writer.writerow([r["task"], r["name"], r["deadline"], r["status"], r["overdue_days"]])

    # 客户需求
    cur.execute("SELECT client, title, priority, deadline, status FROM client_requirements ORDER BY id")
    reqs = cur.fetchall()
    if reqs:
        writer.writerow([])
        writer.writerow(["客户需求"])
        writer.writerow(["客户", "标题", "优先级", "截止", "状态"])
        for r in reqs:
            writer.writerow([r["client"], r["title"], r["priority"], r["deadline"], r["status"]])

    # 社区反馈
    cur.execute(
        "SELECT date, platform, user_name, content, sentiment, role_type FROM community_feedback ORDER BY id DESC LIMIT 50"
    )
    feedback = cur.fetchall()
    if feedback:
        writer.writerow([])
        writer.writerow(["社区反馈（近 50 条）"])
        writer.writerow(["日期", "平台", "用户", "内容", "情感", "角色"])
        for r in feedback:
            writer.writerow([r["date"], r["platform"], r["user_name"], r["content"], r["sentiment"], r["role_type"]])

    conn.close()

    csv_text = "\ufeff" + buf.getvalue()
    filename = f"xuance_summary_{date.today().strftime('%Y%m%d')}.csv"
    return Response(
        content=csv_text.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )