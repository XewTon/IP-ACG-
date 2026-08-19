# ============================================================
# XuanCe - Render one-click deploy script (free plan)
# Usage:
#   .\scripts\deploy-render.ps1 -GitHubPat <PAT> -RenderApiKey <KEY>
# Notes:
#   - Tokens stay in process memory only, never written to disk.
#   - Flow: push to GitHub(main) -> create Render web service
#     (docker, free) -> poll deploy status.
#   - Keep this file ASCII-only (like 启动项目.bat) so it parses
#     correctly under any code page.
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

Write-Host '[1/4] push code to GitHub ...' -ForegroundColor Cyan
Push-Location $root
try {
  $pushUrl = 'https://x-access-token:' + $GitHubPat + '@github.com/' + $Repo + '.git'
  git -c http.sslBackend=openssl -c credential.helper= push $pushUrl "HEAD:$Branch"
  if ($LASTEXITCODE -ne 0) { throw 'git push failed' }
} finally { Pop-Location }
Write-Host '  pushed' -ForegroundColor Green

Write-Host '[2/4] get Render workspace ...' -ForegroundColor Cyan
$owners = Invoke-RestMethod -Uri 'https://api.render.com/v1/owners' -Headers $headers
$owner = $owners | Where-Object { $_.type -eq 'user' } | Select-Object -First 1
if (-not $owner) {
  throw 'no personal workspace found'
}
$ownerId = $owner.id
Write-Host ('  workspace: ' + $owner.name) -ForegroundColor Green

Write-Host '[3/4] create web service ...' -ForegroundColor Cyan
$body = @{
  type       = 'web_service'
  name       = $ServiceName
  ownerId    = $ownerId
  repo       = 'https://github.com/' + $Repo
  branch     = $Branch
  autoDeploy = 'yes'
  envVars    = @(
    @{ key = 'DASHSCOPE_MODEL'; value = 'qwen-turbo' }
  )
  serviceDetails = @{
    runtime            = 'docker'
    envSpecificDetails = @{
      dockerfilePath = './Dockerfile'
      dockerContext  = '.'
    }
    healthCheckPath    = '/api/health'
    plan               = 'free'
    numInstances       = 1
  }
} | ConvertTo-Json -Depth 8

$resp = Invoke-WebRequest -Method Post -Uri 'https://api.render.com/v1/services' -Headers $headers -Body $body -SkipHttpErrorCheck
if ($resp.StatusCode -ne 201) {
  Write-Host ('  create failed HTTP ' + $resp.StatusCode + ': ' + $resp.Content) -ForegroundColor Red
  Write-Host '  hint: if repo access is missing, install the Render GitHub App on this repo first (Dashboard -> New + -> Blueprint -> Connect GitHub)' -ForegroundColor Yellow
  exit 1
}
$result = $resp.Content | ConvertFrom-Json
$serviceId = $result.service.id
$deployId  = $result.deployId
$url       = $result.service.serviceDetails.url
$dash      = $result.service.dashboardUrl
Write-Host ('  serviceId=' + $serviceId) -ForegroundColor Green
Write-Host ('  deployId =' + $deployId) -ForegroundColor Green
Write-Host ('  URL      =' + $url) -ForegroundColor Green
Write-Host ('  console  =' + $dash) -ForegroundColor Green

Write-Host '[4/4] poll deploy status (first Docker build takes 5-15 min) ...' -ForegroundColor Cyan
$status = 'created'
for ($i = 1; $i -le 90; $i++) {
  Start-Sleep -Seconds 20
  try {
    $deploy = Invoke-RestMethod -Uri ("https://api.render.com/v1/services/" + $serviceId + "/deploys/" + $deployId) -Headers $headers
    $status = $deploy.status
  } catch {
    $status = 'poll-error'
  }
  Write-Host ('  [' + $i + '] ' + $status)
  if ($status -in @('live', 'build_failed', 'update_failed', 'canceled', 'deactivated')) { break }
}
Write-Host ('final status: ' + $status) -ForegroundColor Cyan
if ($status -eq 'live') {
  Write-Host '============================================' -ForegroundColor Green
  Write-Host ('  DEPLOYED! open: ' + $url) -ForegroundColor Green
  Write-Host '============================================' -ForegroundColor Green
} else {
  Write-Host ('deploy not live, check logs: ' + $dash) -ForegroundColor Red
}
