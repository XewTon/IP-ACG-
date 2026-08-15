/*
 * 玄策 · 地域分布图 —— echarts 中国地图 + 涟漪散点 + 飞线
 * 水墨风格：纸面底色 + 淡墨边界 + 石青→朱砂视觉映射；天行金飞线。
 * 数据注入式：后端提供 GET /api/dashboard/region（{ name, value }[]）后即自动展示；
 * demo 模式内置示例数据（显式标注「示例」，不冒充真实指标）。
 */
import { useEffect, useState } from 'react'
import * as echarts from 'echarts'
import ReactECharts from 'echarts-for-react'
import { ink } from '../lib/theme'

export interface RegionPoint {
  name: string
  value: number
  /** 若提供 target，则从该点向 target 画飞线 */
  target?: string
}

interface RegionMapProps {
  data?: RegionPoint[]
  demo?: boolean
  height?: number
  title?: string
}

const DEMO: RegionPoint[] = [
  { name: '北京', value: 3200, target: '上海' },
  { name: '上海', value: 2800, target: '广州' },
  { name: '广州', value: 2100, target: '成都' },
  { name: '深圳', value: 1900, target: '武汉' },
  { name: '杭州', value: 1500, target: '西安' },
  { name: '成都', value: 1400, target: '北京' },
  { name: '武汉', value: 1100 },
  { name: '西安', value: 900 },
]

const GEO_URL = 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json'

export default function RegionMap({ data, demo = false, height = 320, title = '地域分布' }: RegionMapProps) {
  const [geoReady, setGeoReady] = useState(false)
  const [geoErr, setGeoErr] = useState(false)

  useEffect(() => {
    let alive = true
    if (echarts.getMap('china')) { setGeoReady(true); return }
    fetch(GEO_URL)
      .then((r) => r.json())
      .then((g) => {
        if (!alive) return
        echarts.registerMap('china', g)
        setGeoReady(true)
      })
      .catch(() => { if (alive) setGeoErr(true) })
    return () => { alive = false }
  }, [])

  const points = demo ? DEMO : (data ?? [])
  const max = Math.max(1, ...points.map((p) => p.value))
  const lines = points.filter((p) => p.target).map((p) => ({
    fromName: p.name,
    toName: p.target as string,
    coords: [] as number[][],
  }))

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: '#FFFDF7',
      borderColor: 'rgba(42,46,55,0.12)',
      textStyle: { color: ink.ink, fontFamily: '"Noto Sans SC", sans-serif', fontSize: 12 },
      formatter: (p: any) => `${p.name}<br/>活跃：${p.value?.toLocaleString?.() ?? '-'}`,
    },
    geo: {
      map: 'china',
      roam: true,
      scaleLimit: { min: 1, max: 6 },
      zoom: 1.15,
      itemStyle: {
        areaColor: '#F3EDDE',
        borderColor: 'rgba(42,46,55,0.35)',
        borderWidth: 0.6,
      },
      emphasis: {
        itemStyle: { areaColor: 'rgba(218,30,43,0.12)', borderColor: ink.red, borderWidth: 1 },
        label: { show: false },
      },
      label: { show: false },
    },
    visualMap: {
      min: 0,
      max: max,
      left: 10,
      bottom: 10,
      calculable: true,
      text: ['高', '低'],
      textStyle: { color: ink.muted, fontSize: 10 },
      inRange: { color: ['#DCE4E6', '#9FB8C0', '#5B8C9E', '#DA1E2B'] },
      seriesIndex: 1,
    },
    series: [
      {
        name: '飞线',
        type: 'lines',
        coordinateSystem: 'geo',
        zlevel: 2,
        effect: {
          show: true,
          period: 5,
          trailLength: 0.35,
          symbol: 'arrow',
          symbolSize: 5,
          color: ink.gold,
        },
        lineStyle: { color: ink.gold, width: 1, opacity: 0.45, curveness: 0.25 },
        data: lines,
      },
      {
        name: '活跃',
        type: 'effectScatter',
        coordinateSystem: 'geo',
        zlevel: 2,
        symbolSize: (v: number) => Math.max(6, Math.sqrt(v / max) * 18),
        rippleEffect: { brushType: 'stroke', scale: 3.2 },
        label: { show: true, position: 'right', formatter: '{b}', fontSize: 10, color: ink.inkSoft, fontFamily: '"Noto Sans SC", sans-serif' },
        itemStyle: { color: ink.red, shadowBlur: 8, shadowColor: 'rgba(218,30,43,0.3)' },
        data: points,
      },
    ],
  }

  const empty = !demo && points.length === 0

  return (
    <div className="xj-panel" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <h3 style={{ fontSize: '0.75rem', color: ink.red, margin: 0, fontFamily: '"Noto Serif SC", serif' }}>{title}</h3>
        {demo && <span style={{ fontSize: '0.5625rem', color: ink.gold, letterSpacing: '0.1em' }}>示例数据</span>}
      </div>
      {geoErr ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6875rem', color: ink.faint }}>
          地图数据加载失败（需联网获取 GeoJSON）
        </div>
      ) : !geoReady ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6875rem', color: ink.faint }}>
          加载地图…
        </div>
      ) : empty ? (
        <div style={{ height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: '0.6875rem', color: ink.faint }}>
          <span>暂无地域数据</span>
          <span style={{ fontSize: '0.5625rem' }}>后端提供 GET /api/dashboard/region（{'{ name, value, target? }[]'}）后自动展示</span>
        </div>
      ) : (
        <ReactECharts option={option} style={{ height }} notMerge />
      )}
    </div>
  )
}
