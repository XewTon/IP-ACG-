// 玄策 · IP运营驾驶舱
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import { getCockpitSummary, riskApi, planningApi, communityApi, exportSummaryUrl, type CockpitSummary, type RiskAlert, type PlanningItem } from '../api'
import SourceBadge from '../components/SourceBadge'

const gold = '#DA1E2B'
const ink = '#2A2E37'
const muted = '#8a8578'

const KIND_COLOR: Record<string, string> = { 内容: '#5B8C9E', 外包: '#DA1E2B', 需求: '#D9A845', 活动: '#2A2E37' }
const KIND_LINK: Record<string, string> = { 内容: '/content', 外包: '/outsourcing', 需求: '/outsourcing' }

/* 驾驶舱数据来源标注（字段 → 表/接口 → 采集方式） */
const SRC: Record<string, string> = {
  kpi: 'metrics / characters · 每日采集汇总',
  risk: 'risk 服务 · 实时计算（外包逾期 / 内容空档 / 验收积压）',
  plan: 'planning 聚合 · content_posts / supply_tasks / client_requirements / activities',
  health: 'cockpit/summary · health 四维（由明细表实时计算，口径见下方说明）',
  heat: 'cockpit/summary · heat_trend（character_daily_metrics 近30日）',
  platform: 'cockpit/summary · platform_share（metrics 最新快照）',
  growth: 'cockpit/summary · user_growth（follower_history）',
  rank: 'cockpit/summary · character_rank（characters + character_daily_metrics）',
}
function SourceTag({ k }: { k: string }) {
  return (
    <span style={{ fontSize: '0.5625rem', color: 'var(--xj-faint)', marginLeft: 8, fontWeight: 400, letterSpacing: '0.02em' }}>
      来源：{SRC[k] || k}
    </span>
  )
}

/* 健康四维计算口径（与后端 HEALTH_META 一致；后端返回 health_basis 后动态补充输入值） */
const HEALTH_CALC: Record<string, string> = {
  heat: '55×min(1,近7日日均讨论量/3000) + 45×min(1,最新全网阅读量/80000)',
  activity: '45×min(1,30日粉丝净增率/25%) + 15×min(1,进行中活动/3) + 15×min(1,近90日发布/10) + 25×min(1,粉丝/20000)',
  commercial: '45%×角色商业价值均值 + 35%×近7日商业分均值 + 20%×min(100,ROI均值×50)',
  sentiment: 'min(100, round((正面占比−负面占比+100)/2))',
}

/* 驾驶舱数据血缘字典（表 → 内容 → 采集方式 → 计算口径 → 状态），优先使用后端 meta 动态渲染 */
interface LineageRow { table: string; content: string; collect: string; calc: string; status?: string }

function dayIndex(start: string, today0: number): number {
  // 统一用本地时间解析 YYYY-MM-DD，避免 UTC/本地混用导致时间轴偏移一天
  const [y, m, d] = start.slice(0, 10).split('-').map(Number)
  const t = new Date(y, (m || 1) - 1, d || 1).getTime()
  return Math.round((t - today0) / 86400000)
}

