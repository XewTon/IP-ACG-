# 玄策 · 国漫IP智能运营中心

> XuanCe AI IP Operation Platform  
> AI 驱动的国漫 IP 运营决策中台（由原型项目演进，现为玄机科技（xjent.com）IP 运营中台）

面向国漫 IP / 游戏发行 / 内容运营团队的数据化运营工具，打通：

**IP资产管理 → 角色数据分析 → AI辅助决策**

演示 IP：玄机科技旗下《秦时明月》《斗罗大陆》等 10 部作品（官网 xjent.com 收录）

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
>
> **一键启动**：双击仓库根目录 `启动项目.bat`，会自动开三个窗口拉起 后端 / MediaCrawler / 前端，免手动开终端。

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

## 在线部署（免费）

想发布到公网并绑定自己的域名？见 **[部署指南.md](部署指南.md)** —— 已内置 Dockerfile / render.yaml / 精简依赖，
支持 Render 免费托管（一个服务同源跑前后端）、本机 Cloudflare 隧道、Hugging Face Spaces 三种 0 元方案。


## 演示脚本（面试）

1. **驾驶舱**：首页展示四维健康指数与角色 Top 榜  
2. **角色分析**：点开「盖聂」，看近 30 日讨论抬升  
3. **AI 助手**（推荐三条）：
   - `分析最近30天盖聂表现`
   - `设计盖聂生日活动方案`
   - `分析该IP未来一个月运营方向`
4. **知识问答**：在助手问「盖聂/少司命的设定与 IP 规范」——命中 IP 规范知识库

无 API Key 时返回「种子降级报告」，指标仍来自真实库表，可完整演示闭环。

---

## 视觉动效（开源范式参考）

启动动画与 3D 陈列的视觉能力均基于成熟开源范式，技术选型理由：

| 效果 | 参考开源项目 | 说明 |
|------|-------------|------|
| 启动动画（Cinematic 3D Boot） | [fbalda/particle-logo](https://github.com/fbalda/particle-logo)（GPGPU 粒子物理）· [codrops/RainEffect](https://github.com/codrops/RainEffect)（雨滴折射，用作页面氛围层） | 电影级开机序章（约 9.4s）：BLACKOUT → SYSTEM WAKE → SPACE ACTIVATION → IMAGE DETECTED → 粒子 3D 重建 IP 立绘 → **粒子让位、立绘以原色定格**（抠像贴图 + 镜头弧线环绕展示空间立体感）→ 空间 HUD LOCK → CAMERA FLY THROUGH → HYPERSPACE → XUANCE LOGO → ENTER；Bloom + 色差/颗粒/暗角后期，DOM HUD 带镜头视差；雨滴作为页面背景氛围层。`scripts/generate_splash_depth.py`（Depth Anything V2）可离线生成深度图资产，留待立体置换渲染稳定后启用 |
| 3D 画廊（`/3d` 默认模式） | [cynthiachiu/3D-Art-Gallery](https://github.com/cynthiachiu/3D-Art-Gallery)（交互范式：hover 缩放、鼠标视差、聚光照明） | 用项目既有 imperative three.js 栈实现（React 18 与 R3F9 的 peer 依赖不兼容，R3F 待整体升级 React 19 后启用）：悬停金框点亮 + 放大、视差跟随、多行自适应布局、点击查看素材详情 |
| 专业展柜（`/3d` 展柜模式） | three.js 展架（原图 / 墨影点云 / 立绘浮雕三种检视） | 点击展品拉出 → 轨道相机检视，点云 z=亮度深度，浮雕 displacementMap；条目多时分页展示 |
| 展示柜素材（按作品分区） | 玄机官网 [精美壁纸](https://www.xjent.com/100033/)（xjent.com） | `scripts/fetch-xuanji-wallpapers.mjs` 一键抓取官方壁纸（PNG 自动缩小重编码控体积）→ 展示柜按作品分区：秦时明月 / 天行九歌 / 武庚纪 / 斗罗大陆 / 天宝伏妖录 / 吞噬星空 / 师兄啊师兄 / 斗罗大陆Ⅱ绝世唐门 / 天谕 / 牧神记 / 官方壁纸精选；系列归属映射在 `xuanjiSeries.ts` 的 `SERIES_OVERRIDES` 一行可调 |

启动动画交互细节：**每次刷新均播放**（`?nosplash` 显式跳过，`prefers-reduced-motion` 自动跳过）；
点击 / 空格 / ESC 可随时跳过；WebGL 不可用自动切换为 CSS 电影级降级（终端 → Logo → ENTER），软渲染（SwiftShader 等）自动降粒子数与 Bloom。

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
