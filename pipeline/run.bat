@echo off
REM 玄策 · 动态速报 pipeline 一键运行（Windows）
chcp 65001 >nul
cd /d "%~dp0"

set DATE=%date:~0,4%-%date:~5,2%-%date:~8,2%

echo ======== 玄策 · 玄机IP动态速报 pipeline ========
echo 日期: %DATE%
echo.

echo -- Step 1/4 搜索层 --
python fetch_search.py --date %DATE%
echo.

echo -- Step 2/4 分析层（智谱4.5 + SYSTEM_PROMPT）--
python analyze.py --date %DATE%
echo.

echo -- Step 3/4 生成层（python-docx）--
python generate_docx.py --date %DATE%
echo.

echo -- Step 4/4 验证层 --
python postcheck.py "output\玄机IP动态速报_%DATE%.docx"
echo.

echo. 完成！输出文件: output\玄机IP动态速报_%DATE%.docx
pause
