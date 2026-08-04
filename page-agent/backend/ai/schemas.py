"""统一输出结构"""
from typing import Any
from pydantic import BaseModel, Field


class OpsAnalyzeRequest(BaseModel):
    query: str
    scenario: str | None = None  # character | campaign | sentiment | direction


class OpsAnalyzeResponse(BaseModel):
    mode: str = Field(description="llm | fallback")
    title: str
    summary: str
    metrics: list[dict[str, Any]] = []
    reasons: list[str] = []
    suggestions: list[str] = []
    knowledge_hits: list[str] = []
    markdown: str = ""
    raw: str | None = None
