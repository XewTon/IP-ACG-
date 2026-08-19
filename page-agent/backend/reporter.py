"""
报告生成器 —— 生成每日简报和每周周报
"""
from datetime import date, timedelta
from database import get_db


def generate_daily_report() -> str:
    """生成每日数据简报 (Markdown)"""
    conn = get_db()
    cursor = conn.cursor()
    today = date.today().isoformat()

    # 汇总数据
    cursor.execute("SELECT platform, followers, reads_views, interactions, engagement_rate FROM metrics WHERE recorded_at = ?", (today,))
    rows = cursor.fetchall()

    if not rows:
        # 取最新日期的数据
        cursor.execute("SELECT platform, followers, reads_views, interactions, engagement_rate FROM metrics ORDER BY recorded_at DESC LIMIT 4")
        rows = cursor.fetchall()

    total_followers = sum(r["followers"] for r in rows)
    total_reads = sum(r["reads_views"] for r in rows)
    total_interactions = sum(r["interactions"] for r in rows)

    # 昨日新增（简化：对比前天）
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    cursor.execute("SELECT platform, followers FROM follower_history WHERE date = ?", (yesterday,))
    yesterday_rows = cursor.fetchall()
    yesterday_followers = sum(r["followers"] for r in yesterday_rows) if yesterday_rows else total_followers

    # Top 内容
    cursor.execute("SELECT platform, title, reads_views, interactions FROM content WHERE status = 'published' ORDER BY interactions DESC LIMIT 5")
    top_contents = cursor.fetchall()
    conn.close()

    lines = [
        f"# 玄策 每日数据简报",
        f"**日期**: {today}",
        "",
        "## 核心指标",
        f"- 全网粉丝: **{total_followers:,}** (+{total_followers - yesterday_followers} 昨日新增)",
        f"- 昨日阅读/播放: **{total_reads:,}**",
        f"- 昨日互动: **{total_interactions:,}**",
        "",
        "## 各平台数据",
    ]

    for r in rows:
        lines.append(f"- **{r['platform']}**: {r['followers']:,} 粉 | {r['reads_views']:,} 阅读 | {r['interactions']:,} 互动 | {r['engagement_rate']}% 互动率")

    lines.append("")
    lines.append("## 昨日 Top 5 内容")
    for i, c in enumerate(top_contents, 1):
        lines.append(f"{i}. [{c['platform']}] {c['title']} — {c['reads_views']:,} 阅读/播放, {c['interactions']:,} 互动")

    return "\n".join(lines)


def generate_weekly_report() -> str:
    """生成每周数据周报 (Markdown)"""
    conn = get_db()
    cursor = conn.cursor()
    today = date.today()
    week_ago = (today - timedelta(days=7)).isoformat()

    # 本周粉丝增长
    cursor.execute(
        """SELECT platform, MAX(followers) - MIN(followers) as growth
           FROM follower_history WHERE date >= ? GROUP BY platform""",
        (week_ago,),
    )
    growth_rows = cursor.fetchall()

    # 本周发布内容
    cursor.execute(
        """SELECT platform, COUNT(*) as count, SUM(reads_views) as total_views, SUM(interactions) as total_ints
           FROM content WHERE published_at >= ? AND status = 'published' GROUP BY platform""",
        (week_ago,),
    )
    content_rows = cursor.fetchall()
    conn.close()

    lines = [
        "# 玄策 每周数据周报",
        f"**周期**: {week_ago} ~ {today.isoformat()}",
        "",
        "## 本周粉丝增长",
    ]
    for r in growth_rows:
        lines.append(f"- **{r['platform']}**: +{r['growth']:,}")

    lines.append("")
    lines.append("## 本周内容数据")
    for r in content_rows:
        avg = r["total_views"] // r["count"] if r["count"] > 0 else 0
        lines.append(f"- **{r['platform']}**: {r['count']} 条内容 | {r['total_views']:,} 总阅读 | 均 {avg:,} 阅读")

    lines.append("")
    lines.append("## 策略建议")
    lines.append("> 请根据以上数据，结合各平台内容表现，调整下周内容排期和重点方向。")

    return "\n".join(lines)


if __name__ == "__main__":
    print(generate_daily_report())
    print("\n" + "=" * 50 + "\n")
    print(generate_weekly_report())