export default function Cockpit() {
  const [data, setData] = useState<CockpitSummary | null>(null)
  const [err, setErr] = useState('')
  const [alerts, setAlerts] = useState<RiskAlert[]>([])
  const [plan, setPlan] = useState<PlanningItem[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const nav = useNavigate()

  useEffect(() => {
    getCockpitSummary()
      .then(setData)
      .catch((e) => setErr(String(e.message || e)))
    riskApi.alerts().then((r) => setAlerts(r.data)).catch(() => {})
    planningApi.overview().then((r) => setPlan(r.data)).catch(() => {})
  }, [])

  const syncRealDiscussions = async () => {
    setSyncing(true); setSyncMsg('')
    try {
      const r = await communityApi.syncDiscussions()
      setSyncMsg(r.message)
      const fresh = await getCockpitSummary()
      setData(fresh)
    } catch (e: any) {
      setSyncMsg('同步失败：' + String(e?.message || e))
    } finally {
      setSyncing(false)
    }
  }

  if (err) {
    return <div style={{ padding: '48px 32px', color: 'var(--xj-gold)' }}>驾驶舱加载失败：{err}（请确认后端已启动）</div>
  }
  if (!data) {
    return <div style={{ padding: '48px 32px', color: muted }}>加载运营驾驶舱...</div>
  }

  const healthOption = {
    tooltip: { trigger: 'item' },
    series: [{
      type: 'gauge',
      startAngle: 210,
      endAngle: -30,
      min: 0,
      max: 100,
      radius: '90%',
      axisLine: {
        lineStyle: {
          width: 14,
          color: [[0.6, '#3a4a5a'], [0.85, gold], [1, '#A13A2A']],
        },
      },
      pointer: { itemStyle: { color: gold } },
      axisTick: { show: false },
      splitLine: { length: 8, lineStyle: { color: muted } },
      axisLabel: { color: muted, fontSize: 10 },
      detail: {
        formatter: '{value}',
        color: ink,
        fontSize: 22,
        fontFamily: 'Noto Serif SC, serif',
        offsetCenter: [0, '60%'],
      },
      title: { color: muted, fontSize: 11, offsetCenter: [0, '82%'] },
      data: [{
        value: Math.round((data.health.heat + data.health.activity + data.health.commercial + data.health.sentiment) / 4),
        name: '综合健康',
      }],
    }],
  }

  const radarOption = {
    tooltip: {},
    radar: {
      indicator: [
        { name: 'IP热度', max: 100 },
        { name: '用户活跃', max: 100 },
        { name: '商业潜力', max: 100 },
        { name: '舆情健康', max: 100 },
      ],
      splitArea: { areaStyle: { color: ['rgba(218,30,43,0.02)', 'rgba(218,30,43,0.06)'] } },
      axisName: { color: muted, fontSize: 11 },
      splitLine: { lineStyle: { color: 'rgba(218,30,43,0.2)' } },
    },
    series: [{
      type: 'radar',
      data: [{
        value: [data.health.heat, data.health.activity, data.health.commercial, data.health.sentiment],
        name: data.ip.name,
        areaStyle: { color: 'rgba(218,30,43,0.25)' },
        lineStyle: { color: gold },
        itemStyle: { color: gold },
      }],
    }],
  }

  const heatOption = {
    grid: { left: 40, right: 16, top: 24, bottom: 28 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: data.heat_trend.map((d) => d.date.slice(5)),
      axisLabel: { color: muted, fontSize: 10 },
      axisLine: { lineStyle: { color: 'rgba(218,30,43,0.2)' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: muted, fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(218,30,43,0.08)' } },
    },
    series: [{
      type: 'line',
      data: data.heat_trend.map((d) => d.heat),
      smooth: true,
      symbol: 'none',
      lineStyle: { color: gold, width: 2 },
      areaStyle: { color: 'rgba(218,30,43,0.15)' },
    }],
  }

  const growthOption = {
    grid: { left: 48, right: 16, top: 24, bottom: 28 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: data.user_growth.map((d) => d.date.slice(5)),
      axisLabel: { color: muted, fontSize: 10 },
      axisLine: { lineStyle: { color: 'rgba(218,30,43,0.2)' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: muted, fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(218,30,43,0.08)' } },
    },
    series: [{
      type: 'line',
      data: data.user_growth.map((d) => d.followers),
      smooth: true,
      symbol: 'none',
      lineStyle: { color: '#6a8a9a', width: 2 },
      areaStyle: { color: 'rgba(106,138,154,0.18)' },
    }],
  }

  const pieOption = {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: muted, fontSize: 11 } },
    series: [{
      type: 'pie',
      radius: ['42%', '68%'],
      label: { color: ink, fontSize: 11 },
      data: data.platform_share.map((p) => ({
        name: ({ bilibili: 'B站', weibo: '微博', xiaohongshu: '小红书', wechat: '公众号' } as Record<string, string>)[p.platform] || p.platform,
        value: p.followers,
      })),
      color: [gold, '#A13A2A', '#6a8a9a', '#8a7a5a'],
    }],
  }

  const rankOption = {
    grid: { left: 56, right: 24, top: 16, bottom: 24 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'value',
      axisLabel: { color: muted },
      splitLine: { lineStyle: { color: 'rgba(218,30,43,0.08)' } },
    },
    yAxis: {
      type: 'category',
      data: [...data.character_rank].reverse().map((c) => c.name),
      axisLabel: { color: ink },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [{
      type: 'bar',
      data: [...data.character_rank].reverse().map((c) => c.discussions),
      itemStyle: { color: gold },
      barWidth: 14,
    }],
  }

  const kpis = [
    { kkey: 'character_count', label: '当前IP', value: data.kpis.ip_count, basis: 'ips 表首条（当前演示IP，可切换）' },
    { kkey: 'user_scale', label: '用户规模', value: data.kpis.user_scale.toLocaleString(), basis: 'metrics 各平台最新快照粉丝之和' },
    { kkey: 'today_heat', label: '今日热度', value: data.kpis.today_heat.toLocaleString(), basis: 'character_daily_metrics 最近一日讨论量之和' },
    { kkey: 'activity_count', label: '活动数量', value: data.kpis.activity_count, basis: 'activities 表当前IP活动计数' },
  ]

  const healthCards = [
    { key: 'heat', label: 'IP热度指数', value: data.health.heat },
    { key: 'activity', label: '用户活跃度', value: data.health.activity },
    { key: 'commercial', label: '商业潜力', value: data.health.commercial },
    { key: 'sentiment', label: '舆情健康', value: data.health.sentiment },
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 32px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 className="xj-section-title" style={{ padding: '0 0 6px', margin: 0 }}>IP 运营驾驶舱</h2>
          <p style={{ fontSize: '0.625rem', color: 'var(--xj-muted)', margin: '0 0 24px' }}>
            {data.ip.name}（{data.ip.name_en}）· {data.ip.type} · 决策闭环总览
          </p>
        </div>
        <a
          href={exportSummaryUrl()}
          className="xj-btn"
          style={{ padding: '8px 18px', fontSize: '0.6875rem', textDecoration: 'none' }}
        >
          导出数据 CSV
        </a>
      </div>

      {alerts.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: '0.6875rem', color: gold, marginBottom: 8, fontFamily: '"Noto Serif SC",serif' }}>风险预警 <SourceTag k="risk" /></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alerts.map((a) => (
              <button
                key={a.type}
                onClick={() => a.link && nav(a.link)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: 6,
                  width: '100%',
                  minWidth: 0,
                  textAlign: 'left',
                  cursor: a.link ? 'pointer' : 'default',
                  background: a.level === 'red' ? 'rgba(218,30,43,0.06)' : 'rgba(217,168,69,0.1)',
                  border: a.level === 'red' ? '1px solid rgba(218,30,43,0.35)' : '1px solid rgba(217,168,69,0.4)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontFamily: '"Noto Sans SC",sans-serif',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minWidth: 0 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: a.level === 'red' ? '#DA1E2B' : '#D9A845',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: ink, whiteSpace: 'nowrap', flexShrink: 0 }}>{a.title}</span>
                  <span style={{ fontSize: '0.6875rem', color: muted, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.detail}</span>
                  <span style={{ fontSize: '0.6875rem', color: a.level === 'red' ? '#A13A2A' : '#8a7a2a', flexShrink: 0 }}>{a.link ? '前往处理 →' : ''}</span>
                </div>
                {a.suggestion && (
                  <div style={{ fontSize: '0.625rem', color: muted, lineHeight: 1.7, paddingLeft: 20, minWidth: 0 }}>
                    <span style={{ color: a.level === 'red' ? '#A13A2A' : '#8a7a2a', fontWeight: 600 }}>解决方案：</span>
                    {a.suggestion}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: '0.6875rem', color: gold, marginBottom: 8, fontFamily: '"Noto Serif SC",serif' }}>核心指标 <SourceTag k="kpi" /></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
        {kpis.map((k) => {
          const kmeta = data.meta?.kpis?.find((x) => x.key === k.kkey)
          return (
            <div key={k.label} className="xj-panel" style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: '0.625rem', color: 'var(--xj-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>{k.label} <SourceBadge status={kmeta?.status} /></div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, color: ink, fontFamily: '"Noto Serif SC", serif' }}>{k.value}</div>
              <div style={{ fontSize: '0.5rem', color: 'var(--xj-faint)', marginTop: 6, lineHeight: 1.5 }}>依据：{k.basis}</div>
            </div>
          )
        })}
      </div>

      {/* 讨论量真实来源状态（逻辑闭环标注） */}
      <div className="xj-panel" style={{ padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: '0.6875rem', color: gold, fontFamily: '"Noto Serif SC",serif' }}>
            讨论量数据状态：
            {data.discussion_status?.has_real
              ? <span style={{ color: '#4a6a4a' }}> 真实采集（MediaCrawler 评论聚合）</span>
              : <span style={{ color: '#8a7a2a' }}> 演示种子（尚未同步真实评论）</span>}
          </div>
          <div style={{ fontSize: '0.5625rem', color: 'var(--xj-faint)', marginTop: 4, lineHeight: 1.6 }}>
            {data.discussion_status?.has_real
              ? `已覆盖 ${data.discussion_status.crawler_chars} 个角色 / ${data.discussion_status.crawler_days} 个日期的真实讨论量`
              : '今日热度/热度趋势/角色榜/健康-热度 当前基于 seed 种子数据；点右侧按钮从 MediaCrawler 真实评论聚合讨论量后自动切换为真实采集。'}
          </div>
        </div>
        <button
          className="xj-btn"
          disabled={syncing}
          onClick={syncRealDiscussions}
          style={{ padding: '8px 16px', fontSize: '0.625rem', flexShrink: 0 }}
        >
          {syncing ? '同步中...' : '同步真实讨论量'}
        </button>
        {syncMsg && <div style={{ flexBasis: '100%', fontSize: '0.5625rem', color: 'var(--xj-ink-soft)', lineHeight: 1.6 }}>{syncMsg}</div>}
      </div>

      {/* 项目统筹时间轴 */}
      <div className="xj-panel" style={{ padding: '16px 18px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: '0.75rem', color: gold, fontFamily: '"Noto Serif SC",serif' }}>项目统筹 · 后续 14 日周期 <SourceTag k="plan" /></span>
          <span style={{ fontSize: '0.625rem', color: muted }}>
            内容·外包·需求·活动 一屏统筹{plan.length > 0 ? `（${plan.length} 节点）` : ''}
          </span>
        </div>
        {plan.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', fontSize: '0.6875rem', color: muted }}>
            暂无近期周期节点 —— 在「内容运营 / 供应链 / 客户需求」录入排期后将在此统筹展示
          </div>
        ) : (
          <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
            {(() => {
              const today0 = new Date(); today0.setHours(0, 0, 0, 0)
              const t0 = today0.getTime()
              const days = 14
              const cell = 42
              const groups = ['内容', '外包', '需求', '活动']
              return (
                <div style={{ minWidth: days * cell + 84 }}>
                  <div style={{ display: 'flex', marginBottom: 8 }}>
                    <div style={{ width: 84, flexShrink: 0 }} />
                    {Array.from({ length: days }).map((_, i) => {
                      const d = new Date(t0 + i * 86400000)
                      return (
                        <div key={i} style={{ width: cell, fontSize: '0.5625rem', color: muted, textAlign: 'center', flexShrink: 0 }}>
                          {`${d.getMonth() + 1}/${d.getDate()}`}
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ height: 8, position: 'relative', marginLeft: 84, width: days * cell, marginBottom: 4 }}>
                    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 8, background: 'rgba(218,30,43,0.05)', borderBottom: '1px solid rgba(218,30,43,0.12)' }} />
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 1, background: 'rgba(218,30,43,0.5)' }} />
                  </div>
                  {groups.map((g) => (
                    <div key={g} style={{ display: 'flex', alignItems: 'center', height: 34, borderBottom: '1px solid rgba(218,30,43,0.06)' }}>
                      <div style={{ width: 84, fontSize: '0.625rem', color: ink, flexShrink: 0 }}>{g}</div>
                      <div style={{ position: 'relative', width: days * cell, height: 30, flexShrink: 0 }}>
                        {plan.filter((p) => p.group === g).map((p) => {
                          const d0 = Math.max(0, dayIndex(p.start, t0))
                          const d1 = Math.max(d0, dayIndex(p.end, t0))
                          const left = d0 * cell
                          const w = (d1 - d0 + 1) * cell - 4
                          const overdue = p.kind === 'task' && (p.status === '逾期' || String(p.status).includes('超期'))
                          return (
                            <div
                              key={p.id}
                              onClick={() => { const to = KIND_LINK[g]; if (to) nav(to) }}
                              title={p.title}
                              style={{
                                position: 'absolute',
                                left,
                                top: 4,
                                width: Math.max(20, w),
                                height: 22,
                                background: KIND_COLOR[g],
                                color: '#ffffff',
                                borderRadius: 4,
                                padding: '0 6px',
                                fontSize: '0.5625rem',
                                lineHeight: '22px',
                                cursor: KIND_LINK[g] ? 'pointer' : 'default',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                boxShadow: '0 1px 3px rgba(42,46,55,0.2)',
                                opacity: overdue ? 1 : 0.92,
                              }}
                            >
                              {overdue ? '⚠ ' : ''}{p.title}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        )}
      </div>

      <h3 style={{ fontSize: '0.75rem', color: gold, marginBottom: 10, fontFamily: '"Noto Serif SC", serif' }}>IP 健康指数 <SourceTag k="health" /></h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr', gap: 12, marginBottom: 12 }}>
        <div className="xj-panel" style={{ padding: 8 }}>
          <ReactECharts option={healthOption} style={{ height: 220 }} opts={{ renderer: 'canvas' }} />
        </div>
        <div className="xj-panel" style={{ padding: 8 }}>
          <ReactECharts option={radarOption} style={{ height: 220 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {healthCards.map((h) => {
            const basis = data.health_basis?.[h.key]
            const hmeta = data.meta?.health?.find((x) => x.key === h.key)
            return (
              <div key={h.label} className="xj-panel" style={{ padding: '14px' }}>
                <div style={{ fontSize: '0.625rem', color: 'var(--xj-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>{h.label} <SourceBadge status={hmeta?.status} /></div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: gold, fontFamily: '"Noto Serif SC", serif', marginTop: 4 }}>{h.value}</div>
                <div style={{ fontSize: '0.5625rem', color: basis?.computed ? 'var(--xj-faint)' : '#A13A2A', marginTop: 4, lineHeight: 1.5 }}>
                  {basis?.computed
                    ? `实时计算 · ${Object.entries(basis.inputs).map(([k, v]) => `${k}=${v}`).join('，')}`
                    : '⚠ 明细数据缺失，回退 ips 静态列'}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 健康四维计算口径（逻辑闭环说明） */}
      <div className="xj-panel" style={{ padding: '12px 16px', marginBottom: 20 }}>
        <div style={{ fontSize: '0.6875rem', color: gold, marginBottom: 8, fontFamily: '"Noto Serif SC",serif' }}>
          健康四维 · 计算口径（明细表实时计算，非静态值）
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 18px' }}>
          {Object.entries(HEALTH_CALC).map(([k, calc]) => (
            <div key={k} style={{ fontSize: '0.625rem', color: 'var(--xj-ink-soft)', lineHeight: 1.6 }}>
              <span style={{ color: 'var(--xj-red)', fontWeight: 600 }}>{k}</span>
              <span style={{ color: 'var(--xj-faint)' }}> = {calc}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: '0.5625rem', color: 'var(--xj-faint)', marginTop: 8, lineHeight: 1.7 }}>
          闭环链路：collectors/录入 → SQLite 明细表（metrics · follower_history · character_daily_metrics · sentiment_snapshots · activities · content）→
          cockpit 服务按口径计算 → 驾驶舱展示 → 风险预警/运营决策 → 行动回流为新数据。明细表无数据时自动回退 ips 静态列并在卡片标注。
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="xj-panel" style={{ padding: '12px 12px 4px' }}>
          <div style={{ fontSize: '0.6875rem', color: gold, marginBottom: 4, paddingLeft: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            热度趋势（30日） <SourceTag k="heat" /> <SourceBadge status={data.meta?.heat_trend?.status} />
          </div>
          <ReactECharts option={heatOption} style={{ height: 220 }} />
        </div>
        <div className="xj-panel" style={{ padding: '12px 12px 4px' }}>
          <div style={{ fontSize: '0.6875rem', color: gold, marginBottom: 4, paddingLeft: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            平台来源占比 <SourceTag k="platform" /> <SourceBadge status={data.meta?.platform_share?.status} />
          </div>
          <ReactECharts option={pieOption} style={{ height: 220 }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
        <div className="xj-panel" style={{ padding: '12px 12px 4px' }}>
          <div style={{ fontSize: '0.6875rem', color: gold, marginBottom: 4, paddingLeft: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            用户增长曲线 <SourceTag k="growth" /> <SourceBadge status={data.meta?.user_growth?.status} />
          </div>
          <ReactECharts option={growthOption} style={{ height: 220 }} />
        </div>
        <div className="xj-panel" style={{ padding: '12px 12px 4px' }}>
          <div style={{ fontSize: '0.6875rem', color: gold, marginBottom: 4, paddingLeft: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            角色热度排名 <SourceTag k="rank" /> <SourceBadge status={data.meta?.character_rank?.status} />
          </div>
          <ReactECharts option={rankOption} style={{ height: 220 }} />
        </div>
      </div>

      {/* 数据血缘字典（来源表 → 采集方式 → 计算口径；优先后端 meta 动态渲染） */}
      <details style={{ marginTop: 20 }}>
        <summary style={{ fontSize: '0.625rem', color: 'var(--xj-muted)', cursor: 'pointer', fontFamily: '"Noto Sans SC",sans-serif' }}>
          数据血缘字典（来源表 → 采集方式 → 计算口径 → 更新频率）— 点击展开
        </summary>
        <div className="xj-panel" style={{ marginTop: 10, padding: '6px 0' }}>
          {(() => {
            const m = data.meta
            if (!m) return null
            const rows: LineageRow[] = [
              { table: 'kpis（核心指标）', content: '用户规模 / 今日热度 / 活动数 / 角色数', collect: m.kpis.map((k) => k.collect).join('；'), calc: m.kpis.map((k) => `${k.label}=${k.calc}`).join('；'), status: m.kpis.map((k) => k.status).includes('real') || m.kpis.map((k) => k.status).includes('mixed') ? 'mixed' : 'seed' },
              ...m.health.map((h) => ({ table: `health.${h.key}（${h.label}）`, content: h.label, collect: h.collect, calc: h.calc, status: h.status })),
              { table: 'heat_trend（热度趋势）', content: '近30日全角色讨论量合计', collect: m.heat_trend.collect, calc: m.heat_trend.calc, status: m.heat_trend.status },
              { table: 'user_growth（用户增长）', content: '近30日全网粉丝', collect: m.user_growth.collect, calc: m.user_growth.calc, status: m.user_growth.status },
              { table: 'platform_share（平台占比）', content: '各平台粉丝相对占比', collect: m.platform_share.collect, calc: m.platform_share.calc, status: m.platform_share.status },
              { table: 'character_rank（角色热度榜）', content: '角色讨论量排名', collect: m.character_rank.collect, calc: m.character_rank.calc, status: m.character_rank.status },
              { table: 'sentiment（舆情）', content: '最新快照正/中/负占比', collect: m.sentiment.collect, calc: m.sentiment.calc, status: m.sentiment.status },
              { table: 'risk（风险预警）', content: '逾期/空档/积压', collect: m.risk.collect, calc: m.risk.calc, status: m.risk.status },
              { table: 'plan（项目统筹）', content: '未来14日周期', collect: m.plan.collect, calc: m.plan.calc, status: m.plan.status },
            ]
            return (
              <>
                {rows.map((d) => (
                  <div key={d.table} style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.2fr 1.3fr 1.4fr 0.8fr', gap: 10, padding: '8px 14px', fontSize: '0.625rem', borderBottom: '1px solid rgba(218,30,43,0.05)' }}>
                    <span style={{ color: 'var(--xj-red)', fontWeight: 600, wordBreak: 'break-all' }}>{d.table}</span>
                    <span style={{ color: 'var(--xj-ink-soft)' }}>{d.content}</span>
                    <span style={{ color: 'var(--xj-faint)' }}>{d.collect}</span>
                    <span style={{ color: 'var(--xj-ink-soft)' }}>{d.calc}</span>
                    <span><SourceBadge status={d.status} /></span>
                  </div>
                ))}
                <div style={{ padding: '8px 14px', fontSize: '0.5625rem', color: 'var(--xj-faint)' }}>
                  血缘字典更新于 {m.updated_at} · 各业务中心录入/采集后自动生效
                </div>
              </>
            )
          })()}
        </div>
      </details>
    </div>
  )
}
