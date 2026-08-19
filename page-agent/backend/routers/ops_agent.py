"""玄策 · AI 运营助手 API"""
from fastapi import APIRouter
from ai.schemas import OpsAnalyzeRequest, OpsAnalyzeResponse
from ai.agent import analyze

router = APIRouter(prefix="/api/ops-agent", tags=["ops-agent"])


@router.post("/analyze", response_model=OpsAnalyzeResponse)
def ops_analyze(body: OpsAnalyzeRequest):
    return analyze(body.query, body.scenario)


@router.get("/scenarios")
def scenarios():
    return {
        "data": [
            {"id": "character", "label": "角色分析", "prompt": "分析最近30天盖聂表现"},
            {"id": "campaign", "label": "活动生成", "prompt": "设计少司命生日活动方案"},
            {"id": "sentiment", "label": "负面归因", "prompt": "分析用户负面反馈原因，为什么最近增长变慢"},
            {"id": "direction", "label": "下月方向", "prompt": "分析该IP未来一个月运营方向"},
        ]
    }
