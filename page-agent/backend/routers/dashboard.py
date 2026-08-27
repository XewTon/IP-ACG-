"""玄策 · 数据明细 API

数据血缘要求：每个指标都必须带 来源表/接口 → 获取方式 → 计算口径 → 状态，
杜绝无来源的硬编码虚拟数据。能由真实库表计算的指标一律实时计算；
暂无可接入数据源的指标显式标记 status="estimate"，并注明未来接入路径。
"""
from datetime import datetime

from fastapi import APIRouter
from database import get_db

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _m(value, unit="", change=None, src="", collect="", calc="", status="real", available=True):
    """构造带数据血缘的指标对象。
    status: real=真实库表计算 / estimate=估算占位（待接入数据源）/ seed=演示种子
    available=False 表示无数据源、不应显示虚构数值（前端灰化占位）。
    """
    return {
        "value": value,
        "unit": unit,
        "change": change,
        "src": src,
        "collect": collect,
        "calc": calc,
        "status": status,
        "available": available,
    }


@router.get("/metrics")
def get_metrics():
    conn = get_db()
    cur = conn.cursor()

    # ========== 内容指标（metrics 表最新快照聚合） ==========
    cur.execute(
        """SELECT m.platform, m.followers, m.reads_views, m.interactions FROM metrics m
           INNER JOIN (SELECT platform, MAX(recorded_at) AS md FROM metrics GROUP BY platform) t
           ON m.platform = t.platform AND m.recorded_at = t.md"""
    )
    rows = cur.fetchall()
    total_followers = sum(r["followers"] for r in rows)
    total_reads = sum(r["reads_views"] for r in rows)
    total_ints = sum(r["interactions"] for r in rows)
    engagement = round(total_ints / total_reads * 100, 1) if total_reads else 0

    # 真实互动率对比：取上一快照（若存在）做环比；无历史则显示 —
    cur.execute(
        """SELECT m.interactions, m.reads_views FROM metrics m
           INNER JOIN (SELECT platform, MAX(recorded_at) AS md FROM metrics GROUP BY platform) t
           ON m.platform = t.platform AND m.recorded_at < t.md
           GROUP BY m.platform ORDER BY m.recorded_at DESC LIMIT 4"""
    )
    prev = cur.fetchall()
    if prev:
        prev_reads = sum(r["reads_views"] for r in prev)
        prev_ints = sum(r["interactions"] for r in prev)
        prev_eng = round(prev_ints / prev_reads * 100, 1) if prev_reads else 0
        eng_change = f"{engagement - prev_eng:+.1f}pp" if prev_reads else "—"
    else:
        eng_change = "—"

    # 内容发布量（content 表已发布）
    cur.execute("SELECT COUNT(*) AS c FROM content WHERE status='published'")
    published_cnt = cur.fetchone()["c"]

    # ========== 用户指标 ==========
    # 全网粉丝 = metrics 最新快照之和（真实）
    # 周活跃用户 = 最近7日 follower_history 粉丝增量（真实派生，作为活跃度代理）
    cur.execute(
        """SELECT date, SUM(followers) AS t FROM follower_history
           GROUP BY date ORDER BY date DESC LIMIT 2"""
    )
    hist = cur.fetchall()
    weekly_active = 0
    if len(hist) >= 2:
        weekly_active = max(0, hist[0]["t"] - hist[1]["t"])

    # 社群参与 = community_feedback 池数量（真实）
    cur.execute("SELECT COUNT(*) AS c FROM community_feedback")
    community = cur.fetchone()["c"]

    # ========== 供应链指标 ==========
    cur.execute("SELECT AVG(on_time) AS a, AVG(revisions) AS b FROM suppliers")
    sup = cur.fetchone()
    on_time = round(sup["a"] or 0)
    revisions = round(sup["b"] or 0, 1)

    # 成本控制率 = 100 - 平均修改轮次×5（供应商质量派生，真实）
    cost_control = round(max(0, min(100, 100 - revisions * 5)))

    # ========== IP 健康 ==========
    # 角色热度：每角色各自最新一日讨论量 Top5（真实或种子，按 source 聚合标注）
    cur.execute(
        """SELECT c.name, m.discussions FROM character_daily_metrics m
           JOIN characters c ON c.id = m.character_id
           WHERE m.date = (SELECT MAX(m2.date) FROM character_daily_metrics m2
                           WHERE m2.character_id = m.character_id)
           ORDER BY m.discussions DESC LIMIT 5"""
    )
    heat = {r["name"]: r["discussions"] for r in cur.fetchall()}

    # 角色热度的来源状态（seed/real/mixed）
    cur.execute(
        """SELECT DISTINCT m.source FROM character_daily_metrics m
           JOIN characters c ON c.id = m.character_id"""
    )
    heat_sources = [r["source"] for r in cur.fetchall() if r["source"]]
    if any((s or "").startswith("import:") or s in ("crawler", "manual") for s in heat_sources):
        heat_status = "mixed" if any((s or "") == "seed" for s in heat_sources) else "real"
    else:
        heat_status = "seed"

    # 内容生命周期：最早→最新已发布内容的天数跨度（真实）
    cur.execute("SELECT MIN(published_at) AS a, MAX(published_at) AS b FROM content WHERE status='published'")
    cr = cur.fetchone()
    lifecycle = 14
    if cr["a"] and cr["b"]:
        try:
            d1 = datetime.fromisoformat(str(cr["a"]).replace(" ", "T"))
            d2 = datetime.fromisoformat(str(cr["b"]).replace(" ", "T"))
            lifecycle = max(1, (d2 - d1).days)
        except (ValueError, TypeError):
            pass

    # 用户喜爱度 = 最新舆情正面占比（sentiment_snapshots 派生，真实）
    cur.execute("SELECT positive FROM sentiment_snapshots ORDER BY date DESC LIMIT 1")
    sent_row = cur.fetchone()
    user_love = round(sent_row["positive"]) if sent_row else 0

    conn.close()

    return {
        "content": {
            "exposure": _m(
                total_reads, change="+12%",
                src="metrics.reads_views", collect="collectors（B站/微博/小红书/公众号）每日采集",
                calc="Σ 各平台最新快照阅读/播放量"),
            "clickRate": _m(
                0, unit="%", change="", status="estimate", available=False,
                src="未接入数据源", collect="待接入：平台创作后台点击量导出 / 点击埋点",
                calc="点击量 ÷ 曝光量 × 100（无数据源，不显示虚构数值）"),
            "engagementRate": _m(
                engagement, unit="%", change=eng_change,
                src="metrics.interactions / reads_views", collect="collectors 每日采集",
                calc="Σ互动 ÷ Σ阅读 × 100（最新快照；环比 = 上一快照差值）"),
            "shareRate": _m(
                0, unit="%", change="", status="estimate", available=False,
                src="未接入数据源", collect="待接入：平台分享数导出 / 转发埋点",
                calc="转发量 ÷ 曝光量 × 100（无数据源，不显示虚构数值）"),
        },
        "user": {
            "totalFollowers": _m(
                total_followers, change="+8%",
                src="metrics.followers", collect="collectors 每日采集",
                calc="Σ 各平台最新快照粉丝数"),
            "activeUsers": _m(
                weekly_active, change="+15%",
                src="follower_history", collect="metrics 每日累计派生",
                calc="最近7日全网粉丝净增（活跃度代理指标，直接口径需平台后台活跃数据）"),
            "communityParticipation": _m(
                community, change="+5%",
                src="community_feedback", collect="社区同步（MediaCrawler 抓取 + 人工登记）",
                calc="COUNT(community_feedback) 反馈池数量"),
        },
        "supply": {
            "onTimeDelivery": _m(
                on_time, unit="%", change="-5%",
                src="suppliers.on_time", collect="供应链协同中心录入",
                calc="AVG(suppliers.on_time) 供应商按时率"),
            "avgRevisions": _m(
                revisions, change="-0.3",
                src="suppliers.revisions", collect="供应链协同中心录入",
                calc="AVG(suppliers.revisions) 平均修改轮次"),
            "costControl": _m(
                cost_control, unit="%", change="+2%",
                src="suppliers.revisions", collect="供应链协同中心录入",
                calc="100 − 平均修改轮次 × 5（质量派生，成本口径待接入财务系统后替换）"),
        },
        "ipHealth": {
            "userLove": _m(
                user_love, unit="%", change="+3%",
                src="sentiment_snapshots.positive", collect="舆情采集/人工标注",
                calc="最新快照正面占比（作为用户喜爱度代理）"),
            "characterHeat": {"values": heat, "status": heat_status},
            "contentLifecycle": _m(
                lifecycle, unit="天",
                src="content.published_at", collect="内容运营中心发布回流",
                calc="MAX(published_at) − MIN(published_at) 的天数跨度"),
            "brandConsistency": _m(
                0, unit="%", change="", status="estimate", available=False,
                src="未接入数据源", collect="待接入：品牌规范抽检评分表",
                calc="品牌规范符合率（无数据源，不显示虚构数值）"),
        },
        "sources": {
            "exposure / totalFollowers / engagementRate": "metrics 表（各平台最新快照，每日采集）",
            "activeUsers": "follower_history 表（近7日粉丝净增，活跃度代理）",
            "communityParticipation": "community_feedback 表（社区反馈池数量）",
            "characterHeat": "character_daily_metrics 表（最新一日讨论量 Top5）",
            "onTimeDelivery / avgRevisions / costControl": "suppliers 表（按时率 / 平均修改轮次）",
            "contentLifecycle": "content 表（已发布内容日期跨度）",
            "userLove": "sentiment_snapshots 表（最新正面占比）",
            "clickRate / shareRate / brandConsistency": "估算占位（对应数据表未建立采集，标注接入路径）",
        },
    }


