"""玄策 · Step1 搜索层
调 Tavily 搜索 API 抓取原始数据 → 存 JSON。
未配置 TAVILY_API_KEY 时用 mock 数据（保证 pipeline 可跑通）。
用法: python fetch_search.py [--date 2026-08-13]
"""
import argparse
import json
import sys
from datetime import date
from pathlib import Path
from config import SEARCH_KEYWORDS, SEARCH_RECENCY_DAYS, SEARCH_MAX_RESULTS, TAVILY_API_KEY, SEARCH_DIR

# ─── mock 数据（无 Tavily key 时降级） ───
MOCK_RESULTS = [
    {"name": "玄机科技回复北交所首轮问询：腾讯系收入占比降至50.6%",
     "snippet": "北京证券交易所消息，玄机科技披露首轮问询回复，2025年营业收入4.01亿元，同比增长26.5%，腾讯系收入占比从76.7%降至50.6%，客户集中度优化。",
     "date": "2026-08-10", "host_name": "news.qq.com", "url": "https://news.qq.com/xuanji-ipo"},
    {"name": "《天行九歌》真人剧官宣开机，玄机科技IP跨媒介布局提速",
     "snippet": "天行九歌真人剧正式开机，玄机科技从动画IP向真人影视延伸，IP全链路商业化战略落地。",
     "date": "2026-08-09", "host_name": "ent.sina.com.cn", "url": "https://ent.sina.com.cn/txjg-drama"},
    {"name": "《牧神记》B站评分9.7，玄机新番口碑与热度双丰收",
     "snippet": "牧神记动画在B站收获9.7高分，成为玄机科技又一口碑与热度兼备的原创IP。",
     "date": "2026-08-08", "host_name": "www.bilibili.com", "url": "https://www.bilibili.com/bangumi/mushenji"},
    {"name": "秦时明月IP联动新动作：与国潮品牌推出联名系列",
     "snippet": "秦时明月与国潮品牌推出联名系列，深化IP商业化与Z世代用户触达。",
     "date": "2026-08-07", "host_name": "finance.ifeng.com", "url": "https://finance.ifeng.com/qslm-link"},
    {"name": "斗罗大陆动画年度数据公布，衍生品带动周边销售",
     "snippet": "斗罗大陆动画年度播放数据亮眼，衍生品销售带动IP商业化增长。",
     "date": "2026-08-06", "host_name": "www.163.com", "url": "https://www.163.com/douluo-data"},
    {"name": "玄机科技2025年报：营收4.01亿，净利率显著提升",
     "snippet": "玄机科技2025年年报披露，营业收入4.01亿元同比增长26.5%，净利润同比大幅增长，净利率提升至较高水平。",
     "date": "2026-08-05", "host_name": "finance.sina.com.cn", "url": "https://finance.sina.com.cn/xuanji-annual"},
]


def fetch_tavily(keyword: str, days: int, limit: int) -> list[dict]:
    """真实 Tavily 搜索。需 TAVILY_API_KEY"""
    import urllib.request
    from urllib.parse import urlparse
    payload = json.dumps({
        "query": keyword, "topic": "news", "days": days, "max_results": limit,
        "search_depth": "advanced",
    }).encode()
    req = urllib.request.Request(
        "https://api.tavily.com/search",
        data=payload,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {TAVILY_API_KEY}"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    out = []
    for r in data.get("results", []):
        url = r.get("url", "")
        host = urlparse(url).netloc if url else ""
        out.append({
            "name": r.get("title", ""), "snippet": r.get("content", ""),
            "date": r.get("published_date", ""), "host_name": host, "url": url,
        })
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", default=date.today().isoformat())
    args = parser.parse_args()

    day_dir = SEARCH_DIR / args.date
    day_dir.mkdir(parents=True, exist_ok=True)

    total = 0
    for kw in SEARCH_KEYWORDS:
        keyword = kw["keyword"]
        if TAVILY_API_KEY:
            try:
                results = fetch_tavily(keyword, SEARCH_RECENCY_DAYS, SEARCH_MAX_RESULTS)
            except Exception as e:
                print(f"[warn] Tavily fail for '{keyword}': {e} — use mock")
                results = MOCK_RESULTS[:SEARCH_MAX_RESULTS]
        else:
            results = MOCK_RESULTS[:SEARCH_MAX_RESULTS]

        out = {"keyword": keyword, "category": kw["category"], "fetched_at": args.date, "results": results}
        fname = f"{keyword.replace(' ', '_')}.json"
        with open(day_dir / fname, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)
        total += len(results)
        print(f"  [{kw['category']}] {keyword}: {len(results)} 条 → {day_dir.name}/{fname}")

    print(f"搜索完成：{len(SEARCH_KEYWORDS)} 个关键词，共 {total} 条，存入 {day_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
