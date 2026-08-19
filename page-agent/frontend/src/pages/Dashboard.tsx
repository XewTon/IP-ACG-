// 玄策 · 数据仪表盘 —— 四维指标 + 竞品 + AI周报 + 3D 地域分布
import { lazy, Suspense, useEffect, useState } from 'react'
import ErrorBoundary from '../components/ErrorBoundary'

// 3D 地球较重（three-globe），懒加载拆包，避免拖慢首屏
const Globe3D = lazy(() => import('../components/Globe3D'))

interface Metric { value: number; change?: string; unit?: string }
interface Metrics {
  content: Record<string, Metric>
  user: Record<string, Metric>
  supply: Record<string, Metric>
  ipHealth: Record<string, any>
  sources?: Record<string, string>
}
interface Competitor { name: string; platform: string; followers: number; growth: string; strategy: string; threat: string }

const UNIT_LABEL: Record<string, string> = {
  exposure: '曝光量', clickRate: '点击率', engagementRate: '互动率', shareRate: '转发率',
  totalFollowers: '全网粉丝', activeUsers: '周活跃用户', communityParticipation: '社群参与',
  onTimeDelivery: '按时交付率', avgRevisions: '平均修改轮次', costControl: '成本控制率',
}

// 单位来自后端 metric.unit，不再用「<100 即百分比」的猜测
function MetricBox({ label, metric }: { label: string; metric: Metric }) {
  const v = typeof metric.value === 'number' ? metric.value.toLocaleString() : String(metric.value ?? '—')
  const unit = metric.unit ?? ''
  return (
    <div className="xj-panel" style={{ padding: '16px 18px' }}>
      <div style={{ fontSize: '0.625rem', color: 'var(--xj-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--xj-ink)', fontFamily: '"Noto Serif SC",serif' }}>
        {v}{unit}
      </div>
      <div style={{ fontSize: '0.625rem', color: metric.change?.startsWith('+') ? '#6a8a6a' : 'var(--xj-gold)', marginTop: 2 }}>
        {metric.change ?? '—'}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [error, setError] = useState('')
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [report, setReport] = useState('')
  const [reporting, setReporting] = useState(false)
  const [reportError, setReportError] = useState('')

  useEffect(() => {
    let alive = true
    Promise.all([
      fetch('/api/dashboard/metrics').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() }),
      fetch('/api/dashboard/competitors').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() }),
    ])
      .then(([m, c]) => { if (alive) { setMetrics(m); setCompetitors(c.data || []) } })
      .catch(e => { if (alive) setError(String(e?.message || e)) })
    return () => { alive = false }
  }, [])

  const genReport = async () => {
    setReporting(true)
    setReportError('')
    try {
      const r = await fetch('/api/dashboard/weekly-report')
      if (!r.ok) throw new Error('HTTP ' + r.status)
      const d = await r.json()
      setReport(d.content)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setReportError('周报生成失败：' + msg + '（请确认后端服务已启动）')
    } finally {
      setReporting(false)
    }
  }

  if (!metrics) {
    return (
      <div style={{ padding: '48px 32px', color: 'var(--xj-faint)' }}>
        {error ? (
          <div style={{ color: 'var(--xj-red)', fontSize: '0.75rem' }}>
            数据加载失败：{error}（请确认后端服务已启动）
          </div>
        ) : '加载中...'}
      </div>
    )
  }

  const heat = (metrics.ipHealth.characterHeat || {}) as Record<string, number>
  const heatEntries = Object.entries(heat)

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '48px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 className="xj-section-title" style={{ padding: '0 0 6px', margin: 0 }}>数据仪表盘</h2>
          <p style={{ fontSize: '0.625rem', color: 'var(--xj-muted)', margin: '0 0 28px' }}>四维指标：内容 · 用户 · 供应链 · IP健康（数据来源见页脚）</p>
        </div>
        <a href="/api/export/summary" className="xj-btn" style={{ padding: '8px 18px', fontSize: '0.6875rem', textDecoration: 'none' }}>导出数据 CSV</a>
      </div>

      {/* 内容指标 */}
      <h3 style={{ fontSize: '0.75rem', color: 'var(--xj-red)', marginBottom: 10, fontFamily: '"Noto Serif SC",serif' }}>内容指标</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 24 }}>
        {Object.entries(metrics.content).map(([k, v]) => <MetricBox key={k} label={UNIT_LABEL[k] || k} metric={v} />)}
      </div>

      {/* 用户指标 */}
      <h3 style={{ fontSize: '0.75rem', color: 'var(--xj-red)', marginBottom: 10, fontFamily: '"Noto Serif SC",serif' }}>用户指标</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 24 }}>
        {Object.entries(metrics.user).map(([k, v]) => <MetricBox key={k} label={UNIT_LABEL[k] || k} metric={v} />)}
      </div>

      {/* 供应链指标 */}
      <h3 style={{ fontSize: '0.75rem', color: 'var(--xj-red)', marginBottom: 10, fontFamily: '"Noto Serif SC",serif' }}>供应链指标</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 24 }}>
        {Object.entries(metrics.supply).map(([k, v]) => <MetricBox key={k} label={UNIT_LABEL[k] || k} metric={v} />)}
      </div>

      {/* IP健康 */}
      <h3 style={{ fontSize: '0.75rem', color: 'var(--xj-red)', marginBottom: 10, fontFamily: '"Noto Serif SC",serif' }}>IP 健康</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 24 }}>
        <MetricBox label="用户喜爱度" metric={metrics.ipHealth.userLove} />
        <MetricBox label="品牌一致性" metric={metrics.ipHealth.brandConsistency} />
        <div className="xj-panel" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '0.625rem', color: 'var(--xj-muted)', marginBottom: 4 }}>角色热度</div>
          {heatEntries.length ? heatEntries.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--xj-faint)', marginTop: 2 }}><span>{k}</span><span style={{ color: 'var(--xj-red)' }}>{typeof v === 'number' ? v.toLocaleString() : v}</span></div>
          )) : <div style={{ fontSize: '0.625rem', color: 'var(--xj-faint)' }}>暂无数据</div>}
        </div>
        <MetricBox label="内容生命周期" metric={metrics.ipHealth.contentLifecycle} />
      </div>

      {/* 竞品 */}
      <h3 style={{ fontSize: '0.75rem', color: 'var(--xj-red)', marginBottom: 10, fontFamily: '"Noto Serif SC",serif' }}>竞品动态</h3>
      <div className="xj-panel" style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.6fr 0.6fr 0.5fr 1fr 0.5fr', padding: '8px 18px', borderBottom: '1px solid rgba(218,30,43,0.12)', fontSize: '0.625rem', color: 'var(--xj-muted)' }}><span>IP</span><span>平台</span><span>粉丝</span><span>增长</span><span>策略</span><span>威胁</span></div>
        {competitors.map((c, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 0.6fr 0.6fr 0.5fr 1fr 0.5fr', padding: '12px 18px', fontSize: '0.75rem', alignItems: 'center', borderBottom: i < competitors.length - 1 ? '1px solid rgba(218,30,43,0.04)' : 'none', background: c.threat === 'medium' ? 'rgba(218,30,43,0.03)' : 'transparent' }}>
            <span style={{ color: 'var(--xj-ink)', fontWeight: 500 }}>{c.name}</span>
            <span style={{ color: 'var(--xj-faint)' }}>{c.platform}</span>
            <span style={{ color: 'var(--xj-ink)' }}>{c.followers.toLocaleString()}</span>
            <span style={{ color: c.growth.startsWith('+') ? '#6a8a6a' : 'var(--xj-gold)' }}>{c.growth}</span>
            <span style={{ color: 'var(--xj-faint)', fontSize: '0.6875rem' }}>{c.strategy}</span>
            <span style={{ color: c.threat === 'medium' ? 'var(--xj-red)' : 'var(--xj-muted)', fontSize: '0.625rem' }}>{c.threat === 'medium' ? '⚠ 关注' : '正常'}</span>
          </div>
        ))}
        {!competitors.length && <div style={{ padding: '12px 18px', fontSize: '0.6875rem', color: 'var(--xj-faint)' }}>暂无竞品数据</div>}
      </div>

      {/* AI周报 */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: '0.75rem', color: 'var(--xj-red)', margin: 0, fontFamily: '"Noto Serif SC",serif' }}>AI 运营周报</h3>
        <button className="xj-btn" style={{ padding: '6px 16px', fontSize: '0.625rem' }} onClick={genReport} disabled={reporting}>{reporting ? '生成中...' : '生成周报'}</button>
      </div>
      {reportError && <div style={{ fontSize: '0.625rem', color: 'var(--xj-red)', marginBottom: 8 }}>{reportError}</div>}
      {report && <div className="xj-panel" style={{ padding: 20, fontSize: '0.6875rem', color: 'var(--xj-faint)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{report}</div>}

      {/* 地域分布 · 3D 全球 */}
      <div style={{ marginTop: 28 }}>
        <Suspense fallback={<div className="xj-panel" style={{ padding: 18, fontSize: '0.6875rem', color: 'var(--xj-faint)' }}>加载 3D 地球…</div>}>
          <ErrorBoundary>
            <Globe3D />
          </ErrorBoundary>
        </Suspense>
      </div>

      {/* 数据来源说明 */}
      {metrics.sources && (
        <div className="xj-panel" style={{ marginTop: 24, padding: 16 }}>
          <div style={{ fontSize: '0.625rem', color: 'var(--xj-muted)', marginBottom: 6 }}>数据来源</div>
          {Object.entries(metrics.sources).map(([k, v]) => (
            <div key={k} style={{ fontSize: '0.625rem', color: '#4a4540', lineHeight: 1.7 }}>
              <span style={{ color: 'var(--xj-ink)' }}>{k}</span>：{v}
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: '0.5625rem', color: '#4a4540', paddingTop: 24 }}>数据仪表盘对接 Metabase 风格极简图表 · 竞品扫描由 competitor-scan 每周一自动触发 · 周报由 analyze-data Skill 生成</p>
    </div>
  )
}
