// 玄策 · IP运营驾驶舱
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import { getCockpitSummary, riskApi, planningApi, exportSummaryUrl, type CockpitSummary, type RiskAlert, type PlanningItem } from '../api'

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
  health: 'cockpit/summary · health 四维（热度/活跃/商业/口碑）',
  heat: 'cockpit/summary · heat_trend（metrics 近30日）',
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

/* 驾驶舱数据字典（页脚可折叠） */
const DATA_DICT: { table: string; content: string; collect: string }[] = [
  { table: 'metrics', content: '各平台粉丝/阅读/互动/互动率（每日快照）', collect: 'collectors（B站/微博/小红书/公众号）每日采集' },
  { table: 'follower_history', content: '全网粉丝增长历史', collect: 'metrics 派生，每日累计' },
  { table: 'content / content_posts', content: '已发布内容表现 / 排期内容状态', collect: '内容运营中心录入 + 发布回流' },
  { table: 'characters + character_daily_metrics', content: '角色搜索/讨论/粉丝增长/二创/商业价值 + 30日趋势', collect: '数据采集派生 + 可手动校准（角色分析页）' },
  { table: 'supply_tasks / client_requirements / activities', content: '外包任务 / 客户需求 / 运营活动', collect: '供应链协同中心录入' },
  { table: 'risk', content: '风险预警（逾期/断更/积压）', collect: '实时计算，非存储数据' },
]

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
  const nav = useNavigate()

  useEffect(() => {
    getCockpitSummary()
      .then(setData)
      .catch((e) => setErr(String(e.message || e)))
    riskApi.alerts().then((r) => setAlerts(r.data)).catch(() => {})
    planningApi.overview().then((r) => setPlan(r.data)).catch(() => {})
  }, [])

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
    { label: '当前IP', value: data.kpis.ip_count },
    { label: '用户规模', value: data.kpis.user_scale.toLocaleString() },
    { label: '今日热度', value: data.kpis.today_heat.toLocaleString() },
    { label: '活动数量', value: data.kpis.activity_count },
  ]

  const healthCards = [
    { label: 'IP热度指数', value: data.health.heat },
    { label: '用户活跃度', value: data.health.activity },
    { label: '商业潜力', value: data.health.commercial },
    { label: '舆情健康', value: data.health.sentiment },
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        {kpis.map((k) => (
          <div key={k.label} className="xj-panel" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: '0.625rem', color: 'var(--xj-muted)', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: ink, fontFamily: '"Noto Serif SC", serif' }}>{k.value}</div>
          </div>
        ))}
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr', gap: 12, marginBottom: 24 }}>
        <div className="xj-panel" style={{ padding: 8 }}>
          <ReactECharts option={healthOption} style={{ height: 220 }} opts={{ renderer: 'canvas' }} />
        </div>
        <div className="xj-panel" style={{ padding: 8 }}>
          <ReactECharts option={radarOption} style={{ height: 220 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {healthCards.map((h) => (
            <div key={h.label} className="xj-panel" style={{ padding: '16px 14px' }}>
              <div style={{ fontSize: '0.625rem', color: 'var(--xj-muted)' }}>{h.label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: gold, fontFamily: '"Noto Serif SC", serif', marginTop: 6 }}>{h.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="xj-panel" style={{ padding: '12px 12px 4px' }}>
          <div style={{ fontSize: '0.6875rem', color: gold, marginBottom: 4, paddingLeft: 8 }}>热度趋势（30日） <SourceTag k="heat" /></div>
          <ReactECharts option={heatOption} style={{ height: 220 }} />
        </div>
        <div className="xj-panel" style={{ padding: '12px 12px 4px' }}>
          <div style={{ fontSize: '0.6875rem', color: gold, marginBottom: 4, paddingLeft: 8 }}>平台来源占比 <SourceTag k="platform" /></div>
          <ReactECharts option={pieOption} style={{ height: 220 }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
        <div className="xj-panel" style={{ padding: '12px 12px 4px' }}>
          <div style={{ fontSize: '0.6875rem', color: gold, marginBottom: 4, paddingLeft: 8 }}>用户增长曲线 <SourceTag k="growth" /></div>
          <ReactECharts option={growthOption} style={{ height: 220 }} />
        </div>
        <div className="xj-panel" style={{ padding: '12px 12px 4px' }}>
          <div style={{ fontSize: '0.6875rem', color: gold, marginBottom: 4, paddingLeft: 8 }}>角色热度排名 <SourceTag k="rank" /></div>
          <ReactECharts option={rankOption} style={{ height: 220 }} />
        </div>
      </div>

      {/* 数据字典 */}
      <details style={{ marginTop: 20 }}>
        <summary style={{ fontSize: '0.625rem', color: 'var(--xj-muted)', cursor: 'pointer', fontFamily: '"Noto Sans SC",sans-serif' }}>
          数据来源字典（表 → 内容 → 采集方式）— 点击展开
        </summary>
        <div className="xj-panel" style={{ marginTop: 10, padding: '6px 0' }}>
          {DATA_DICT.map((d) => (
            <div key={d.table} style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1.4fr', gap: 10, padding: '8px 14px', fontSize: '0.625rem', borderBottom: '1px solid rgba(218,30,43,0.05)' }}>
              <span style={{ color: 'var(--xj-red)', fontWeight: 600, wordBreak: 'break-all' }}>{d.table}</span>
              <span style={{ color: 'var(--xj-ink-soft)' }}>{d.content}</span>
              <span style={{ color: 'var(--xj-faint)' }}>{d.collect}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
