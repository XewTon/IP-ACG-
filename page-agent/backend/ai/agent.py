"""
IP 运营分析 Agent。
LLM 接入走 ai/llm.py（DashScope 优先 → 智谱 fallback，配置来自 env / agent_config.json / zhipu_config.json）；
未配置或调用失败时用种子数据规则模板（面试可离线演示），并标注 mode=fallback。
"""
from __future__ import annotations

import json
import re
from ai.schemas import OpsAnalyzeResponse
from ai import tools as T
from ai.llm import llm_chat, resolve_llm


def _detect_character(query: str) -> str | None:
    for name in (
        "盖聂", "天明", "少司命", "卫庄", "雪女", "韩非", "焰灵姬", "紫女",
        "武庚", "白菜", "唐三", "小舞", "比比东", "李景珑", "孔鸿俊",
        "罗峰", "李长寿", "霍雨浩", "唐舞桐",
    ):
        if name in query:
            return name
    return None


def _fallback_analyze(query: str, scenario: str | None = None) -> OpsAnalyzeResponse:
    cockpit = T.get_cockpit_metrics()
    sentiment = T.list_recent_sentiment()
    activities = T.list_activities()
    knowledge = T.tool_search_knowledge(query)
    char_name = _detect_character(query)
    chars = T.get_character_stats(char_name)

    scenario = scenario or ""
    if not scenario:
        if any(k in query for k in ("活动", "生日", "企划", "方案")):
            scenario = "campaign"
        elif any(k in query for k in ("负面", "舆情", "反馈", "减少", "流失")):
            scenario = "sentiment"
        elif any(k in query for k in ("方向", "下月", "未来", "策略")):
            scenario = "direction"
        else:
            scenario = "character"

    if scenario == "campaign":
        target = char_name or "核心角色"
        title = f"{target}活动方案（数据驱动）"
        summary = f"基于《{cockpit['ip_name']}》当前健康度与历史活动 ROI，生成{target}限定活动草案。"
        metrics = [
            {"label": "IP热度", "value": cockpit["heat_index"]},
            {"label": "商业潜力", "value": cockpit["commercial_score"]},
            {"label": "进行中活动", "value": sum(1 for a in activities if a["status"] == "running")},
        ]
        if chars:
            c = chars[0]
            metrics.extend([
                {"label": f"{c['name']}讨论量", "value": c.get("discussions", 0)},
                {"label": "讨论变化", "value": f"{c.get('discussion_change_pct', 0)}%"},
            ])
        reasons = [
            f"{target}近期讨论变化与用户反馈指向「角色限定/成长线」可运营点。",
            "历史角色专属企划 ROI 验证有效，角色限定企划可转化。",
            "舆情健康度良好，适合做正向传播型活动，避免争议话题。",
        ]
        suggestions = [
            f"主题：{target}限定企划（贴合《{cockpit['ip_name']}》调性，保持克制不卖萌）",
            "用户群体：角色党 + 剧情党为主，美术党用高清静帧承接",
            "渠道：B站预热短片 → 微博话题投票 → 小红书美学笔记 → 公众号深读收束",
            "预期：活动周讨论量 +25%~35%，角色商业分提升 3~5 点",
            "素材：角色立绘/表情/短视频脚本；外包 brief 走供应链模块",
        ]
    elif scenario == "sentiment":
        title = "用户减少/负面反馈归因"
        summary = sentiment.get("summary") or "基于舆情快照与内容数据的归因分析。"
        metrics = [
            {"label": "正面", "value": f"{sentiment.get('positive', 0)}%"},
            {"label": "中性", "value": f"{sentiment.get('neutral', 0)}%"},
            {"label": "负面", "value": f"{sentiment.get('negative', 0)}%"},
            {"label": "风险", "value": sentiment.get("risk_level", "low")},
            {"label": "用户规模", "value": cockpit["user_scale"]},
        ]
        reasons = [
            "负面主要集中在更新频率不稳定，而非角色崩坏。",
            "部分用户反馈设定理解门槛偏高（留白过度）。",
            "竞品都市灵异涨粉更快，分流部分泛兴趣用户。",
        ]
        suggestions = [
            "固定周更节奏并在微博预告排期，降低「停更焦虑」",
            "用世界观解读轻内容做设定补全，仍保持神秘感",
            "对负面评论建立 24h 分级响应：设定争议→官方短回应",
        ]
    elif scenario == "direction":
        title = "未来一个月运营方向"
        summary = f"《{cockpit['ip_name']}》应延续角色专属内容红利，补齐更新确定性，试水低成本互动玩法。"
        metrics = [
            {"label": "热度指数", "value": cockpit["heat_index"]},
            {"label": "活跃度", "value": cockpit["activity_index"]},
            {"label": "商业潜力", "value": cockpit["commercial_score"]},
            {"label": "舆情健康", "value": cockpit["sentiment_index"]},
        ]
        reasons = [
            "角色PV系列篇均表现高于世界观解说，应加大角色运营权重。",
            "头部角色（少司命/盖聂等）商业价值高，适合联名/周边预热；剧情向角色适合内容活动。",
            "部分角色热度上升，适合低成本互动玩法测试。",
        ]
        suggestions = [
            "周节奏：1 角色向内容 + 1 世界观轻内容 + 2~3 社交互动",
            "本月主线：头部角色生日/节点企划预热 → 爆发 → 复盘",
            "副线：人气角色互动玩法；储备美学周边概念稿",
            "数据复盘：以角色讨论变化与活动 ROI 为周会核心指标",
        ]
    else:
        # character analysis
        c = chars[0] if chars else {"name": char_name or "角色", "discussions": 0, "discussion_change_pct": 0,
                                      "search_index": 0, "fan_growth": 0, "fanworks": 0, "commercial_value": 0}
        name = c.get("name") or "角色"
        change = c.get("discussion_change_pct", 0)
        title = f"{name}近30天表现分析"
        summary = (
            f"{name}讨论量环比 {change:+.1f}%。"
            + ("主要受新剧情/角色内容带动。" if change >= 10 else "增长平稳，需主动运营刺激。")
        )
        metrics = [
            {"label": "讨论量(近7日均)", "value": c.get("discussions", 0)},
            {"label": "讨论变化", "value": f"{change:+.1f}%"},
            {"label": "搜索指数", "value": c.get("search_index", 0)},
            {"label": "粉丝增长", "value": c.get("fan_growth", 0)},
            {"label": "二创量", "value": c.get("fanworks", 0)},
            {"label": "商业价值", "value": c.get("commercial_value", 0)},
        ]
        if name == "盖聂":
            reasons = [
                "剑圣定位与守护主线持续成为讨论锚点",
                "角色PV与经典台词片段在B站/微博保持高互动",
                "与卫庄的师兄弟对决构成二创热点",
            ]
            suggestions = [
                "推出盖聂限定企划（角色纪念日/名场面复盘）",
                "增加角色短视频：剑道名场面混剪 / 幕后配音花絮",
                "微博做「你最喜欢盖聂的哪场对决」互动，沉淀角色党",
            ]
        elif name == "少司命":
            reasons = [
                "沉默神秘的人设与美学企划 ROI 高",
                "小红书种草路径成熟，形象与平台气质匹配",
            ]
            suggestions = [
                "推进周边/联名概念测试（少司命美学向）",
                "保持克制调性，避免过度营业",
                "万叶飞花流名场面系列内容可延长生命周期",
            ]
        else:
            reasons = [
                "角色PV后热度抬升，人设具备互动玩法空间",
                "角色关系线与名场面设定适合谜题与悬念运营",
            ]
            suggestions = [
                "周常互动玩法（角色问答/名场面投票），低成本维持讨论",
                "与同作品主线角色联动做短内容",
                "观察涨粉稳定性后再投入高成本PV",
            ]

    md_lines = [f"## {title}", "", summary, "", "### 数据依据"]
    for m in metrics:
        md_lines.append(f"- **{m['label']}**：{m['value']}")
    md_lines += ["", "### 主要原因"]
    md_lines += [f"- {r}" for r in reasons]
    md_lines += ["", "### 运营建议"]
    md_lines += [f"- {s}" for s in suggestions]
    if knowledge:
        md_lines += ["", "### 知识库参考"]
        for h in knowledge[:2]:
            md_lines.append(f"- {h[:200].replace(chr(10), ' ')}")

    return OpsAnalyzeResponse(
        mode="fallback",
        title=title,
        summary=summary,
        metrics=metrics,
        reasons=reasons,
        suggestions=suggestions,
        knowledge_hits=knowledge[:3],
        markdown="\n".join(md_lines),
    )


