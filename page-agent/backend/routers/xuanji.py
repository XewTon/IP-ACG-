"""玄机科技 IP 运营知识库 API —— 面试备战手册 + 数据看板的真实数据源。
全部数据来自公开信息（招股书/问询函/百科/新闻），与前端看板一一对应。"""
from fastapi import APIRouter
from database import get_db

router = APIRouter(prefix="/api/xuanji", tags=["xuanji"])


def _rows(sql: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(sql)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


@router.get("/overview")
def get_overview():
    """总览：KPI 卡片 + 营收趋势 + 收入构成 + 客户集中度"""
    kpis = _rows("SELECT * FROM xuanji_kpis ORDER BY year")
    if not kpis:
        return {"kpis": [], "revenue_trend": [], "composition": {}, "client_trend": []}
    y2025 = kpis[-1]
    return {
        "kpis": [
            {"label": "2025年营业收入", "value": y2025["revenue"], "unit": "亿元",
             "delta": "+26.5% YoY", "delta_dir": "up", "sub": "2024: 3.17亿 / 2023: 2.62亿"},
            {"label": "归母净利润", "value": y2025["net_profit"], "unit": "亿元",
             "delta": "+80.4% YoY", "delta_dir": "up", "sub": f"净利率{y2025['net_margin']}%，显著提升"},
            {"label": "腾讯系收入占比", "value": y2025["tencent_share"], "unit": "%",
             "delta": "从76.7%降至50.6%", "delta_dir": "down", "sub": "客户集中度优化中，但仍偏高"},
            {"label": "代工业务占比", "value": y2025["agency_share"], "unit": "%+",
             "delta": "自营IP比例待提升", "delta_dir": "down", "sub": "IPO核心问询焦点"},
            {"label": "在运营IP数量", "value": 6, "unit": "个",
             "delta": "", "delta_dir": "", "sub": "秦时明月/斗罗大陆/吞噬星空/牧神记/天行九歌/武庚纪"},
            {"label": "IPO状态", "value": "已回复首轮问询", "unit": "",
             "delta": "北交所·中信建投保荐·2026.8.3提交", "delta_dir": "", "sub": "等待二轮问询或上会"},
        ],
        "revenue_trend": [
            {"year": k["year"], "revenue": k["revenue"], "net_profit": k["net_profit"]} for k in kpis
        ],
        "composition": {
            "agency": kpis[-1]["agency_share"],
            "self_ip": round(100 - kpis[-1]["agency_share"], 1),
        },
        "client_trend": [
            {"year": k["year"], "tencent": k["tencent_share"], "top5": k["top5_client_share"]} for k in kpis
        ],
    }


@router.get("/ips")
def get_ips():
    """IP 矩阵：卡片 + 生命周期 + 雷达五维 + 联动策略"""
    ips = _rows("SELECT * FROM xuanji_ips ORDER BY heat DESC")
    strategies = _rows("SELECT * FROM xuanji_strategy ORDER BY priority")
    return {
        "data": ips,
        "radar_indicators": ["播放热度", "社区讨论", "二创活跃", "付费转化", "口碑评分"],
        "strategies": strategies,
    }


@router.get("/ipo")
def get_ipo():
    """IPO 进展：时间线 + 问询 + 股权结构"""
    timeline = _rows("SELECT * FROM xuanji_ipo_timeline ORDER BY id")
    inquiry = _rows("SELECT * FROM xuanji_inquiry ORDER BY id")
    shareholders = _rows("SELECT * FROM xuanji_shareholders ORDER BY id")
    return {"timeline": timeline, "inquiry": inquiry, "shareholders": shareholders}


@router.get("/bili")
def get_bili():
    """B站分析：漏斗 + 各IP对比 + 运营策略"""
    funnel = _rows("SELECT * FROM xuanji_bili ORDER BY sort_order")
    ips = _rows("SELECT * FROM xuanji_bili_ips ORDER BY id")
    return {"funnel": funnel, "ips": ips}


@router.get("/knowledge")
def get_knowledge():
    """知识图谱：六大模块"""
    rows = _rows("SELECT * FROM xuanji_knowledge ORDER BY module_no, sort_order, id")
    modules: list[dict] = []
    current: dict | None = None
    for r in rows:
        if current is None or current["module"] != r["module"]:
            current = {"module": r["module"], "items": []}
            modules.append(current)
        current["items"].append({"title": r["title"], "desc": r["desc"]})
    return {"modules": modules}


@router.get("/reports")
def get_reports():
    """动态速报"""
    reports = _rows("SELECT * FROM xuanji_reports ORDER BY sort_order")
    for r in reports:
        r["tags_list"] = [t for t in (r["tags"] or "").split("|") if t]
    return {"data": reports}


@router.get("/supply")
def get_supply():
    """衍生品供应链（手册 6.4）+ 收入结构3年目标（手册 6.6）"""
    items = _rows("SELECT * FROM xuanji_supply ORDER BY sort_order")
    targets = _rows("SELECT * FROM xuanji_revenue_target ORDER BY sort_order")
    return {"items": items, "revenue_targets": targets}
