# ============================================================================
# 玄策 · 国漫IP智能运营中心 — 生产镜像（多阶段构建）
#   Stage 1: Node 构建前端 dist
#   Stage 2: Python 运行后端，并同源托管 dist（一个服务 = 前端 + API）
# 适用于 Render / Hugging Face Spaces / Fly.io / 任何 Docker 主机
# ============================================================================

# ---------- Stage 1: 前端构建 ----------
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY page-agent/frontend/package.json page-agent/frontend/package-lock.json ./
RUN npm ci
COPY page-agent/frontend/ ./
RUN npm run build

# ---------- Stage 2: Python 运行环境 ----------
FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app/backend

# 先装依赖（利用层缓存，代码变更不触发重装）
COPY page-agent/backend/requirements-deploy.txt ./
RUN pip install -r requirements-deploy.txt

# 后端代码 + 前端构建产物
COPY page-agent/backend/ ./
COPY --from=frontend /app/frontend/dist /app/frontend/dist

# 健康检查
HEALTHCHECK --interval=60s --timeout=5s --start-period=60s \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=5).status==200 else 1)" || exit 1

EXPOSE 8000
# Render 会注入 $PORT；本地 docker run 默认 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