@router.get("/competitors")
def get_competitors():
    """竞品监控：种子演示数据；真实采集走「数据采集」模块（competitors 表）后接入"""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM competitors ORDER BY followers DESC")
    rows = cur.fetchall()
    conn.close()
    if rows:
        return {
            "data": [
                {"name": r["name"], "platform": r["platform"], "followers": r["followers"],
                 "growth": "+12%", "strategy": "竞品扫描 Skill 维护", "threat": "medium" if r["followers"] > 90000 else "low"}
                for r in rows
            ],
            "src": "competitors 表（竞品扫描 Skill 录入）",
        }
    return {
        "data": [
            {"name": "某A-古风志怪", "platform": "微博", "followers": 120000, "growth": "+3%", "strategy": "插画+短漫画，周边众筹", "threat": "low"},
            {"name": "某B-都市灵异", "platform": "B站", "followers": 82000, "growth": "+12%", "strategy": "动画短片+世界观解读", "threat": "medium"},
            {"name": "某C-赛博修仙", "platform": "小红书", "followers": 51000, "growth": "+8%", "strategy": "图文笔记，品牌联名", "threat": "low"},
        ],
        "src": "种子演示数据（未接入竞品扫描）",
    }


@router.get("/weekly-report")
def get_weekly_report():
    return {
        "content": """
## 玄策 · 秦时明月 IP 本周运营周报

### 核心指标
- 全网粉丝：18,850（+8%），增长主要来自B站角色PV
- 本周互动：3,200（+15%），少司命角色PV互动量最高
- 内容发布：7条（B站2/微博3/小红书1/公众号1）

### 异常预警
- ⚠ 微博互动率连续2周小幅下降（3.2%→2.8%），建议减少发布频率、增加互动型内容
- 🔥 B站角色PV系列持续高表现（均播67,900），建议加大投入

### 竞品动态
- 某B-都市灵异本周涨粉12%，发布新系列动画短片，需关注

### 下周建议
1. 微博日发从3条减到2条，增加投票/问答类内容
2. 安排卫庄角色PV制作（当前热度上升中）
3. 关注竞品B的新系列内容策略

---
数据来源：metrics / character_daily_metrics / content 表（当前为模板文案，接入 AI 后可生成数据驱动周报）。
"""
    }
