# ============================================================
# 玄策 · Render 一键自动部署脚本（免费档）
# 用法:
#   .\scripts\deploy-render.ps1 -GitHubPat <PAT> -RenderApiKey <KEY>
# 说明:
#   - 令牌仅在进程内存中使用，不写入磁盘、不提交仓库；用完请到后台撤销
#   - 流程: 推代码到 GitHub(main) → 建 Render web service(docker, free) → 轮询部署状态
# ============================================================
param(
  [Parameter(Mandatory = $true)][string]$GitHubPat,
  [Parameter(Mandatory = $true)][string]$RenderApiKey,
  [string]$Repo = 'XewTon/IP-ACG-',
  [string]$Branch = 'main',
  [string]$ServiceName = 'xuance'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$headers = @{ Authorization = "Bearer $RenderApiKey"; 'Content-Type' = 'application/json' }

Write-Host "[1/4] 推送代码到 GitHub (branch: $Branch) ..." -ForegroundColor Cyan
Push-Location $root
try {
  git -c credential.helper= push "https://x-access-token:$GitHubPat@github.com/$Repo.git" "HEAD:$Branch"
  if ($LASTEXITCODE -ne 0) { throw "git push 失败 (exit $LASTEXITCODE)" }
} finally { Pop-Location }
Write-Host "  推送完成" -ForegroundColor Green

Write-Host "[2/4] 获取 Render workspace ..." -ForegroundColor Cyan
$owners = Invoke-RestMethod -Uri 'https://api.render.com/v1/owners' -Headers $headers
$owner = $owners | Where-Object { $_.type -eq 'user' } | Select-Object -First 1
if (-not $owner) {
  throw "未找到个人 workspace，返回: $($owners | ConvertTo-Json -Compress)"
}
Write-Host "  workspace: $($owner.name) ($($owner.id))" -ForegroundColor Green

Write-Host "[3/4] 创建 web service ($ServiceName, plan=free, runtime=docker) ..." -ForegroundColor Cyan
$body = @{
  type        = 'web_service'
  name        = $ServiceName
  ownerId     = $owner.id
  repo        = "https://github.com/$Repo"
  branch      = $Branch
  autoDeploy  = 'yes'
  envVars     = @(
    @{ key = 'DASHSCOPE_MODEL'; value = 'qwen-turbo' }
  )
  serviceDetails = @{
    runtime           = 'docker'
    envSpecificDetails = @{
      dockerfilePath = './Dockerfile'
      dockerContext  = '.'
    }
    healthCheckPath   = '/api/health'
    plan              = 'free'
    numInstances      = 1
  }
} | ConvertTo-Json -Depth 8

$resp = Invoke-WebRequest -Method Post -Uri 'https://api.render.com/v1/services' -Headers $headers -Body $body -SkipHttpErrorCheck
if ($resp.StatusCode -ne 201) {
  Write-Host "  创建失败 HTTP $($resp.StatusCode): $($resp.Content)" -ForegroundColor Red
  Write-Host "  提示: 若提示仓库无权限，请先在 Render 安装 GitHub App 授权本仓库（Dashboard → New + → Blueprint → Connect GitHub）" -ForegroundColor Yellow
  exit 1
}
$result = $resp.Content | ConvertFrom-Json
$serviceId = $result.service.id
$deployId  = $result.deployId
$url       = $result.service.serviceDetails.url
$dash      = $result.service.dashboardUrl
Write-Host "  serviceId=$serviceId" -ForegroundColor Green
Write-Host "  deployId =$deployId" -ForegroundColor Green
Write-Host "  访问地址 =$url" -ForegroundColor Green
Write-Host "  控制台   =$dash" -ForegroundColor Green

Write-Host "[4/4] 轮询部署状态（首次 Docker 构建约 5-15 分钟）..." -ForegroundColor Cyan
$status = 'created'
for ($i = 1; $i -le 90; $i++) {
  Start-Sleep -Seconds 20
  try {
    $deploy = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$serviceId/deploys/$deployId" -Headers $headers
    $status = $deploy.status
  } catch {
    $status = 'poll-error'
  }
  Write-Host "  [${i}] $status"
  if ($status -in @('live', 'build_failed', 'update_failed', 'canceled', 'deactivated')) { break }
}
Write-Host "最终状态: $status" -ForegroundColor Cyan
if ($status -eq 'live') {
  Write-Host "============================================================" -ForegroundColor Green
  Write-Host "  部署成功！访问: $url" -ForegroundColor Green
  Write-Host "============================================================" -ForegroundColor Green
} else {
  Write-Host "部署未成功，请到控制台查看构建日志: $dash" -ForegroundColor Red
}
