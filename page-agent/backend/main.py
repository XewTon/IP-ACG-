"""
玄策 · 国漫IP智能运营中心 — FastAPI 主入口
决策闭环：驾驶舱 / IP资产 / 角色分析 / AI运营助手
"""
import json
from datetime import date, datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from routers.agent import router as agent_router
from routers.postiz import router as postiz_router
from routers.dashboard import router as dashboard_router
from routers.cockpit import router as cockpit_router
from routers.ip_assets import router as ip_router, current_ip_router
from routers.ops_agent import router as ops_agent_router
from routers.stubs import router as stubs_router
from routers.supply import router as supply_router
from routers.community import router as community_router

from database import get_db, init_db
from seed_data import seed
from models import ContentItem, CollectorTrigger
from reporter import generate_daily_report, generate_weekly_report
from scheduler import init_scheduler, stop_scheduler

from collectors.bilibili import BilibiliCollector
from collectors.weibo import WeiboCollector
from collectors.xiaohongshu import XiaohongshuCollector

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


COLLECTORS = {
    "bilibili": BilibiliCollector(),
    "weibo": WeiboCollector(),
    "xiaohongshu": XiaohongshuCollector(),
}


async def collect_all_platforms():
    """采集所有平台数据"""
    results = []
    for name, collector in COLLECTORS.items():
        uid = f"mock_uid_{name}"
        result = await collector.collect_with_fallback(uid)
        result["platform"] = name

        # 存入数据库
        conn = get_db()
        cursor = conn.cursor()
        today = date.today().isoformat()
        cursor.execute(
            """INSERT OR REPLACE INTO metrics (platform, followers, reads_views, interactions, engagement_rate, top_content, recorded_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (name, result["followers"], result["reads_views"], result["interactions"], 0.0, "[]", today),
        )
        cursor.execute(
            "INSERT OR REPLACE INTO follower_history (date, platform, followers) VALUES (?, ?, ?)",
            (today, name, result["followers"]),
        )
        conn.commit()
        conn.close()

        await collector.close_browser()
        results.append(result)
    return results


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as cnt FROM metrics")
    metrics_count = cursor.fetchone()["cnt"]
    try:
        cursor.execute("SELECT COUNT(*) as cnt FROM ips")
        ip_count = cursor.fetchone()["cnt"]
    except Exception:
        ip_count = 0
    conn.close()

    if metrics_count == 0 or ip_count == 0:
        seed()
        print("[Startup] Seed data loaded (metrics/IP assets).")
    else:
        print(f"[Startup] Database ready — {metrics_count} metrics, {ip_count} IPs.")

    try:
        from ai.rag import build_index
        mode = build_index()
        print(f"[Startup] Knowledge index mode: {mode}")
    except Exception as e:
        print(f"[Startup] Knowledge index skipped: {e}")

    init_scheduler(collect_all_platforms)

    yield

    stop_scheduler()
    for collector in COLLECTORS.values():
        await collector.close_browser()


app = FastAPI(
    title="玄策 XuanCe API",
    description="国漫IP智能运营中心 —— 驾驶舱 / 资产 / 角色分析 / AI运营助手",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agent_router)
app.include_router(postiz_router)
app.include_router(dashboard_router)
app.include_router(cockpit_router)
app.include_router(ip_router)
app.include_router(current_ip_router)
app.include_router(ops_agent_router)
app.include_router(stubs_router)
app.include_router(supply_router)
app.include_router(community_router)


# ==================== Dashboard ====================

@app.get("/api/dashboard")
def get_dashboard():
    """获取数据看板总览"""
    conn = get_db()
    cursor = conn.cursor()
    today = date.today().isoformat()

    # 各平台最新指标
    cursor.execute(
        """SELECT m.platform, m.followers, m.reads_views, m.interactions,
                  m.engagement_rate, m.top_content, m.recorded_at
           FROM metrics m
           INNER JOIN (
               SELECT platform, MAX(recorded_at) as max_date FROM metrics GROUP BY platform
           ) latest ON m.platform = latest.platform AND m.recorded_at = latest.max_date"""
    )
    platform_rows = cursor.fetchall()

    total_followers = 0
    total_interactions = 0
    total_reads = 0
    platforms = []

    for r in platform_rows:
        platforms.append({
            "platform": r["platform"],
            "followers": r["followers"],
            "reads_views": r["reads_views"],
            "interactions": r["interactions"],
            "engagement_rate": r["engagement_rate"],
            "top_content": json.loads(r["top_content"] or "[]"),
            "recorded_at": r["recorded_at"],
        })
        total_followers += r["followers"]
        total_interactions += r["interactions"]
        total_reads += r["reads_views"]

    # 昨日新增粉丝
    yesterday = (date.today() + date.resolution).isoformat() if False else today
    cursor.execute(
        "SELECT SUM(followers) as total FROM follower_history WHERE date = (SELECT MAX(date) FROM follower_history)"
    )
    latest_total = cursor.fetchone()["total"] or total_followers

    # 内容发布数
    cursor.execute("SELECT COUNT(*) as cnt FROM content WHERE status = 'published'")
    published_count = cursor.fetchone()["cnt"]

    # 粉丝趋势（近30天，取每周数据点）
    cursor.execute(
        """SELECT date, platform, followers FROM follower_history
           WHERE date >= date('now', '-30 days') ORDER BY date"""
    )
    trend_rows = cursor.fetchall()

    # 聚合为前端图表格式
    trend_dates = sorted(set(r["date"] for r in trend_rows))[-30:]
    follower_trend = []
    for d in trend_dates:
        point = {"date": d}
        for r in trend_rows:
            if r["date"] == d:
                point[r["platform"]] = r["followers"]
        follower_trend.append(point)

    conn.close()

    return {
        "total_followers": total_followers,
        "daily_new_followers": max(0, total_followers - (latest_total - total_followers) // 30),
        "daily_interactions": total_interactions,
        "content_published": published_count,
        "platforms": platforms,
        "follower_trend": follower_trend[-14:],  # 近14天
    }


# ==================== Platform Metrics ====================

@app.get("/api/platforms/{platform}/metrics")
def get_platform_metrics(platform: str, days: int = Query(default=7, ge=1, le=90)):
    """获取单平台历史指标"""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        """SELECT date, followers FROM follower_history
           WHERE platform = ? AND date >= date('now', ?) ORDER BY date""",
        (platform, f"-{days} days"),
    )
    rows = cursor.fetchall()

    # 最新快照
    cursor.execute(
        """SELECT * FROM metrics WHERE platform = ? ORDER BY recorded_at DESC LIMIT 1""",
        (platform,),
    )
    latest = cursor.fetchone()
    conn.close()

    return {
        "platform": platform,
        "latest": dict(latest) if latest else None,
        "history": [{"date": r["date"], "followers": r["followers"]} for r in rows],
    }


# ==================== Competitors ====================

@app.get("/api/competitors")
def get_competitors():
    """获取竞品列表"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM competitors ORDER BY platform")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/competitors")
