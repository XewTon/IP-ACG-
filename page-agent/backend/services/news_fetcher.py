"""
玄策 · 动态知识库抓取器
搜索API(Tavily/Bing) → 原始数据 → 智谱4.5 LLM分析 → 结构化JSON入库

无 API key 时降级 mock 数据。生产环境替换为真实 Tavily/Bing + Zhipu 调用。
"""
import json
import os
import urllib.request
from datetime import datetime, date

# ============ 智谱 API 配置 ============
ZHIPU_CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "zhipu_config.json")

def read_zhipu_config() -> dict:
    try:
        with open(ZHIPU_CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"apiKey": "", "model": "glm-4.5"}

def write_zhipu_config(cfg: dict) -> None:
    with open(ZHIPU_CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)

# ============ SYSTEM PROMPT（灵魂：玄机IP矩阵 + 面试场景分析规则） ============
SYSTEM_PROMPT = """你是玄机科技的IP运营分析师。对每条新闻，按以下规则分析：

【追踪IP矩阵】
- 秦时明月（在运营，B站正片）
- 斗罗大陆（动画IP，商业化强）
- 吞噬星空（科幻动画）
- 牧神记（B站9.7分高口碑新番）
- 天行九歌（真人剧开机，跨媒介）
- 武庚纪（经典IP）
- 公司动态（IPO/营收/股权/战略）

【分类 category】: company | ipo | ip | industry | strategy

【打分 score 1-5】:
- 5星：IPO重大进展 / 核心IP重大事件 / 财务数据变化
- 4星：重要战略动作 / IP跨媒介进展
- 3星：常规动态 / 行业趋势
- 2星：边缘相关
- 1星：无关

【提取 interview_value】: 从"IP运营面试"角度标注，如"IPO问询-腾讯系收入占比从76.7%降至50.6%，客户集中度优化""牧神记B站9.7分高口碑，新番成功案例"

【输出JSON数组，每项】:
{"title": "标题", "url": "链接", "summary": "80字内摘要", "category": "分类", "score": 分数, "interview_value": "面试价值"}
"""

# ============ 搜索层（mock 降级） ============
MOCK_RESULTS = [
    {"title": "玄机科技回复北交所首轮问询：腾讯系收入占比降至50.6%", "url": "https://example.com/xuanji-ipo-1",
     "content": "玄机科技披露首轮问询回复，2025年营业收入4.01亿元，同比增长26.5%，腾讯系收入占比从76.7%降至50.6%，客户集中度优化。", "published_date": "2026-08-10"},
    {"title": "《天行九歌》真人剧官宣开机，玄机科技IP跨媒介布局提速", "url": "https://example.com/tianxingjiuge-drama",
     "content": "天行九歌真人剧正式开机，玄机科技从动画IP向真人影视延伸，IP全链路商业化战略进一步落地。", "published_date": "2026-08-09"},
    {"title": "《牧神记》B站评分9.7，玄机新番口碑与热度双丰收", "url": "https://example.com/mushenji-bili",
     "content": "牧神记动画在B站收获9.7高分，成为玄机科技又一口碑与热度兼备的原创IP。", "published_date": "2026-08-08"},
    {"title": "秦时明月IP联动新动作：与国潮品牌推出联名系列", "url": "https://example.com/qinshiliangyu-link",
     "content": "秦时明月与国潮品牌推出联名系列，深化IP商业化与Z世代用户触达。", "published_date": "2026-08-07"},
    {"title": "斗罗大陆动画年度播放数据公布，衍生品带动周边销售", "url": "https://example.com/douluo-data",
     "content": "斗罗大陆动画年度播放数据亮眼，衍生品销售带动IP商业化增长。", "published_date": "2026-08-06"},
]

def fetch_raw(keyword: str, limit: int = 8) -> list[dict]:
    """
    调搜索API获取原始数据。生产环境替换为：
    from tavily import TavilyClient
    client = TavilyClient(api_key=TAVILY_KEY)
    result = client.search(query=keyword, topic="news", days=3, max_results=limit)
    return result["results"]
    """
    # 无 TAVILY_API_KEY 时用 mock
    if not os.getenv("TAVILY_API_KEY"):
        # 按关键词过滤 mock（简单模拟）
        return [dict(r) for r in MOCK_RESULTS if keyword in r["title"] + r["content"]] or MOCK_RESULTS[:limit]
    try:
        import tavily  # type: ignore
        client = tavily.TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
        result = client.search(query=keyword, topic="news", days=3, max_results=limit, timeout=15)
        return [
            {"title": i.get("title", ""), "url": i.get("url", ""),
             "content": i.get("content", ""), "published_date": i.get("published_date", "")}
            for i in result.get("results", [])
        ]
    except Exception:
        return MOCK_RESULTS[:limit]

# ============ LLM 分析层（智谱4.5） ============
def analyze_with_llm(items: list[dict], keyword: str) -> list[dict]:
    """
    调智谱4.5 GLM 分析原始数据。无 key 时降级简单规则分析。
    生产环境替换为 ZhipuAI SDK：
    from zhipuai import ZhipuAI
    client = ZhipuAI(api_key=ZHIPU_KEY)
    resp = client.chat.completions.create(model="glm-4.5", messages=[...])
    """
    cfg = read_zhipu_config()
    if not cfg.get("apiKey"):
        # 降级：关键词规则打分
        return _rule_analyze(items, keyword)

    try:
        prompt = f"关键词：{keyword}\n\n新闻列表(JSON)：\n{json.dumps(items, ensure_ascii=False)}"
        payload = {
            "model": cfg.get("model", "glm-4.5"),
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.4,
        }
        req = urllib.request.Request(
            "https://open.bigmodel.cn/api/paas/v4/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json",
                     "Authorization": f"Bearer {cfg['apiKey']}"},
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        content = data["choices"][0]["message"]["content"]
        # 解析 JSON（容错：去掉可能的 markdown 围栏）
        content = content.strip().strip("`").strip("json").strip()
        analyzed = json.loads(content)
        if isinstance(analyzed, dict):
            analyzed = analyzed.get("items", [])
        return analyzed
    except Exception as e:
        print(f"[news] LLM analyze failed, fallback to rules: {e}")
        return _rule_analyze(items, keyword)


def _rule_analyze(items: list[dict], keyword: str) -> list[dict]:
    """无 API key 降级：关键词匹配打分"""
    result = []
    for it in items:
        text = it.get("title", "") + it.get("content", "")
        score = 3
        cat = "ip"
        if any(k in text for k in ["IPO", "问询", "营收", "股权", "财务"]):
            score, cat = 5, "ipo"
        elif any(k in text for k in ["联名", "衍生", "商业化", "周边"]):
            score, cat = 4, "strategy"
        elif any(k in text for k in ["开机", "真人剧", "动画电影"]):
            score, cat = 4, "ip"
        result.append({
            "title": it.get("title", ""),
            "url": it.get("url", ""),
            "summary": (it.get("content", "") or "")[:80],
            "category": cat,
            "score": score,
            "interview_value": f"[{keyword}] {it.get('title', '')[:40]}",
        })
    return result

# ============ 主流程 ============
def run_fetch(keyword: str) -> dict:
    """抓取单个关键词 → 分析 → 返回结构化结果"""
    today = date.today().isoformat()
    raw = fetch_raw(keyword)
    analyzed = analyze_with_llm(raw, keyword)
    return {
        "fetch_date": today,
        "keyword": keyword,
        "items": analyzed,
    }
