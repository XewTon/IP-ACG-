"""九歌 · 数据仪表盘 API"""
from fastapi import APIRouter

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

@router.get("/metrics")
def get_metrics():
    return {
        "content": {
            "exposure": {"value": 286000, "change": "+12%"},
            "clickRate": {"value": 4.8, "change": "+0.3%"},
            "engagementRate": {"value": 5.2, "change": "-0.5%"},
            "shareRate": {"value": 1.8, "change": "+0.2%"},
        },
        "user": {
            "totalFollowers": {"value": 18850, "change": "+8%"},
            "activeUsers": {"value": 3200, "change": "+15%"},
            "communityParticipation": {"value": 680, "change": "+5%"},
        },
        "supply": {
            "onTimeDelivery": {"value": 85, "change": "-5%"},
            "avgRevisions": {"value": 1.8, "change": "-0.3"},
            "costControl": {"value": 92, "change": "+2%"},
        },
        "ipHealth": {
            "userLove": {"value": 78, "change": "+3%"},
            "characterHeat": {"沈砚": 45, "林疏影": 38, "老白": 25},
            "contentLifecycle": {"value": 14, "unit": "天"},
            "brandConsistency": {"value": 94, "change": "+1%"},
        },
    }

@router.get("/competitors")
def get_competitors():
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
## 玄策 · 九歌 IP 本周运营周报

### 核心指标
- 全网粉丝：18,850（+8%），增长主要来自B站角色PV
- 本周互动：3,200（+15%），林疏影角色PV互动量最高
- 内容发布：7条（B站2/微博3/小红书1/公众号1）

### 异常预警
- ⚠ 微博互动率连续2周小幅下降（3.2%→2.8%），建议减少发布频率、增加互动型内容
- 🔥 B站角色PV系列持续高表现（均播67,900），建议加大投入

### 竞品动态
- 某B-都市灵异本周涨粉12%，发布新系列动画短片，需关注

### 下周建议
1. 微博日发从3条减到2条，增加投票/问答类内容
2. 安排老白角色PV制作（当前热度上升中）
3. 关注竞品B的新系列内容策略
"""
    }
