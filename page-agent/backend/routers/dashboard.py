"""玄策 · 数据明细 API —— 指标尽量取真实库表，附单位与来源标注"""
from datetime import datetime

from fastapi import APIRouter
from database import get_db

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/metrics")
def get_metrics():
    conn = get_db()
    cur = conn.cursor()

    # 各平台最新快照（metrics 表）
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

    # 角色热度：每角色各自最新一日讨论量 Top5（character_daily_metrics 表）
    cur.execute(
        """SELECT c.name, m.discussions FROM character_daily_metrics m
           JOIN characters c ON c.id = m.character_id
           WHERE m.date = (SELECT MAX(m2.date) FROM character_daily_metrics m2
                           WHERE m2.character_id = m.character_id)
           ORDER BY m.discussions DESC LIMIT 5"""
    )
    heat = {r["name"]: r["discussions"] for r in cur.fetchall()}

    # 供应商均值（suppliers 表）
    cur.execute("SELECT AVG(on_time) AS a, AVG(revisions) AS b FROM suppliers")
    sup = cur.fetchone()
    on_time = round(sup["a"] or 0)
    revisions = round(sup["b"] or 0, 1)

    # 社区反馈数（community_feedback 表）
    cur.execute("SELECT COUNT(*) AS c FROM community_feedback")
    community = cur.fetchone()["c"]

    # 内容生命周期：最早→最新已发布内容的天数跨度（content 表）
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
    conn.close()

    return {
        "content": {
            "exposure": {"value": total_reads, "change": "+12%", "unit": ""},
            "clickRate": {"value": 4.8, "change": "+0.3%", "unit": "%"},
            "engagementRate": {"value": engagement, "change": "-0.5%", "unit": "%"},
            "shareRate": {"value": 1.8, "change": "+0.2%", "unit": "%"},
        },
        "user": {
            "totalFollowers": {"value": total_followers, "change": "+8%", "unit": ""},
            "activeUsers": {"value": 3200, "change": "+15%", "unit": ""},
            "communityParticipation": {"value": community, "change": "+5%", "unit": ""},
        },
        "supply": {
            "onTimeDelivery": {"value": on_time, "change": "-5%", "unit": "%"},
            "avgRevisions": {"value": revisions, "change": "-0.3", "unit": ""},
            "costControl": {"value": 92, "change": "+2%", "unit": "%"},
        },
        "ipHealth": {
            "userLove": {"value": 78, "change": "+3%", "unit": "%"},
            "characterHeat": heat,
            "contentLifecycle": {"value": lifecycle, "unit": "天"},
            "brandConsistency": {"value": 94, "change": "+1%", "unit": "%"},
        },
        "sources": {
            "exposure / totalFollowers / engagementRate": "metrics 表（各平台最新快照，每日采集）",
            "communityParticipation": "community_feedback 表（社区反馈池数量）",
            "characterHeat": "character_daily_metrics 表（最新一日讨论量 Top5）",
            "onTimeDelivery / avgRevisions": "suppliers 表（按时率 / 平均修改轮次）",
            "contentLifecycle": "content 表（已发布内容日期跨度）",
            "clickRate / shareRate / activeUsers / userLove / brandConsistency / costControl": "估算占位（对应数据表未建立采集）",
        },
    }


@router.get("/competitors")
def get_competitors():
    """竞品监控（种子演示数据；真实采集走「数据采集」模块后接入）"""
    return {
        "data": [
            {"name": "某A-古风志怪", "platform": "微博", "followers": 120000, "growth": "+3%", "strategy": "插画+短漫画，周边众筹", "threat": "low"},
            {"name": "某B-都市灵异", "platform": "B站", "followers": 82000, "growth": "+12%", "strategy": "动画短片+世界观解读", "threat": "medium"},
            {"name": "某C-赛博修仙", "platform": "小红书", "followers": 51000, "growth": "+8%", "strategy": "图文笔记，品牌联名", "threat": "low"},
        ]
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
