"""玄策 · 动态速报 pipeline 配置
搜索关键词 + SYSTEM_PROMPT（分析规则 + 玄机IP矩阵领域知识）
"""
import os
from pathlib import Path

# 项目根
ROOT = Path(__file__).parent.parent

# ============ 搜索配置 ============
# 追踪关键词（可增删；每个关键词会独立搜索）
SEARCH_KEYWORDS = [
    {"keyword": "玄机科技", "category": "company"},
    {"keyword": "玄机科技 IPO", "category": "ipo"},
    {"keyword": "秦时明月", "category": "ip"},
    {"keyword": "斗罗大陆 动画", "category": "ip"},
    {"keyword": "吞噬星空 动画", "category": "ip"},
    {"keyword": "牧神记 动画", "category": "ip"},
    {"keyword": "天行九歌 真人剧", "category": "ip"},
    {"keyword": "武庚纪", "category": "ip"},
]
SEARCH_RECENCY_DAYS = 7
SEARCH_MAX_RESULTS = 10

# 搜索 API：Tavily（免费1000次/月）。未设置 TAVILY_API_KEY 时用 mock
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")

# ============ 智谱 API ============
# 优先读 .env，其次读环境变量
def _load_env():
    env_path = ROOT / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

_load_env()
ZHIPU_API_KEY = os.getenv("VITE_ZHIPU_API_KEY", os.getenv("ZHIPUAI_API_KEY", ""))
# 默认用免费模型 glm-4-flash（glm-4.5 为付费模型，无余额会 429 欠费）
ZHIPU_MODEL = "glm-4-flash"
ZHIPU_BASE = "https://open.bigmodel.cn/api/paas/v4/chat/completions"

# ============ SYSTEM_PROMPT（灵魂：分析规则 + 领域知识） ============
SYSTEM_PROMPT = """你是玄机科技的资深IP运营分析师，为"国漫IP运营岗"面试备战服务。对每条搜索结果，严格按以下规则分析。

【领域知识 —— 玄机科技】
- 公司：杭州玄机科技，国漫头部动画公司
- IPO：正在北交所IPO，中信建投保荐，2026年8月3日提交首轮问询回复
- 财务（2025年）：营业收入4.01亿元(+26.5% YoY)，净利润显著提升，净利率提升
- 关键数据：腾讯系收入占比从76.7%降至50.6%（客户集中度优化，但仍是IPO问询焦点）；代工业务占比仍高，自营IP比例待提升
- 产品线：秦时明月（在运营）、斗罗大陆（动画IP，商业化强）、吞噬星空（科幻）、牧神记（B站9.7分高口碑新番）、天行九歌（真人剧开机，跨媒介）、武庚纪（经典）

【追踪IP矩阵】秦时明月 / 斗罗大陆 / 吞噬星空 / 牧神记 / 天行九歌 / 武庚纪 + 公司/IPO动态

【分析规则】
1. 去重：同一条新闻多来源合并
2. 分类 category ∈ {company, ipo, ip, strategy, industry}
3. 打分 score 1-5：
   - 5星：IPO重大进展 / 核心IP重大事件 / 财务数据变化（营收/利润/占比）
   - 4星：重要战略动作 / IP跨媒介 / 商业化合作
   - 3星：常规动态 / 行业趋势
   - 2星：边缘相关 / 旧新闻
   - 1星：无关（应过滤）
4. 提取数据：从snippet抠出关键数字（营收/利润/占比/播放量/评分/集数）
5. interview_value：从"IP运营面试"角度标记价值。例：
   - "IPO问询-腾讯系收入占比从76.7%降至50.6%，客户集中度优化"
   - "牧神记B站9.7分高口碑，新番成功案例"
   - "天行九歌真人剧开机，IP跨媒介战略落地"
6. 生成 interview_tip：面试话术建议，1-2句，如"若被问IP商业化，可提斗罗大陆衍生品带动周边销售"

【输出】严格输出JSON数组（不要markdown围栏），每项：
{"title":"标题","url":"链接","date":"日期","category":"分类","score":1-5,"summary":"60字摘要","data_points":"提取的关键数据","interview_value":"面试价值","interview_tip":"话术建议"}
"""

# ============ 输出目录 ============
OUTPUT_DIR = ROOT / "pipeline" / "output"
SEARCH_DIR = ROOT / "pipeline" / "search_results"
ANALYZED_DIR = ROOT / "pipeline" / "analyzed"

for d in [OUTPUT_DIR, SEARCH_DIR, ANALYZED_DIR]:
    d.mkdir(parents=True, exist_ok=True)
