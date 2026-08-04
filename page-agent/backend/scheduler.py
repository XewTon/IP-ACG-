"""
定时任务调度器 —— 使用 APScheduler 管理每日数据采集
"""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime

scheduler = AsyncIOScheduler()


def init_scheduler(collect_all_func):
    """初始化定时任务：每天 10:00 自动采集全平台数据"""
    scheduler.add_job(
        collect_all_func,
        trigger=CronTrigger(hour=10, minute=0),
        id="daily_collect",
        name="每日数据采集",
        replace_existing=True,
    )
    scheduler.start()
    print(f"[{datetime.now()}] Scheduler started — daily collect at 10:00")


def stop_scheduler():
    scheduler.shutdown(wait=False)
