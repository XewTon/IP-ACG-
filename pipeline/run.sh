#!/usr/bin/env bash
# 玄策 · 动态速报 pipeline 一键运行
# 用法: bash run.sh [--date 2026-08-13]  |  Windows: 双击 run.bat
set -e
cd "$(dirname "$0")"

DATE="${1:-$(date +%Y-%m-%d)}"
if [[ "$1" == "--date" ]]; then DATE="$2"; fi

echo "════════ 玄策 · 玄机IP动态速报 pipeline ════════"
echo "日期: $DATE"
echo ""

echo "── Step 1/4 搜索层 ──"
python fetch_search.py --date "$DATE"

echo ""
echo "── Step 2/4 分析层（智谱4.5 + SYSTEM_PROMPT）──"
python analyze.py --date "$DATE"

echo ""
echo "── Step 3/4 生成层（python-docx）──"
python generate_docx.py --date "$DATE"

echo ""
echo "── Step 4/4 验证层 ──"
DOCX="output/玄机IP动态速报_${DATE}.docx"
python postcheck.py "$DOCX"

echo ""
echo "✅ 完成：$DOCX"
