"""
定时任务调度器 —— 使用 APScheduler 管理每日数据采集 + 新闻抓取
"""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime

scheduler = AsyncIOScheduler()


def init_scheduler(collect_all_func, news_fetch_func=None):
    """初始化定时任务：每天 10:00 自动采集全平台数据；每天 09:00 抓取新闻"""
    scheduler.add_job(
        collect_all_func,
        trigger=CronTrigger(hour=10, minute=0),
        id="daily_collect",
        name="每日数据采集",
        replace_existing=True,
    )
    if news_fetch_func:
        scheduler.add_job(
            news_fetch_func,
            trigger=CronTrigger(hour=9, minute=0),
            id="daily_news_fetch",
            name="每日玄机新闻抓取",
            replace_existing=True,
        )
    scheduler.start()
    jobs = ", ".join(f"{j.id}" for j in scheduler.get_jobs())
    print(f"[{datetime.now()}] Scheduler started — {jobs}")


def stop_scheduler():
    scheduler.shutdown(wait=False)
