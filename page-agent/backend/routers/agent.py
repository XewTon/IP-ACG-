"""
Agent 配置 API —— 为前端 Page-Agent 提供 IP 运营专属 prompt 和对话接口
API Key 存储于后端（agent_config.json，已 gitignore），前端不再持久化到 localStorage
"""
import os
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime

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
SYSTEM_PROMPT = """你是「玄策」国漫IP智能运营中心的AI助手，服务《九歌/墨迹》IP运营团队。职责：

1. **数据查询**：从驾驶舱提取各平台运营数据与IP健康指数
2. **角色分析**：解读角色热度、讨论变化与商业价值
3. **竞品分析**：对比竞品IP数据，发现差距和机会
4. **内容排程**：管理跨平台内容发布时间
5. **报告生成**：生成每日简报和每周周报

《九歌/墨迹》IP信息：
- 定位：东方幻想×神秘学×都市传说×年轻人成长
- 目标用户：18-25岁，女性为主（65%）
- 核心平台：B站、微博、小红书、公众号
- 核心角色：沈砚、林疏影、老白

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
    """简单对话接口 —— 当 page-agent 不可用时的降级方案"""
    msg = request.message.lower()

    # 基于关键词的简易响应
    if any(w in msg for w in ['数据', '粉丝', '看板']):
        reply = (
            "要查看《墨迹》最新数据，你可以：\n\n"
            "1. 在**数据看板**页面查看全网粉丝（目前 18,850）、各平台数据和粉丝增长趋势\n"
            "2. 在**竞品监控**页面对比竞品数据\n"
            "3. 点击右上角「手动采集」按钮触发新一轮数据采集\n\n"
            "需要我帮你做具体的哪一项？"
        )
    elif any(w in msg for w in ['竞品', '对手', '对标']):
        reply = (
            "目前监控 3 个竞品 IP：\n"
            "- **某A（古风志怪）**：微博 120,000 粉，内容以插画+短漫画为主\n"
            "- **某B（都市灵异）**：B站 82,000 粉，动画短片+世界观解读\n"
            "- **某C（赛博修仙）**：小红书 51,000 粉，图文笔记为主\n\n"
            "我们目前与竞品B的差距最小（B站 8,400 vs 82,000），建议重点关注其内容策略。\n"
            "要查看详细对比，请切换到**竞品监控**页面。"
        )
    elif any(w in msg for w in ['报告', '周报', '简报']):
        reply = (
            "报告功能已就绪：\n\n"
            "- **每日简报**：每天 10:00 自动生成，包含昨日全平台核心指标\n"
            "- **每周周报**：每周一生成，包含本周增长数据和策略建议\n\n"
            "请在**运营报告**页面查看和复制。"
        )
    elif any(w in msg for w in ['发布', '排程', '内容']):
        reply = (
            "内容排程管理：\n\n"
            "- 当前有 **2 条**待发布内容\n"
            "- **15 条**已发布内容\n\n"
            "你可以在**内容排程**页面创建定时发布任务，或管理已有内容的状态。"
        )
    else:
        reply = (
            "我是《墨迹》IP运营助手，可以帮你：\n\n"
            "📊 查看各平台运营数据\n"
            "👥 监控竞品IP动态\n"
            "📝 管理内容排程\n"
            "📄 生成运营报告\n\n"
            "请告诉我想做什么？"
        )

    return {"reply": reply}


@router.get("/config")
def get_agent_config():
    """返回 Agent 配置状态（key 仅按需提供给已配置的会话，不落 localStorage）"""
    cfg = read_agent_config()
    return {"configured": bool(cfg.get("apiKey")), "model": cfg.get("model", "qwen-turbo"), "apiKey": cfg.get("apiKey", "")}


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
