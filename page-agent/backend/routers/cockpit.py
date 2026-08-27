"""玄策 · 运营驾驶舱 API

数据口径（逻辑闭环）：每一块展示数据都必须可追溯到「来源表 → 采集方式 → 计算口径」。
- 健康四维（热度/活跃/商业/舆情）：由底层明细表实时计算，不再读取 ips 静态列；
  当明细表无数据时回退到 ips 静态列，并在 meta 中标注「回退静态」。
- 其余图表：直接由 metrics / follower_history / character_daily_metrics /
  sentiment_snapshots / activities / content 聚合得出。
"""
import json
from datetime import date

from fastapi import APIRouter
from database import get_db

router = APIRouter(prefix="/api/cockpit", tags=["cockpit"])


def _clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> int:
    return max(lo, min(hi, round(v)))


def _agg_status(cur, sql: str, params: tuple = ()) -> str:
    """聚合一批行的 source → 'seed' / 'real' / 'mixed'（真实包含 crawler/import/manual）"""
    real_kinds = ("crawler", "manual")
    try:
        cur.execute(sql, params)
        rows = [r[0] for r in cur.fetchall() if r[0]]
    except Exception:
        return "seed"
    if not rows:
        return "seed"
    has_real = any(any(k in (r or "") for k in real_kinds) or r.startswith("import:") for r in rows)
    has_seed = any((r or "") == "seed" for r in rows)
    if has_real and has_seed:
        return "mixed"
    if has_real:
        return "real"
    return "seed"


# ==================== 健康四维计算口径（逻辑闭环核心） ====================
# 每个维度：来源表 → 采集方式 → 计算口径 → 更新频率，全部在下方函数中显式定义，
# 前端「数据来源字典」与「计算口径说明」直接引用同一份口径文本，保证闭环可追溯。

HEAT_META = {
    "key": "heat", "label": "IP热度指数",
    "source": "character_daily_metrics.discussions + metrics.reads_views",
    "collect": "角色讨论量由数据采集派生（近7日日均），阅读/播放量取各平台最新快照；可手动校准",
    "calc": "55 × min(1, 近7日日均讨论量/3000) + 45 × min(1, 最新全网阅读量/80000)，四舍五入",
    "freq": "每日",
}
ACTIVITY_META = {
    "key": "activity", "label": "用户活跃度",
    "source": "follower_history + activities + content",
    "collect": "粉丝历史由 metrics 每日累计派生；活动/内容由运营中心录入",
    "calc": "45×min(1, 近30日粉丝净增率/25%) + 15×min(1, 进行中活动数/3) + 15×min(1, 近90日发布内容数/10) + 25×min(1, 全网粉丝/20000)",
    "freq": "每日",
}
COMMERCIAL_META = {
    "key": "commercial", "label": "商业潜力",
    "source": "characters.commercial_value + character_daily_metrics.commercial_score + activities.roi",
    "collect": "角色商业价值由资产中心维护；日商业分由采集派生；ROI 由活动复盘录入",
    "calc": "45%×角色商业价值均值 + 35%×近7日商业分均值 + 20%×min(100, 活动ROI均值×50)",
    "freq": "每日",
}
SENTIMENT_META = {
    "key": "sentiment", "label": "舆情健康",
    "source": "sentiment_snapshots.positive / neutral / negative",
    "collect": "舆情快照由舆情采集/人工标注生成（当前为运营登记）",
    "calc": "min(100, round((正面占比 - 负面占比 + 100) / 2))，中性占比不直接加分",
    "freq": "按快照更新",
}
HEALTH_META = [HEAT_META, ACTIVITY_META, COMMERCIAL_META, SENTIMENT_META]


