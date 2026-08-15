// 玄策 · 角色运营分析
import { useEffect, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import {
  getCharacters,
  getCharacterTrend,
  getIpList,
  getRelations,
  type CharacterRow,
  type RelationGraph,
} from '../api'

const gold = '#DA1E2B'
const ink = '#2A2E37'
const muted = '#8a8578'

export default function Characters() {
  const [ipId, setIpId] = useState<number | null>(null)
  const [list, setList] = useState<CharacterRow[]>([])
  const [sel, setSel] = useState<number | null>(null)
  const [trend, setTrend] = useState<{ date: string; discussions: number; search_index: number; fan_growth: number; fanworks: number }[]>([])
  const [graph, setGraph] = useState<RelationGraph | null>(null)

  useEffect(() => {
    getIpList().then((d) => {
      if (d.data[0]) setIpId(d.data[0].id)
    })
  }, [])

  useEffect(() => {
    if (ipId == null) return
    getCharacters(ipId).then((d) => {
      setList(d.data)
      if (d.data[0]) setSel(d.data[0].id)
    })
    getRelations(ipId).then(setGraph)
  }, [ipId])

  useEffect(() => {
    if (!sel) return
    getCharacterTrend(sel, 30).then((d) => setTrend(d.trend))
  }, [sel])

  const selected = list.find((c) => c.id === sel)

  const trendOption = useMemo(() => ({
    grid: { left: 40, right: 16, top: 32, bottom: 28 },
    tooltip: { trigger: 'axis' },
    legend: { data: ['讨论量', '搜索指数'], textStyle: { color: muted, fontSize: 11 }, top: 0 },
    xAxis: {
      type: 'category',
      data: trend.map((t) => t.date.slice(5)),
      axisLabel: { color: muted, fontSize: 10 },
      axisLine: { lineStyle: { color: 'rgba(218,30,43,0.2)' } },
    },
    yAxis: [
      { type: 'value', axisLabel: { color: muted, fontSize: 10 }, splitLine: { lineStyle: { color: 'rgba(218,30,43,0.08)' } } },
      { type: 'value', axisLabel: { color: muted, fontSize: 10 }, splitLine: { show: false } },
    ],
    series: [
      { name: '讨论量', type: 'line', smooth: true, symbol: 'none', data: trend.map((t) => t.discussions), lineStyle: { color: gold }, areaStyle: { color: 'rgba(218,30,43,0.12)' } },
      { name: '搜索指数', type: 'line', smooth: true, symbol: 'none', yAxisIndex: 1, data: trend.map((t) => t.search_index), lineStyle: { color: '#6a8a9a' } },
    ],
  }), [trend])

  const graphOption = useMemo(() => {
    if (!graph) return {}
    return {
      tooltip: {},
      legend: [{ data: graph.categories.map((c) => c.name), textStyle: { color: muted }, bottom: 0 }],
      series: [{
        type: 'graph',
        layout: 'force',
        roam: true,
        categories: graph.categories,
        data: graph.nodes.map((n) => ({
          ...n,
          symbolSize: n.category === 0 ? 48 : 36,
          label: { show: true, color: ink, fontSize: 11 },
          itemStyle: {
            color: n.category === 0 ? gold : n.category === 1 ? '#A13A2A' : '#6a8a9a',
          },
        })),
        links: graph.edges.map((e) => ({
          source: e.source,
          target: e.target,
          label: { show: true, formatter: e.relation, fontSize: 10, color: muted },
          lineStyle: { color: 'rgba(218,30,43,0.45)', curveness: 0.15 },
        })),
        force: { repulsion: 280, edgeLength: 120 },
        label: { position: 'bottom' },
      }],
    }
  }, [graph])

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 32px 64px' }}>
      <h2 className="xj-section-title" style={{ padding: '0 0 6px', margin: 0 }}>角色运营分析</h2>
      <p style={{ fontSize: '0.625rem', color: '#6B6258', margin: '0 0 24px' }}>排行榜 · 30日趋势 · 关系图谱</p>

      <div className="xj-panel" style={{ marginBottom: 20 }}>
        {ipId == null ? (
          <div style={{ padding: 32, color: muted }}>加载角色数据...</div>
        ) : (
        <>
        <div style={{ display: 'grid', gridTemplateColumns: '0.6fr 1fr 1fr 1fr 1fr 1fr 0.8fr', padding: '8px 18px', borderBottom: '1px solid rgba(218,30,43,0.12)', fontSize: '0.625rem', color: '#6B6258' }}>
          <span>角色</span><span>搜索指数</span><span>讨论量</span><span>粉丝增长</span><span>二创</span><span>商业价值</span><span>讨论变化</span>
        </div>
        {list.map((c, i) => (
          <button
            key={c.id}
            onClick={() => setSel(c.id)}
            style={{
              display: 'grid',
              gridTemplateColumns: '0.6fr 1fr 1fr 1fr 1fr 1fr 0.8fr',
              width: '100%',
              padding: '12px 18px',
              fontSize: '0.75rem',
              textAlign: 'left',
              cursor: 'pointer',
              border: 'none',
              borderBottom: i < list.length - 1 ? '1px solid rgba(218,30,43,0.04)' : 'none',
              background: sel === c.id ? 'rgba(218,30,43,0.08)' : 'transparent',
              color: ink,
              fontFamily: 'inherit',
            }}
          >
            <span style={{ color: gold, fontWeight: 600 }}>{c.name}</span>
            <span>{c.search_index ?? '-'}</span>
            <span>{c.discussions ?? '-'}</span>
            <span>{c.fan_growth ?? '-'}</span>
            <span>{c.fanworks ?? '-'}</span>
            <span>{c.commercial_value ?? c.commercial_avg ?? '-'}</span>
            <span style={{ color: (c.discussion_change_pct || 0) >= 0 ? '#6a8a6a' : '#c9a96e' }}>
              {(c.discussion_change_pct || 0) >= 0 ? '+' : ''}{c.discussion_change_pct ?? 0}%
            </span>
          </button>
        ))}
        </>
        )}
      </div>

      {selected && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: '0.75rem', color: gold, marginBottom: 10, fontFamily: '"Noto Serif SC", serif' }}>
            {selected.name} · 近30日趋势
          </h3>
          <div className="xj-panel" style={{ padding: '8px 8px 0' }}>
            <ReactECharts option={trendOption} style={{ height: 260 }} />
          </div>
        </div>
      )}

      <h3 style={{ fontSize: '0.75rem', color: gold, marginBottom: 10, fontFamily: '"Noto Serif SC", serif' }}>角色关系图谱</h3>
      <div className="xj-panel" style={{ padding: 8 }}>
        {graph ? <ReactECharts option={graphOption} style={{ height: 380 }} /> : <div style={{ padding: 32, color: muted }}>加载图谱...</div>}
      </div>
    </div>
  )
}
