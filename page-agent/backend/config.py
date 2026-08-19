import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_PATH = os.path.join(BASE_DIR, "page_agent.db")

# 采集配置
COLLECTOR_RETRY = 3
COLLECTOR_TIMEOUT = 30_000  # Playwright 超时(ms)
COLLECTOR_HEADLESS = True   # 无头模式

# 定时任务
DAILY_COLLECT_HOUR = 10
DAILY_COLLECT_MINUTE = 0

# 平台账号（模拟/真实）
PLATFORM_ACCOUNTS = {
    "bilibili": {
        "name": "玄策_Bilibili",
        "uid": "mock_uid_bilibili",
    },
    "weibo": {
        "name": "玄策official",
        "uid": "mock_uid_weibo",
    },
    "xiaohongshu": {
        "name": "玄策小红书",
        "uid": "mock_uid_xhs",
    },
    "wechat": {
        "name": "玄策公众号",
        "uid": "mock_uid_wechat",
    },
}

# 竞品账号
COMPETITOR_ACCOUNTS = [
    {"platform": "bilibili", "name": "某B-都市灵异", "uid": "comp_b_001"},
    {"platform": "weibo", "name": "某A-古风志怪", "uid": "comp_w_001"},
    {"platform": "xiaohongshu", "name": "某C-赛博修仙", "uid": "comp_x_001"},
]
