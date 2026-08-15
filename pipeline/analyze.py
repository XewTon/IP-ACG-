"""玄策 · Step2 分析层
读搜索 JSON → 调智谱4.5 GLM（SYSTEM_PROMPT）→ 结构化分析 JSON。
无智谱 key 时降级规则分析。
用法: python analyze.py [--date 2026-08-13]
"""
import argparse
import json
import sys
import urllib.request
from datetime import date
from pathlib import Path
from config import SYSTEM_PROMPT, ZHIPU_API_KEY, ZHIPU_MODEL, ZHIPU_BASE, SEARCH_DIR, ANALYZED_DIR


def call_zhipu(user_content: str) -> str:
    """调智谱 chat.completions，返回 LLM 文本"""
    payload = {
        "model": ZHIPU_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        "temperature": 0.4,
    }
    req = urllib.request.Request(
        ZHIPU_BASE,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {ZHIPU_API_KEY}"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"]


def parse_llm_json(content: str) -> list[dict]:
    """容错解析：去 markdown 围栏，取首个 [...] 或 {...}"""
    content = content.strip()
    # 去围栏
    if content.startswith("```"):
        content = content.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    try:
        data = json.loads(content)
        if isinstance(data, dict):
            data = data.get("items") or data.get("data") or data.get("results") or []
        return data if isinstance(data, list) else []
    except Exception:
        # 尝试提取 [] 块
        import re
        m = re.search(r"\[[\s\S]*\]", content)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                return []
        return []


def rule_analyze(items: list[dict], keyword: str) -> list[dict]:
    """无智谱 key 降级：关键词规则打分"""
    out = []
    for it in items:
        text = it.get("name", "") + it.get("snippet", "")
        score, cat = 3, "ip"
        if any(k in text for k in ["IPO", "问询", "营收", "股权", "财务", "年报"]):
            score, cat = 5, "ipo"
        elif any(k in text for k in ["联名", "衍生", "商业化", "周边", "销售额"]):
            score, cat = 4, "strategy"
        elif any(k in text for k in ["开机", "真人剧", "动画电影", "立项"]):
            score, cat = 4, "ip"
        out.append({
            "title": it.get("name", ""), "url": it.get("url", ""),
            "date": it.get("date", ""), "category": cat, "score": score,
            "summary": (it.get("snippet", "") or "")[:60],
            "data_points": "", "interview_value": f"[{keyword}] {it.get('name','')[:40]}",
            "interview_tip": "",
        })
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", default=date.today().isoformat())
    args = parser.parse_args()

    day_dir = SEARCH_DIR / args.date
    if not day_dir.exists():
        print(f"错误：{day_dir} 不存在。先运行 python fetch_search.py --date {args.date}")
        return 1

    all_analyzed = []
    for fpath in sorted(day_dir.glob("*.json")):
        with open(fpath, encoding="utf-8") as f:
            data = json.load(f)
        keyword, category = data.get("keyword", ""), data.get("category", "ip")
        items = data.get("results", [])

        if ZHIPU_API_KEY:
            try:
                user_content = f"关键词：{keyword}（类别：{category}）\n\n搜索结果JSON：\n{json.dumps(items, ensure_ascii=False)}"
                llm_text = call_zhipu(user_content)
                analyzed = parse_llm_json(llm_text)
                print(f"  [{category}] {keyword}: LLM分析 {len(analyzed)} 条")
            except Exception as e:
                print(f"  [warn] {keyword} LLM失败({e}) — 降级规则")
                analyzed = rule_analyze(items, keyword)
        else:
            analyzed = rule_analyze(items, keyword)
            print(f"  [{category}] {keyword}: 规则分析 {len(analyzed)} 条 (无智谱key)")

        for a in analyzed:
            a["keyword"] = keyword
            a["category"] = a.get("category", category)
            all_analyzed.append(a)

    # 批内去重（按标题归一化，保留最高分）
    best = {}
    for a in all_analyzed:
        key = "".join(c for c in a.get("title", "") if c.strip()).lower()[:40]
        if not key:
            continue
        if key not in best or a.get("score", 0) > best[key].get("score", 0):
            best[key] = a
    final = sorted(best.values(), key=lambda x: -x.get("score", 0))

    out_dir = ANALYZED_DIR / args.date
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / f"analyzed_{args.date}.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump({"date": args.date, "count": len(final), "items": final}, f, ensure_ascii=False, indent=2)

    print(f"\n分析完成：{len(final)} 条（去重后），存入 {out_file}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