def add_competitor(comp: dict):
    """添加竞品账号"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO competitors (platform, name, uid, followers, content_count, avg_engagement, last_updated)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (comp["platform"], comp["name"], comp["uid"], comp.get("followers", 0),
         comp.get("content_count", 0), comp.get("avg_engagement", 0), date.today().isoformat()),
    )
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return {"id": new_id, "message": "竞品添加成功"}


@app.delete("/api/competitors/{comp_id}")
def delete_competitor(comp_id: int):
    """删除竞品"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM competitors WHERE id = ?", (comp_id,))
    conn.commit()
    conn.close()
    return {"message": "竞品已删除"}


# ==================== Content ====================

@app.get("/api/contents")
def get_contents(status: str = Query(default=None), platform: str = Query(default=None)):
    """获取内容列表"""
    conn = get_db()
    cursor = conn.cursor()
    query = "SELECT * FROM content WHERE 1=1"
    params = []
    if status:
        query += " AND status = ?"
        params.append(status)
    if platform:
        query += " AND platform = ?"
        params.append(platform)
    query += " ORDER BY COALESCE(published_at, scheduled_at) DESC LIMIT 50"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/contents/schedule")
def schedule_content(item: ContentItem):
    """创建定时发布任务"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO content (platform, title, content_type, scheduled_at, status)
           VALUES (?, ?, ?, ?, 'scheduled')""",
        (item.platform, item.title, item.content_type, item.scheduled_at),
    )
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return {"id": new_id, "message": "定时发布已创建"}


@app.put("/api/contents/{content_id}/status")
def update_content_status(content_id: int, status: str = Query(...)):
    """更新内容状态"""
    valid_statuses = {"draft", "scheduled", "published", "failed"}
    if status not in valid_statuses:
        raise HTTPException(400, f"Invalid status. Must be one of {valid_statuses}")

    conn = get_db()
    cursor = conn.cursor()
    updates = {"status": status}
    if status == "published":
        from datetime import datetime
        updates["published_at"] = datetime.now().isoformat()
    cursor.execute(
        f"UPDATE content SET {', '.join(f'{k} = ?' for k in updates)} WHERE id = ?",
        (*updates.values(), content_id),
    )
    conn.commit()
    conn.close()
    return {"message": f"内容状态已更新为 {status}"}


# ==================== Collectors ====================

@app.post("/api/collectors/trigger")
async def trigger_collector(trigger: CollectorTrigger = None):
    """手动触发数据采集"""
    platform_name = trigger.platform if trigger and trigger.platform else None

    if platform_name and platform_name in COLLECTORS:
        collector = COLLECTORS[platform_name]
        result = await collector.collect_with_fallback(f"mock_uid_{platform_name}")
        result["platform"] = platform_name
        await collector.close_browser()
        return {"results": [result]}

    # 全平台采集
    results = await collect_all_platforms()
    return {"results": results}


# ==================== Reports ====================

@app.get("/api/reports/daily")
def get_daily_report():
    """获取每日数据简报"""
    report = generate_daily_report()
    return {"format": "markdown", "content": report}


@app.get("/api/reports/weekly")
def get_weekly_report():
    """获取每周数据周报"""
    report = generate_weekly_report()
    return {"format": "markdown", "content": report}


# ==================== Health ====================

@app.get("/api/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