def _compute_health(cur, ip_id: int, static: dict) -> dict:
    """健康四维：优先由底层明细表计算；明细缺失时回退 ips 静态列。"""
    basis = {}

    # ---- 热度 heat ----
    # 口径：日均讨论总量（各角色每日 discussions 之和的 7 日平均）+ 最新全网阅读量
    avg_disc = 0.0
    cur.execute(
        """SELECT AVG(daily.total) AS a FROM (
               SELECT m.date, SUM(m.discussions) AS total
               FROM character_daily_metrics m
               JOIN characters c ON c.id = m.character_id
               WHERE c.ip_id = ? AND m.date >= date(
                     (SELECT MAX(date) FROM character_daily_metrics
                      WHERE character_id IN (SELECT id FROM characters WHERE ip_id = ?)), '-6 days')
               GROUP BY m.date
           ) daily""",
        (ip_id, ip_id),
    )
    row = cur.fetchone()
    if row and row["a"] is not None:
        avg_disc = float(row["a"])

    total_reads = 0.0
    cur.execute(
        """SELECT SUM(m.reads_views) AS s FROM metrics m
           INNER JOIN (SELECT platform, MAX(recorded_at) AS md FROM metrics GROUP BY platform) t
           ON m.platform = t.platform AND m.recorded_at = t.md"""
    )
    row = cur.fetchone()
    if row and row["s"] is not None:
        total_reads = float(row["s"])

    if avg_disc > 0 or total_reads > 0:
        heat = _clamp(55 * min(1.0, avg_disc / 3000.0) + 45 * min(1.0, total_reads / 80000.0))
        basis["heat"] = {"computed": True, "inputs": {"avg_discussions_7d": round(avg_disc), "latest_reads": int(total_reads)}}
    else:
        heat = int(static.get("heat_index") or 0)
        basis["heat"] = {"computed": False, "inputs": {}}

    # ---- 活跃度 activity ----
    cur.execute("SELECT MAX(date) AS md FROM follower_history")
    fd = cur.fetchone()
    growth_pct = 0.0
    total_followers = 0.0
    if fd and fd["md"]:
        max_fd = fd["md"]
        cur.execute("SELECT SUM(followers) AS s FROM follower_history WHERE date = ?", (max_fd,))
        latest = (cur.fetchone()["s"] or 0) or 0
        # 取 30 天前当日或之前最近一次快照（历史可能非每日记录）
        cur.execute(
            """SELECT SUM(followers) AS s FROM follower_history
               WHERE date = (SELECT MAX(date) FROM follower_history WHERE date <= date(?, '-30 days'))""",
            (max_fd,),
        )
        old = (cur.fetchone()["s"] or 0) or 0
        total_followers = float(latest)
        if old > 0:
            growth_pct = (latest - old) / old * 100.0

    cur.execute("SELECT COUNT(*) AS c FROM activities WHERE status IN ('running','completed')")
    running = cur.fetchone()["c"]
    cur.execute(
        """SELECT COUNT(*) AS c FROM content WHERE status='published' AND date(published_at) >=
           date((SELECT MAX(date(published_at)) FROM content WHERE status='published'), '-90 days')"""
    )
    published_90d = cur.fetchone()["c"]

    if total_followers > 0:
        activity = _clamp(
            45 * min(1.0, growth_pct / 25.0)
            + 15 * min(1.0, running / 3.0)
            + 15 * min(1.0, published_90d / 10.0)
            + 25 * min(1.0, total_followers / 20000.0)
        )
        basis["activity"] = {"computed": True, "inputs": {"growth_pct_30d": round(growth_pct, 1), "running_activities": running, "published_90d": published_90d, "total_followers": int(total_followers)}}
    else:
        activity = int(static.get("activity_index") or 0)
        basis["activity"] = {"computed": False, "inputs": {}}

    # ---- 商业潜力 commercial ----
    cur.execute("SELECT AVG(commercial_value) AS a FROM characters WHERE ip_id = ?", (ip_id,))
    row = cur.fetchone()
    avg_cv = float(row["a"] or 0) if row and row["a"] is not None else 0.0
    cur.execute(
        """SELECT AVG(m.commercial_score) AS a FROM character_daily_metrics m
           JOIN characters c ON c.id = m.character_id
           WHERE c.ip_id = ? AND m.date >= date(
                 (SELECT MAX(date) FROM character_daily_metrics
                  WHERE character_id IN (SELECT id FROM characters WHERE ip_id = ?)), '-6 days')""",
        (ip_id, ip_id),
    )
    row = cur.fetchone()
    avg_cs = float(row["a"] or 0) if row and row["a"] is not None else 0.0
    cur.execute("SELECT AVG(roi) AS a FROM activities WHERE roi > 0 AND ip_id = ?", (ip_id,))
    row = cur.fetchone()
    avg_roi = float(row["a"] or 0) if row and row["a"] is not None else 0.0

    if avg_cv > 0 or avg_cs > 0:
        commercial = _clamp(0.45 * avg_cv + 0.35 * avg_cs + 0.2 * min(100.0, avg_roi * 50.0))
        basis["commercial"] = {"computed": True, "inputs": {"avg_commercial_value": round(avg_cv, 1), "avg_commercial_score_7d": round(avg_cs, 1), "avg_roi": round(avg_roi, 2)}}
    else:
        commercial = int(static.get("commercial_score") or 0)
        basis["commercial"] = {"computed": False, "inputs": {}}

    # ---- 舆情 sentiment ----
    cur.execute("SELECT * FROM sentiment_snapshots WHERE ip_id = ? ORDER BY date DESC LIMIT 1", (ip_id,))
    sent = cur.fetchone()
    if sent:
        pos, neg = float(sent["positive"] or 0), float(sent["negative"] or 0)
        sentiment = _clamp((pos - neg + 100.0) / 2.0)
        basis["sentiment"] = {"computed": True, "inputs": {"positive": pos, "negative": neg}}
    else:
        sentiment = int(static.get("sentiment_index") or 0)
        basis["sentiment"] = {"computed": False, "inputs": {}}

    return {
        "health": {"heat": heat, "activity": activity, "commercial": commercial, "sentiment": sentiment},
        "basis": basis,
    }


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

    # 角色热度：近7天讨论量均值（character_daily_metrics，真实明细聚合）
    cur.execute(
        """SELECT c.name,
                  ROUND(AVG(m.discussions), 0) AS discussions,
                  ROUND(AVG(m.search_index), 0) AS search_index,
                  ROUND(AVG(m.commercial_score), 1) AS commercial_score,
                  ROUND(AVG(m.fan_growth), 0) AS fan_growth,
                  ROUND(AVG(m.fanworks), 0) AS fanworks,
                  MAX(m.source) AS source
           FROM characters c
           JOIN character_daily_metrics m ON m.character_id = c.id
           WHERE c.ip_id = ? AND m.date >= date('now', '-7 days')
           GROUP BY c.id
           ORDER BY discussions DESC""",
        (ip_id,),
    )
    character_rank = [dict(r) for r in cur.fetchall()]

    # 讨论量数据状态：有多少角色日指标来自真实采集（crawler）
    cur.execute(
        """SELECT COUNT(DISTINCT m.character_id) AS crawled_chars,
                  COUNT(DISTINCT m.date) AS crawled_days
           FROM character_daily_metrics m
           JOIN characters c ON c.id = m.character_id
           WHERE c.ip_id = ? AND m.source = 'crawler'""",
        (ip_id,),
    )
    disc_stat = cur.fetchone()
    discussion_status = {
        "crawler_chars": disc_stat["crawled_chars"] or 0,
        "crawler_days": disc_stat["crawled_days"] or 0,
        "has_real": (disc_stat["crawled_days"] or 0) > 0,
        "sync_hint": "讨论量来自 MediaCrawler 真实评论聚合（POST /api/community/sync-discussions）；未同步时为演示种子数据",
    }

    # 热度趋势：全角色讨论量合计（30日）
    cur.execute(
        """SELECT m.date, SUM(m.discussions) AS heat
           FROM character_daily_metrics m
           JOIN characters c ON c.id = m.character_id
           WHERE c.ip_id = ? AND m.date >= date('now', '-30 days')
           GROUP BY m.date ORDER BY m.date""",
        (ip_id,),
    )
    heat_trend = [{"date": r["date"], "heat": r["heat"]} for r in cur.fetchall()]

    # 舆情（最新快照）
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

    # ---- 健康四维：真实计算 + 回退静态 ----
    health_res = _compute_health(cur, ip_id, ip)
    health = health_res["health"]
    health_basis = health_res["basis"]

    # ---- 各块数据来源状态（seed/real/mixed）----
    status_metrics = _agg_status(cur, "SELECT source FROM metrics")
    status_history = _agg_status(cur, "SELECT source FROM follower_history")
    status_daily = _agg_status(cur, "SELECT source FROM character_daily_metrics")
    status_sent = _agg_status(cur, "SELECT source FROM sentiment_snapshots")
    status_activities = _agg_status(cur, "SELECT source FROM activities")
    status_content = _agg_status(cur, "SELECT source FROM content")
    status_suppliers = _agg_status(cur, "SELECT source FROM suppliers")

    # ---- 血缘字典（来源表 → 采集方式 → 口径 → 频率 → 状态）----
    meta = {
        "updated_at": date.today().isoformat(),
        "kpis": [
            {"key": "user_scale", "label": "用户规模",
             "source": "metrics", "collect": "平台快照导入（CSV）/ MediaCrawler 播放量聚合 / 每日采集",
             "calc": "Σ 各平台最新快照粉丝数（metrics 按平台取最新 recorded_at）", "freq": "每日",
             "status": status_metrics},
            {"key": "today_heat", "label": "今日热度",
             "source": "character_daily_metrics", "collect": "角色讨论量采集派生 + 手动校准",
             "calc": "最近一日全部角色 discussions 之和（heat_trend 末点）", "freq": "每日",
             "status": status_daily},
            {"key": "activity_count", "label": "活动数量",
             "source": "activities", "collect": "活动运营录入（驾驶舱/活动中心）",
             "calc": "COUNT(activities WHERE ip_id = 当前IP)", "freq": "实时",
             "status": status_activities},
            {"key": "character_count", "label": "角色数量",
             "source": "characters", "collect": "IP 资产中心录入",
             "calc": "COUNT(characters WHERE ip_id = 当前IP)", "freq": "实时",
             "status": "manual"},
        ],
        "health": [
            {**HEAT_META, "status": _agg_status(
                cur, """SELECT m.source FROM character_daily_metrics m
                        JOIN characters c ON c.id=m.character_id WHERE c.ip_id=?""", (ip_id,))},
            {**ACTIVITY_META, "status": _agg_status(
                cur, "SELECT source FROM follower_history")},
            {**COMMERCIAL_META, "status": status_daily},
            {**SENTIMENT_META, "status": status_sent},
        ],
        "heat_trend": {"source": "character_daily_metrics", "collect": "角色讨论量采集派生",
                       "calc": "按日 SUM(discussions)，近30日", "freq": "每日", "status": status_daily},
        "user_growth": {"source": "follower_history", "collect": "metrics 每日累计派生",
                        "calc": "按日 SUM(followers)，近30日", "freq": "每日", "status": status_history},
        "platform_share": {"source": "metrics", "collect": "平台快照导入 / 每日采集",
                           "calc": "各平台最新快照 followers（相对占比）", "freq": "每日", "status": status_metrics},
        "character_rank": {"source": "character_daily_metrics", "collect": "角色讨论量采集派生（MediaCrawler 真实评论聚合）",
                           "calc": "近7日 AVG(discussions) 降序 Top", "freq": "每日", "status": status_daily},
        "sentiment": {"source": "sentiment_snapshots", "collect": "舆情采集/人工标注",
                      "calc": "最新快照 positive/neutral/negative 占比 + 关键词", "freq": "按快照更新", "status": status_sent},
        "risk": {"source": "supply_tasks / content_posts / requirements", "collect": "业务系统实时状态",
                 "calc": "逾期/空档/积压规则实时计算（非存储数据）", "freq": "实时", "status": "real"},
        "plan": {"source": "content_posts / supply_tasks / client_requirements / activities",
                 "collect": "各业务中心录入", "calc": "未来14日周期聚合", "freq": "实时", "status": status_content},
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
        "health": health,
        "health_basis": health_basis,
        "discussion_status": discussion_status,
        "heat_trend": heat_trend,
        "user_growth": growth,
        "platform_share": platforms,
        "character_rank": character_rank,
        "sentiment": sentiment,
        "meta": meta,
    }
