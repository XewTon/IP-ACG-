"""玄策 · 动态速报 pipeline 调度 API
一键运行：搜索 → LLM分析 → 生成docx → 验证 → 下载
pipeline 脚本在 d:/IP运营（ACG）/pipeline/
"""
import subprocess
import sys
import os
from pathlib import Path
from datetime import date

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])

# pipeline 根目录（项目根下的 pipeline/）
PIPELINE_DIR = Path(__file__).resolve().parent.parent.parent.parent / "pipeline"
OUTPUT_DIR = PIPELINE_DIR / "output"


def _run_pipeline(date_str: str) -> dict:
    """按顺序跑 4 个脚本（搜索→分析→生成→验证），返回每步日志"""
    scripts = ["fetch_search.py", "analyze.py", "generate_docx.py", "postcheck.py"]
    steps = []
    for script in scripts:
        try:
            proc = subprocess.run(
                [sys.executable, script, "--date", date_str],
                cwd=str(PIPELINE_DIR),
                capture_output=True, text=True, timeout=300,
            )
            steps.append({
                "script": script, "returncode": proc.returncode,
                "output": (proc.stdout or proc.stderr)[-300:],
            })
            if proc.returncode != 0:
                return {"ok": False, "steps": steps}
        except Exception as e:
            return {"ok": False, "steps": [*steps, {"script": script, "returncode": -1, "output": str(e)}]}

    docx = OUTPUT_DIR / f"玄机IP动态速报_{date_str}.docx"
    return {
        "ok": docx.exists(),
        "steps": steps,
        "docx": str(docx) if docx.exists() else None,
    }


@router.post("/run")
def run_pipeline():
    """一键运行 pipeline，生成今日速报 docx"""
    today = date.today().isoformat()
    result = _run_pipeline(today)
    if not result["ok"]:
        raise HTTPException(500, detail=result)
    return {"message": "速报生成成功", "docx": result["docx"], "steps": result["steps"]}


@router.get("/run")
def run_pipeline_get():
    """GET 版本（浏览器可直接访问触发）"""
    return run_pipeline()


@router.get("/download/{date_str}")
def download_docx(date_str: str):
    """下载指定日期的速报 docx（date_str 限定 YYYY-MM-DD，防路径穿越）"""
    import re as _re
    if not _re.fullmatch(r"\d{4}-\d{2}-\d{2}", date_str):
        raise HTTPException(400, "日期格式必须为 YYYY-MM-DD")
    docx = OUTPUT_DIR / f"玄机IP动态速报_{date_str}.docx"
    try:
        is_inside = docx.resolve().is_relative_to(OUTPUT_DIR.resolve())
    except AttributeError:
        is_inside = str(docx.resolve()).startswith(str(OUTPUT_DIR.resolve()))
    if not is_inside:
        raise HTTPException(400, "非法路径")
    if not docx.exists():
        raise HTTPException(404, f"未找到 {date_str} 的速报，先运行 /api/pipeline/run")
    return FileResponse(
        str(docx),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=f"玄机IP动态速报_{date_str}.docx",
    )
