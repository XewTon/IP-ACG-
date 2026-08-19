"""
Agent 配置 API —— 为前端 AI 助手提供 IP 运营专属 prompt 和对话接口
API Key 存储于后端（agent_config.json，已 gitignore），前端不再持久化到 localStorage
LLM 接入：ai/llm.py（DashScope 优先 → 智谱 fallback），未配置时规则降级并明确标注。
"""
import os
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime

from ai import tools as T
from ai.llm import llm_chat, resolve_llm, llm_provider_status

router = APIRouter(prefix="/api/agent", tags=["agent"])

AGENT_CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "agent_config.json")


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str


class AgentConfigRequest(BaseModel):
    apiKey: str
    model: str = "qwen-turbo"


def read_agent_config() -> dict:
    """env DASHSCOPE_API_KEY 优先；其次读配置文件"""
    env_key = os.getenv("DASHSCOPE_API_KEY", "").strip()
    if env_key:
        return {"apiKey": env_key, "model": os.getenv("DASHSCOPE_MODEL", "qwen-turbo")}
    try:
        with open(AGENT_CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}


def write_agent_config(cfg: dict) -> None:
    with open(AGENT_CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False)


def clear_agent_config() -> None:
    try:
        os.remove(AGENT_CONFIG_PATH)
    except OSError:
        pass


# IP 运营专属 System Prompt
SYSTEM_PROMPT = """你是「玄策」国漫IP智能运营中心的AI助手，服务玄机科技旗下 IP（秦时明月/天行九歌/斗罗大陆/武庚纪等）运营团队。职责：

1. **数据查询**：从驾驶舱提取各平台运营数据与 IP 健康指数
2. **角色分析**：解读角色热度、讨论变化与商业价值（盖聂/天明/少司命/卫庄/唐三等）
3. **竞品分析**：对比竞品IP数据，发现差距和机会
4. **内容排程**：管理跨平台内容发布时间
5. **报告生成**：生成每日简报和每周周报

IP 信息（来源 xjent.com 官网收录）：
- 旗舰作品：秦时明月（2007至今）、天行九歌（前传）
- 年番矩阵：斗罗大陆、吞噬星空、绝世唐门
- 核心平台：B站、微博、小红书、公众号

用简洁、专业、数据驱动的语气回复。每次回答结尾给出可执行的下一步建议。
复杂决策分析请引导用户打开「AI助手」决策台。"""


@router.get("/prompts")
def get_prompts():
    """返回 IP 运营专属 system prompt"""
    return {
        "system_prompt": SYSTEM_PROMPT,
        "quick_commands": [
            {"label": "查看今日数据总览", "prompt": "在当前页面上找到全网粉丝总数、昨日互动量、内容发布数"},
            {"label": "查看B站数据", "prompt": "找到B站（bilibili）的粉丝数、播放量、互动率"},
            {"label": "查看竞品对比", "prompt": "切换到竞品监控页面，对比所有竞品与我们的粉丝差距"},
            {"label": "生成本周周报", "prompt": "切换到运营报告页面，提取本周关键数据"},
        ],
    }