def _llm_analyze(query: str, scenario: str | None = None) -> OpsAnalyzeResponse:
    """真实 LLM（DashScope / 智谱 OpenAI 兼容接口）分析。"""
    provider = resolve_llm()
    if not provider:
        raise RuntimeError("未配置 LLM")

    context = {
        "cockpit": T.get_cockpit_metrics(),
        "characters": T.get_character_stats(_detect_character(query)),
        "sentiment": T.list_recent_sentiment(),
        "activities": T.list_activities(),
        "knowledge": T.tool_search_knowledge(query),
    }

    system = """你是「玄策」国漫IP智能运营中心的运营分析Agent。
你必须基于提供的 JSON 数据做决策，不要编造不存在的指标。
输出严格 JSON，字段：
{
  "title": "标题",
  "summary": "一句话结论",
  "metrics": [{"label":"...","value":"..."}],
  "reasons": ["..."],
  "suggestions": ["可执行建议1","建议2","建议3"]
}
语气专业、数据驱动，面向国漫IP运营岗位。"""

    msg = (
        f"运营问题：{query}\n场景偏好：{scenario or '自动'}\n\n"
        f"数据上下文：\n{json.dumps(context, ensure_ascii=False)}"
    )
    text = llm_chat(
        [{"role": "system", "content": system}, {"role": "user", "content": msg}],
        temperature=0.3,
    )

    # 提取 JSON
    data = None
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", text)
        if m:
            try:
                data = json.loads(m.group(0))
            except json.JSONDecodeError:
                data = None

    if not data:
        fb = _fallback_analyze(query, scenario)
        fb.mode = f"llm:{provider['provider']}"
        fb.raw = text
        fb.summary = text[:500]
        fb.markdown = text
        return fb

    metrics = data.get("metrics") or []
    reasons = data.get("reasons") or []
    suggestions = data.get("suggestions") or []
    title = data.get("title") or "运营分析"
    summary = data.get("summary") or ""
    md = [f"## {title}", "", summary, "", "### 数据依据"]
    for m in metrics:
        md.append(f"- **{m.get('label')}**：{m.get('value')}")
    md += ["", "### 主要原因"] + [f"- {r}" for r in reasons]
    md += ["", "### 运营建议"] + [f"- {s}" for s in suggestions]

    return OpsAnalyzeResponse(
        mode=f"llm:{provider['provider']}",
        title=title,
        summary=summary,
        metrics=metrics,
        reasons=reasons,
        suggestions=suggestions,
        knowledge_hits=context["knowledge"][:3],
        markdown="\n".join(md),
        raw=text,
    )


def analyze(query: str, scenario: str | None = None) -> OpsAnalyzeResponse:
    if resolve_llm():
        try:
            return _llm_analyze(query, scenario)
        except Exception as e:
            print(f"[OpsAgent] LLM failed, fallback: {e}")
            fb = _fallback_analyze(query, scenario)
            fb.raw = str(e)
            return fb
    return _fallback_analyze(query, scenario)
