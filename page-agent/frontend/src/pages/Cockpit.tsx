// 玄策 · IP运营驾驶舱
import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { getCockpitSummary, type CockpitSummary } from '../api'

const gold = '#C89B3C'
const ink = '#e8e0d0'
const muted = '#8a8578'

export default function Cockpit() {
  const [data, setData] = useState<CockpitSummary | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    getCockpitSummary()
      .then(setData)
      .catch((e) => setErr(String(e.message || e)))
  }, [])

  if (err) {
    return <div style={{ padding: '48px 32px', color: '#c9a96e' }}>驾驶舱加载失败：{err}（请确认后端已启动）</div>
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
      splitArea: { areaStyle: { color: ['rgba(200,155,60,0.02)', 'rgba(200,155,60,0.06)'] } },
      axisName: { color: muted, fontSize: 11 },
      splitLine: { lineStyle: { color: 'rgba(200,155,60,0.2)' } },
    },
    series: [{
      type: 'radar',
      data: [{
        value: [data.health.heat, data.health.activity, data.health.commercial, data.health.sentiment],
        name: data.ip.name,
        areaStyle: { color: 'rgba(200,155,60,0.25)' },
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
      axisLine: { lineStyle: { color: 'rgba(200,155,60,0.2)' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: muted, fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(200,155,60,0.08)' } },
    },
    series: [{
      type: 'line',
      data: data.heat_trend.map((d) => d.heat),
      smooth: true,
      symbol: 'none',
      lineStyle: { color: gold, width: 2 },
      areaStyle: { color: 'rgba(200,155,60,0.15)' },
    }],
  }

  const growthOption = {
    grid: { left: 48, right: 16, top: 24, bottom: 28 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: data.user_growth.map((d) => d.date.slice(5)),
      axisLabel: { color: muted, fontSize: 10 },
      axisLine: { lineStyle: { color: 'rgba(200,155,60,0.2)' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: muted, fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(200,155,60,0.08)' } },
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
      splitLine: { lineStyle: { color: 'rgba(200,155,60,0.08)' } },
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
      <h2 className="xj-section-title" style={{ padding: '0 0 6px', margin: 0 }}>IP 运营驾驶舱</h2>
      <p style={{ fontSize: '0.625rem', color: '#6B6258', margin: '0 0 24px' }}>
        {data.ip.name}（{data.ip.name_en}）· {data.ip.type} · 决策闭环总览
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        {kpis.map((k) => (
          <div key={k.label} className="xj-panel" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: '0.625rem', color: '#6B6258', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: ink, fontFamily: '"Noto Serif SC", serif' }}>{k.value}</div>
          </div>
        ))}
      </div>

      <h3 style={{ fontSize: '0.75rem', color: gold, marginBottom: 10, fontFamily: '"Noto Serif SC", serif' }}>IP 健康指数</h3>
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
              <div style={{ fontSize: '0.625rem', color: '#6B6258' }}>{h.label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: gold, fontFamily: '"Noto Serif SC", serif', marginTop: 6 }}>{h.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="xj-panel" style={{ padding: '12px 12px 4px' }}>
          <div style={{ fontSize: '0.6875rem', color: gold, marginBottom: 4, paddingLeft: 8 }}>热度趋势（30日）</div>
          <ReactECharts option={heatOption} style={{ height: 220 }} />
        </div>
        <div className="xj-panel" style={{ padding: '12px 12px 4px' }}>
          <div style={{ fontSize: '0.6875rem', color: gold, marginBottom: 4, paddingLeft: 8 }}>平台来源占比</div>
          <ReactECharts option={pieOption} style={{ height: 220 }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
        <div className="xj-panel" style={{ padding: '12px 12px 4px' }}>
          <div style={{ fontSize: '0.6875rem', color: gold, marginBottom: 4, paddingLeft: 8 }}>用户增长曲线</div>
          <ReactECharts option={growthOption} style={{ height: 220 }} />
        </div>
        <div className="xj-panel" style={{ padding: '12px 12px 4px' }}>
          <div style={{ fontSize: '0.6875rem', color: gold, marginBottom: 4, paddingLeft: 8 }}>角色热度排名</div>
          <ReactECharts option={rankOption} style={{ height: 220 }} />
        </div>
      </div>
    </div>
  )
}
