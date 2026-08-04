"""二期能力占位：舆情采集 / 行业热点雷达"""
from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["stubs"])


@router.get("/sentiment/stub")
def sentiment_stub():
    return {
        "status": "planned",
        "phase": 2,
        "message": "二期将接入 Crawlee 模拟采集 B站/微博/社区舆情，生成情绪比例与风险预警。",
        "preview": {
            "positive": 62,
            "neutral": 28,
            "negative": 10,
            "keywords": ["角色成长", "水墨美学", "更新频率"],
        },
    }


@router.get("/radar/stub")
def radar_stub():
    return {
        "status": "planned",
        "phase": 2,
        "message": "二期将包装已有 TrendRadar 为 IP 行业热点雷达，并推送飞书日报。",
        "preview": {
            "sources": ["国漫新闻", "游戏行业", "IP联名"],
            "push_channel": "飞书",
        },
    }