@router.post("/chat")
def chat(request: ChatRequest):
    """真实 LLM 对话（携带驾驶舱/角色/知识库上下文）；未配置 key 时规则降级并明确标注"""
    msg = request.message.strip()
    if not msg:
        raise HTTPException(400, "消息不能为空")

    # 组装实时数据上下文（供 LLM 决策，禁止编造）
    try:
        cockpit = T.get_cockpit_metrics()
        chars = T.get_character_stats(None)
        sentiment = T.list_recent_sentiment()
        activities = T.list_activities()
    except Exception:
        cockpit, chars, sentiment, activities = {}, [], {}, []
    knowledge = T.tool_search_knowledge(msg)
    context = {
        "驾驶舱": cockpit,
        "角色": chars,
        "舆情": sentiment,
        "活动": activities,
        "知识库命中": knowledge[:3],
    }

    system = """你是「玄策」国漫IP智能运营中心的AI助手。
必须基于提供的 JSON 数据回答，不得编造不存在的指标；数据未给出时明确说明。
服务 IP 运营团队：数据查询、角色分析、竞品对比、内容排程、报告生成。
用简洁、专业、数据驱动的语气，结尾给出可执行的下一步建议。"""

    provider = resolve_llm()
    try:
        if not provider:
            raise RuntimeError("未配置 LLM")
        reply = llm_chat([
            {"role": "system", "content": system},
            {"role": "user", "content": f"问题：{msg}\n\n实时数据上下文(JSON)：\n{json.dumps(context, ensure_ascii=False)}"},
        ], temperature=0.4)
        return {
            "reply": reply,
            "provider": provider["provider"],
            "model": provider["model"],
            "fallback": False,
            "context": {"knowledge_hits": len(knowledge)},
        }
    except Exception as e:
        print(f"[agent] LLM chat failed, rule fallback: {e}")
        return {
            "reply": (
                "⚠ 当前未接入真实 AI（未配置 API Key 或调用失败），以下为规则模板回复。\n"
                "请在后端设置 DashScope 或智谱 API Key 后重试。\n\n"
            ) + _rule_reply(msg, cockpit, chars),
            "provider": None,
            "model": None,
            "fallback": True,
            "error": str(e),
        }


def _rule_reply(msg: str, cockpit: dict, chars: list) -> str:
    """最后兜底的规则回复（明确标注为降级）"""
    lines = []
    if cockpit:
        lines.append(f"- IP热度：{cockpit.get('heat_index', '—')}；商业潜力：{cockpit.get('commercial_score', '—')}；用户规模：{cockpit.get('user_scale', '—')}")
    if chars:
        top = sorted(chars, key=lambda c: c.get("discussions", 0) or 0, reverse=True)[:3]
        lines.append("角色讨论量 Top：" + "、".join(f"{c['name']}({c.get('discussions', 0)})" for c in top))
    if not lines:
        lines.append("暂无实时数据上下文（后端数据为空）。")
    return "\n".join(lines)


@router.get("/config")
def get_agent_config():
    """返回 Agent 配置状态。
    本地演示模式（未设置 AUTH_TOKEN）回传 apiKey 供 Page-Agent 浏览器端使用；
    公网部署（已设置 AUTH_TOKEN）不回传 key，仅返回状态，浏览器端走 /api/agent/chat。"""
    import os
    cfg = read_agent_config()
    status = llm_provider_status()
    auth_token = os.getenv("AUTH_TOKEN", "").strip()
    return {
        "configured": bool(cfg.get("apiKey")) or bool(status.get("configured")),
        "model": cfg.get("model", status.get("model") or "qwen-turbo"),
        "apiKey": cfg.get("apiKey", "") if not auth_token else "",
        "provider": status.get("provider"),
        "llm_ready": bool(status.get("configured")),
        "llm_model": status.get("model"),
    }


@router.post("/config")
def set_agent_config(body: AgentConfigRequest):
    """保存 Agent 配置到后端（agent_config.json）"""
    if not body.apiKey.strip():
        raise HTTPException(400, "apiKey 不能为空")
    write_agent_config({"apiKey": body.apiKey.strip(), "model": body.model})
    return {"configured": True}


@router.delete("/config")
def delete_agent_config():
    """清除后端保存的 Agent 配置"""
    clear_agent_config()
    return {"configured": False}


@router.get("/status")
def agent_status():
    """返回 agent 运行状态"""
    return {
        "status": "ok",
        "provider": "DashScope (Qwen)",
        "models_available": ["qwen-turbo", "qwen-plus", "qwen-max"],
        "features": ["page_automation", "data_query", "report_generation"],
        "timestamp": datetime.now().isoformat(),
    }
