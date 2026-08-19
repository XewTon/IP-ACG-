"""运营 Agent 可用工具：取数 + 知识检索"""
from __future__ import annotations

import json
from database import get_db
from ai.rag import search_ip_knowledge


def get_cockpit_metrics() -> dict:
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM ips ORDER BY id LIMIT 1")
    ip = cur.fetchone()
    cur.execute(
        """SELECT SUM(followers) AS total FROM metrics m
           INNER JOIN (SELECT platform, MAX(recorded_at) AS max_d FROM metrics GROUP BY platform) t
           ON m.platform = t.platform AND m.recorded_at = t.max_d"""
    )
    users = cur.fetchone()["total"] or 0
    cur.execute("SELECT COUNT(*) AS c FROM activities")
    acts = cur.fetchone()["c"]
    cur.execute(
        """SELECT m.date, SUM(m.discussions) AS heat FROM character_daily_metrics m
           GROUP BY m.date ORDER BY m.date DESC LIMIT 1"""
    )
    heat_row = cur.fetchone()
    conn.close()
    return {
        "ip_name": ip["name"] if ip else "玄机IP",
        "heat_index": ip["heat_index"] if ip else 0,
        "activity_index": ip["activity_index"] if ip else 0,
        "commercial_score": ip["commercial_score"] if ip else 0,
        "sentiment_index": ip["sentiment_index"] if ip else 0,
        "user_scale": users,
        "activity_count": acts,
        "today_heat": heat_row["heat"] if heat_row else 0,
    }


def get_character_stats(name: str | None = None) -> list[dict]:
    conn = get_db()
    cur = conn.cursor()
    sql = """
        SELECT c.name, c.role, c.tag, c.keywords, c.commercial_value,
               ROUND(AVG(m.search_index), 0) AS search_index,
               ROUND(AVG(m.discussions), 0) AS discussions,
               ROUND(AVG(m.fan_growth), 0) AS fan_growth,
               ROUND(AVG(m.fanworks), 0) AS fanworks
        FROM characters c
        LEFT JOIN character_daily_metrics m
          ON m.character_id = c.id AND m.date >= date('now', '-7 days')
    """
    params: list = []
    if name:
        sql += " WHERE c.name LIKE ?"
        params.append(f"%{name}%")
    sql += " GROUP BY c.id ORDER BY discussions DESC"
    cur.execute(sql, params)
    rows = [dict(r) for r in cur.fetchall()]

    # 讨论量环比
    for row in rows:
        cur.execute(
            """SELECT discussions FROM character_daily_metrics m
               JOIN characters c ON c.id = m.character_id
               WHERE c.name = ? ORDER BY m.date DESC LIMIT 30""",
            (row["name"],),
        )
        vals = [r["discussions"] for r in cur.fetchall()]
        if len(vals) >= 15:
            recent = sum(vals[:15]) / 15
            older = sum(vals[15:]) / max(len(vals) - 15, 1)
            row["discussion_change_pct"] = round((recent - older) / older * 100, 1) if older else 0
        else:
            row["discussion_change_pct"] = 0
    conn.close()
    return rows


def list_recent_sentiment() -> dict:
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM sentiment_snapshots ORDER BY date DESC LIMIT 1")
    row = cur.fetchone()
    conn.close()
    if not row:
        return {}
    return {
        "positive": row["positive"],
        "neutral": row["neutral"],
        "negative": row["negative"],
        "keywords": json.loads(row["keywords"] or "[]"),
        "risk_level": row["risk_level"],
        "summary": row["summary"],
    }


def list_activities() -> list[dict]:
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT title, status, channel, exposure, participants, conversion_rate, roi, notes FROM activities ORDER BY id"
    )
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def tool_search_knowledge(query: str) -> list[str]:
    return search_ip_knowledge(query, top_k=3)
