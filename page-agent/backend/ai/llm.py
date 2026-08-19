"""
玄策 · 统一 LLM 接入
Provider 解析顺序：DashScope（env DASHSCOPE_API_KEY → agent_config.json）→ 智谱（zhipu_config.json）
两者均为 OpenAI 兼容接口，统一走 urllib 直调（无 SDK 依赖）。
未配置任何 key 时 resolve_llm() 返回 None，调用方降级为规则模板并明确标注「未接入 AI」。
"""
from __future__ import annotations

import json
import os
import urllib.request
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
AGENT_CFG = BASE_DIR / "agent_config.json"
ZHIPU_CFG = BASE_DIR / "zhipu_config.json"

DASHSCOPE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
ZHIPU_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions"


def _read_json(path: Path) -> dict:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}


def resolve_llm() -> dict | None:
    """返回 {provider, base_url, api_key, model} 或 None"""
    env_key = os.getenv("DASHSCOPE_API_KEY", "").strip()
    if env_key:
        return {
            "provider": "dashscope",
            "base_url": DASHSCOPE_URL,
            "api_key": env_key,
            "model": os.getenv("DASHSCOPE_MODEL", "qwen-turbo"),
        }
    ac = _read_json(AGENT_CFG)
    if ac.get("apiKey"):
        model = ac.get("model", "qwen-turbo")
        if model.startswith("glm"):
            return {"provider": "zhipu", "base_url": ZHIPU_URL, "api_key": ac["apiKey"], "model": model}
        return {
            "provider": "dashscope",
            "base_url": DASHSCOPE_URL,
            "api_key": ac["apiKey"],
            "model": model,
        }
    zc = _read_json(ZHIPU_CFG)
    if zc.get("apiKey"):
        return {
            "provider": "zhipu",
            "base_url": ZHIPU_URL,
            "api_key": zc["apiKey"],
            "model": zc.get("model", "glm-4.5"),
        }
    return None


def llm_chat(messages: list[dict], temperature: float = 0.4, timeout: int = 60) -> str:
    """messages: [{role, content}, ...] → 返回模型文本。未配置或调用失败抛异常。"""
    cfg = resolve_llm()
    if not cfg:
        raise RuntimeError("未配置 LLM（请在后端设置 DashScope 或智谱 API Key）")
    payload = {"model": cfg["model"], "messages": messages, "temperature": temperature}
    req = urllib.request.Request(
        cfg["base_url"],
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {cfg['api_key']}"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"]


def llm_provider_status() -> dict:
    cfg = resolve_llm()
    return {
        "configured": cfg is not None,
        "provider": cfg["provider"] if cfg else None,
        "model": cfg["model"] if cfg else None,
    }
