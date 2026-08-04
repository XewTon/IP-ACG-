# 玄策 · 国漫IP智能运营中心

> XuanCe AI IP Operation Platform  
> AI 驱动的国漫 IP 运营决策中台（由「九歌」原型演进）

面向国漫 IP / 游戏发行 / 内容运营团队的数据化运营工具，打通：

**IP资产管理 → 角色数据分析 → AI辅助决策**

演示 IP：《九歌 / 墨迹》（东方幻想 × 都市志怪）

---

## 一期能力（决策闭环）

| 模块 | 说明 |
|------|------|
| 运营驾驶舱 | IP 健康指数、热度/用户/平台/角色图表（ECharts） |
| IP 资产中心 | 角色档案、世界观时间线、IP 规范（API + SQLite） |
| 角色运营分析 | 排行榜、30 日趋势、关系图谱 |
| AI 运营助手 | LangChain 分析 Agent + LlamaIndex/关键词 RAG；无 Key 可降级演示 |
| Page-Agent | 右下角浮窗：页面操控与快捷指令 |

开源能力嵌入方式：

```
Page-Agent     → 页面操控助手
LlamaIndex     → IP 知识库 RAG
LangChain      → 运营分析 Agent
ECharts        → 运营驾驶舱
```

二期预留：`GET /api/sentiment/stub`（Crawlee 舆情）、`GET /api/radar/stub`（TrendRadar 热点）

---

## 技术栈

- Frontend: React 18 + TypeScript + Vite + Tailwind + ECharts
- Backend: FastAPI + SQLite + APScheduler
- AI: DashScope(Qwen) / LangChain / LlamaIndex + Chroma（可选）
- Browser Agent: alibaba/page-agent

---

## 本地启动

> Windows 注意：请用 `python -m uvicorn`（不要直接敲 `uvicorn`，常不在 PATH）。  
> 前端已绑定 `127.0.0.1`，请用 http://127.0.0.1:5173 打开。

### 1. 后端

```bash
cd page-agent/backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
pip install -r requirements.txt
# 若 chromadb / llama-index 安装失败可忽略，会自动走关键词 RAG 降级
copy .env.example .env
# 可选：在 .env 填写 DASHSCOPE_API_KEY
python -c "from seed_data import seed; seed()"
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### 2. 前端（另开终端）

```bash
cd page-agent/frontend
npm install
npm run dev
```

打开 http://127.0.0.1:5173

---

## 演示脚本（面试）

1. **驾驶舱**：首页展示四维健康指数与角色 Top 榜  
2. **角色分析**：点开「沈砚」，看近 30 日讨论抬升  
3. **AI 助手**（推荐三条）：
   - `分析最近30天沈砚表现`
   - `设计沈砚生日活动方案`
   - `分析该IP未来一个月运营方向`
4. **知识问答**：在助手问「林疏影的人设与禁用表达」——命中 IP 规范知识库

无 API Key 时返回「种子降级报告」，指标仍来自真实库表，可完整演示闭环。

---

## 简历描述（可直接用）

**一句话**

> 玄策 — AI 驱动的国漫 IP 运营决策中台：打通资产/角色数据与 RAG 知识库，经 LangChain Agent 输出可执行运营策略；Page-Agent 嵌入日常页面操作。

**详细版**

> 设计并主导开发「玄策」国漫 IP 智能运营中心，覆盖运营驾驶舱、IP 资产管理、角色运营分析、AI 运营助手等决策闭环模块。将 LangChain Agent、LlamaIndex 知识库与 alibaba/page-agent 嵌入真实运营场景，实现「取数 → 分析 → 策略」自动化；构建角色热度、商业价值、舆情健康等指标体系，支持活动方案生成与负面反馈归因。技术栈：React + TypeScript + FastAPI + SQLite + ECharts + Qwen API。

---

## 目录结构

```
page-agent/
  backend/
    ai/           # Agent + RAG
    knowledge/    # IP 知识文档
    routers/      # cockpit / ip / ops-agent / stubs
    main.py
  frontend/
    src/pages/    # Cockpit / Characters / Assistant / ...
skills/           # Claude Skills（内容/数据/竞品等）
CONTEXT.md        # 领域共享上下文
```
