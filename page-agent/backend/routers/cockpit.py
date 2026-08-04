"""玄策 · 运营驾驶舱 API"""
import json
from fastapi import APIRouter
from database import get_db

router = APIRouter(prefix="/api/cockpit", tags=["cockpit"])


@router.get("/summary")
def get_cockpit_summary():
    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT * FROM ips ORDER BY id LIMIT 1")
    ip = cur.fetchone()
    if not ip:
        conn.close()
        return {"error": "no_ip"}

    ip_id = ip["id"]
    cur.execute("SELECT COUNT(*) AS c FROM characters WHERE ip_id = ?", (ip_id,))
    char_count = cur.fetchone()["c"]

    cur.execute(
        """SELECT SUM(followers) AS total FROM metrics m
           INNER JOIN (SELECT platform, MAX(recorded_at) AS max_d FROM metrics GROUP BY platform) t
           ON m.platform = t.platform AND m.recorded_at = t.max_d"""
    )
    user_scale = cur.fetchone()["total"] or 0

    cur.execute("SELECT COUNT(*) AS c FROM activities WHERE ip_id = ?", (ip_id,))
    activity_count = cur.fetchone()["c"]

    cur.execute(
        """SELECT date, SUM(followers) AS total FROM follower_history
           WHERE date >= date('now', '-30 days') GROUP BY date ORDER BY date"""
    )
    growth = [{"date": r["date"], "followers": r["total"]} for r in cur.fetchall()]

    cur.execute(
        """SELECT m.platform, m.followers FROM metrics m
           INNER JOIN (SELECT platform, MAX(recorded_at) AS max_d FROM metrics GROUP BY platform) t
           ON m.platform = t.platform AND m.recorded_at = t.max_d"""
    )
    platforms = [{"platform": r["platform"], "followers": r["followers"]} for r in cur.fetchall()]

    # 角色热度：近7天讨论量均值
    cur.execute(
        """SELECT c.name,
                  ROUND(AVG(m.discussions), 0) AS discussions,
                  ROUND(AVG(m.search_index), 0) AS search_index,
                  ROUND(AVG(m.commercial_score), 1) AS commercial_score,
                  ROUND(AVG(m.fan_growth), 0) AS fan_growth,
                  ROUND(AVG(m.fanworks), 0) AS fanworks
           FROM characters c
           JOIN character_daily_metrics m ON m.character_id = c.id
           WHERE c.ip_id = ? AND m.date >= date('now', '-7 days')
           GROUP BY c.id
           ORDER BY discussions DESC""",
        (ip_id,),
    )
    character_rank = [dict(r) for r in cur.fetchall()]

    # 热度趋势：全角色讨论量合计
    cur.execute(
        """SELECT m.date, SUM(m.discussions) AS heat
           FROM character_daily_metrics m
           JOIN characters c ON c.id = m.character_id
           WHERE c.ip_id = ? AND m.date >= date('now', '-30 days')
           GROUP BY m.date ORDER BY m.date""",
        (ip_id,),
    )
    heat_trend = [{"date": r["date"], "heat": r["heat"]} for r in cur.fetchall()]

    cur.execute(
        "SELECT * FROM sentiment_snapshots WHERE ip_id = ? ORDER BY date DESC LIMIT 1",
        (ip_id,),
    )
    sent = cur.fetchone()
    sentiment = None
    if sent:
        sentiment = {
            "positive": sent["positive"],
            "neutral": sent["neutral"],
            "negative": sent["negative"],
            "keywords": json.loads(sent["keywords"] or "[]"),
            "risk_level": sent["risk_level"],
            "summary": sent["summary"],
        }

    conn.close()

    return {
        "ip": {
            "id": ip["id"],
            "name": ip["name"],
            "name_en": ip["name_en"],
            "type": ip["type"],
        },
        "kpis": {
            "ip_count": 1,
            "user_scale": user_scale,
            "today_heat": heat_trend[-1]["heat"] if heat_trend else 0,
            "activity_count": activity_count,
            "character_count": char_count,
        },
        "health": {
            "heat": ip["heat_index"],
            "activity": ip["activity_index"],
            "commercial": ip["commercial_score"],
            "sentiment": ip["sentiment_index"],
        },
        "heat_trend": heat_trend,
        "user_growth": growth,
        "platform_share": platforms,
        "character_rank": character_rank,
        "sentiment": sentiment,
    }
