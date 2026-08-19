// 玄策 · 角色运营分析（趋势 / 图谱均可编辑并持久化）
import { useEffect, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import {
  getCharacters, getCharacterTrend, getIpList, getRelations,
  upsertTrend, deleteTrend, createRelation, deleteRelation, createCharacter,
  type CharacterRow, type RelationGraph, type TrendPoint,
} from '../api'

const gold = '#DA1E2B'
const ink = '#2A2E37'
const muted = '#8a8578'

/* 本地日期 YYYY-MM-DD（避免 UTC 时区在凌晨差一天） */
function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Characters() {
  const [ipId, setIpId] = useState<number | null>(null)
  const [list, setList] = useState<CharacterRow[]>([])
  const [sel, setSel] = useState<number | null>(null)
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [graph, setGraph] = useState<RelationGraph | null>(null)

  const [editTrend, setEditTrend] = useState(false)
  const [editGraph, setEditGraph] = useState(false)
  const [tpMsg, setTpMsg] = useState('')
  const [grMsg, setGrMsg] = useState('')
  const [loadErr, setLoadErr] = useState('')
  const [tpForm, setTpForm] = useState({ date: localToday(), search_index: 0, discussions: 0, fan_growth: 0, fanworks: 0, commercial_score: 0 })
  const [edgeForm, setEdgeForm] = useState({ from: 0, to: 0, relation: '', note: '' })
  const [nodeForm, setNodeForm] = useState({ name: '', role: '', tag: '' })

  const reloadTrend = () => { if (sel) getCharacterTrend(sel, 30).then((d) => setTrend(d.trend)).catch((e: any) => setLoadErr('趋势加载失败：' + String(e?.message || e))) }
  const reloadGraph = () => { if (ipId != null) getRelations(ipId).then(setGraph).catch((e: any) => setLoadErr('图谱加载失败：' + String(e?.message || e))) }

  useEffect(() => {
    getIpList().then((d) => { if (d.data[0]) setIpId(d.data[0].id) }).catch((e: any) => setLoadErr('IP列表加载失败：' + String(e?.message || e)))
  }, [])

  useEffect(() => {
    if (ipId == null) return
    getCharacters(ipId).then((d) => {
      setList(d.data)
      if (d.data[0]) setSel(d.data[0].id)
    }).catch((e: any) => setLoadErr('角色加载失败：' + String(e?.message || e)))
    reloadGraph()
  }, [ipId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    reloadTrend()
  }, [sel]) // eslint-disable-line react-hooks/exhaustive-deps

  const selected = list.find((c) => c.id === sel)
  const selIpName = selected?.name || ''

  /* ---- 趋势编辑 ---- */
  const savePoint = async (p: Partial<TrendPoint>) => {
    if (!sel) return
    setTpMsg('保存中...')
    try {
      await upsertTrend(sel, p)
      setTpMsg('已保存（来源：character_daily_metrics，可手动校准）')
      reloadTrend()
    } catch (e: any) { setTpMsg('保存失败: ' + String(e.message || e)) }
  }
  const saveNewPoint = async () => {
    await savePoint(tpForm)
    setTpForm({ date: localToday(), search_index: 0, discussions: 0, fan_growth: 0, fanworks: 0, commercial_score: 0 })
  }
  const delPoint = async (date: string) => {
    if (!sel) return
    if (!confirm(`删除 ${date} 的趋势点？`)) return
    await deleteTrend(sel, date)
    reloadTrend()
  }

  /* ---- 图谱编辑 ---- */
  const saveEdge = async () => {
    if (!ipId || !edgeForm.from || !edgeForm.to || edgeForm.from === edgeForm.to) {
      setGrMsg('请选择不同的源角色与目标角色'); return
    }
    if (!edgeForm.relation.trim()) { setGrMsg('请填写关系类型'); return }
    try {
      await createRelation(ipId, {
        from_character_id: edgeForm.from, to_character_id: edgeForm.to,
        relation_type: edgeForm.relation.trim(), note: edgeForm.note.trim(),
      })
      setGrMsg('关系已添加')
      setEdgeForm({ from: 0, to: 0, relation: '', note: '' })
      reloadGraph()
    } catch (e: any) { setGrMsg('添加失败: ' + String(e.message || e)) }
  }
  const delEdge = async (id: number) => {
    if (!confirm('删除该关系？')) return
    await deleteRelation(id)
    reloadGraph()
  }
  const addNode = async () => {
    if (!ipId || !nodeForm.name.trim()) { setGrMsg('请填写节点名称'); return }
    try {
      await createCharacter(ipId, { name: nodeForm.name.trim(), role: nodeForm.role, tag: nodeForm.tag, keywords: '', description: '', assets: '', commercial_value: '' })
      setGrMsg(`节点「${nodeForm.name}」已添加`)
      setNodeForm({ name: '', role: '', tag: '' })
      reloadGraph()
      getCharacters(ipId).then((d) => setList(d.data))
    } catch (e: any) { setGrMsg('添加失败: ' + String(e.message || e)) }
  }

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
      { name: '讨论量', type: 'line', smooth: true, symbol: 'circle', symbolSize: 5, data: trend.map((t) => t.discussions), lineStyle: { color: gold }, areaStyle: { color: 'rgba(218,30,43,0.12)' } },
      { name: '搜索指数', type: 'line', smooth: true, symbol: 'circle', symbolSize: 5, yAxisIndex: 1, data: trend.map((t) => t.search_index), lineStyle: { color: '#6a8a9a' } },
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
          itemStyle: { color: n.category === 0 ? gold : n.category === 1 ? '#A13A2A' : '#6a8a9a' },
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

  const inputStyle: React.CSSProperties = {
    background: '#FFFFFF', border: '1px solid rgba(218,30,43,0.15)', color: ink,
    padding: '5px 8px', fontSize: '0.6875rem', fontFamily: 'inherit',
  }

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '40px 32px 64px' }}>
      <h2 className="xj-section-title" style={{ padding: '0 0 6px', margin: 0 }}>角色运营分析</h2>
      <p style={{ fontSize: '0.625rem', color: '#6B6258', margin: '0 0 24px' }}>
        {`排行榜 · 30日趋势 · 关系图谱 · 数据来源 character_daily_metrics / character_relations（可编辑校准）`}
      </p>

      <div className="xj-panel" style={{ marginBottom: 20 }}>
        {loadErr && <div style={{ padding: '12px 18px', color: '#c9a96e', fontSize: '0.75rem' }}>{loadErr}（请确认后端已启动）</div>}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <h3 style={{ fontSize: '0.75rem', color: gold, margin: 0, fontFamily: '"Noto Serif SC", serif' }}>
              {`${selected.name} · 近30日趋势`}
            </h3>
            <button
              onClick={() => { setEditTrend(!editTrend); setTpMsg('') }}
              style={{ marginLeft: 'auto', background: 'transparent', border: `1px solid ${editTrend ? gold : 'rgba(218,30,43,0.3)'}`, color: editTrend ? gold : muted, fontSize: '0.625rem', cursor: 'pointer', padding: '4px 12px' }}
            >
              {editTrend ? '完成编辑' : '✎ 编辑趋势'}
            </button>
          </div>
          <div className="xj-panel" style={{ padding: '8px 8px 0' }}>
            <ReactECharts option={trendOption} style={{ height: 240 }} />
          </div>
          {editTrend && (
            <div className="xj-panel" style={{ marginTop: 10, padding: 14 }}>
              <div style={{ fontSize: '0.625rem', color: muted, marginBottom: 10 }}>
              {`点选行内数字修改后保存 · 新增/删除日期点 · 修改写入 character_daily_metrics（近30天）`}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                {(['date', 'search_index', 'discussions', 'fan_growth', 'fanworks', 'commercial_score'] as const).map((k) => (
                  <input
                    key={k}
                    type={k === 'date' ? 'date' : 'number'}
                    value={String(tpForm[k])}
                    onChange={(e) => setTpForm({ ...tpForm, [k]: k === 'date' ? e.target.value : +e.target.value })}
                    style={{ ...inputStyle, width: k === 'date' ? 130 : 74 }}
                    title={k}
                  />
                ))}
                <button className="xj-btn" style={{ padding: '5px 12px', fontSize: '0.625rem' }} onClick={saveNewPoint}>＋ 新增/保存此天</button>
              </div>
              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                {trend.map((t) => (
                  <div key={t.date} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(218,30,43,0.05)' }}>
                    <span style={{ width: 90, fontSize: '0.625rem', color: muted, flexShrink: 0 }}>{t.date}</span>
                    {(['search_index', 'discussions', 'fan_growth', 'fanworks', 'commercial_score'] as const).map((k) => (
                      <input
                        key={k}
                        type="number"
                        min={0}
                        step={k === 'commercial_score' ? 0.1 : 1}
                        value={t[k]}
                        onChange={(e) => {
                          const v = e.target.value === '' ? 0 : +e.target.value
                          if (!Number.isFinite(v)) return
                          setTrend((prev) => prev.map((x) => (x.date === t.date ? { ...x, [k]: v } : x)))
                        }}
                        style={{ ...inputStyle, width: 70 }}
                        title={k}
                      />
                    ))}
                    <button className="xj-btn" style={{ padding: '3px 10px', fontSize: '0.5625rem', marginLeft: 'auto' }} onClick={() => savePoint({ ...t })}>保存</button>
                    <button style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', fontSize: '0.6875rem' }} onClick={() => delPoint(t.date)}>×</button>
                  </div>
                ))}
              </div>
              {tpMsg && <div style={{ fontSize: '0.625rem', color: '#6a8a6a', marginTop: 8 }}>{tpMsg}</div>}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <h3 style={{ fontSize: '0.75rem', color: gold, margin: 0, fontFamily: '"Noto Serif SC", serif' }}>角色关系图谱</h3>
        <button
          onClick={() => { setEditGraph(!editGraph); setGrMsg('') }}
          style={{ marginLeft: 'auto', background: 'transparent', border: `1px solid ${editGraph ? gold : 'rgba(218,30,43,0.3)'}`, color: editGraph ? gold : muted, fontSize: '0.625rem', cursor: 'pointer', padding: '4px 12px' }}
        >
          {editGraph ? '完成编辑' : '✎ 编辑图谱'}
        </button>
      </div>
      <div className="xj-panel" style={{ padding: 8 }}>
        {graph ? <ReactECharts option={graphOption} style={{ height: 360 }} /> : <div style={{ padding: 32, color: muted }}>加载图谱...</div>}
      </div>

      {editGraph && (
        <div className="xj-panel" style={{ marginTop: 10, padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            {/* 添加节点 */}
            <div style={{ border: '1px solid rgba(218,30,43,0.12)', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: '0.6875rem', color: gold, marginBottom: 8 }}>添加角色节点</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input placeholder="名称" value={nodeForm.name} onChange={(e) => setNodeForm({ ...nodeForm, name: e.target.value })} style={inputStyle} />
                <input placeholder="身份（如：剑圣）" value={nodeForm.role} onChange={(e) => setNodeForm({ ...nodeForm, role: e.target.value })} style={inputStyle} />
                <input placeholder="标签" value={nodeForm.tag} onChange={(e) => setNodeForm({ ...nodeForm, tag: e.target.value })} style={inputStyle} />
              </div>
              <button className="xj-btn" style={{ marginTop: 8, padding: '5px 14px', fontSize: '0.625rem', width: '100%' }} onClick={addNode}>添加节点</button>
            </div>
            {/* 添加边 */}
            <div style={{ border: '1px solid rgba(218,30,43,0.12)', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: '0.6875rem', color: gold, marginBottom: 8 }}>连接关系边</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <select value={edgeForm.from} onChange={(e) => setEdgeForm({ ...edgeForm, from: +e.target.value })} style={inputStyle}>
                  <option value={0}>源角色</option>
                  {list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={edgeForm.to} onChange={(e) => setEdgeForm({ ...edgeForm, to: +e.target.value })} style={inputStyle}>
                  <option value={0}>目标角色</option>
                  {list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input placeholder="关系类型（如：师徒/对立）" value={edgeForm.relation} onChange={(e) => setEdgeForm({ ...edgeForm, relation: e.target.value })} style={inputStyle} />
                <input placeholder="备注" value={edgeForm.note} onChange={(e) => setEdgeForm({ ...edgeForm, note: e.target.value })} style={inputStyle} />
              </div>
              <button className="xj-btn" style={{ marginTop: 8, padding: '5px 14px', fontSize: '0.625rem', width: '100%' }} onClick={saveEdge}>添加关系</button>
            </div>
            {/* 边列表 */}
            <div style={{ border: '1px solid rgba(218,30,43,0.12)', borderRadius: 8, padding: 12, maxHeight: 230, overflowY: 'auto' }}>
              <div style={{ fontSize: '0.6875rem', color: gold, marginBottom: 8 }}>已有关系（{graph?.edges.length ?? 0}）</div>
              {(graph?.edges ?? []).map((e) => (
                <div key={e.id ?? e.source + e.target + e.relation} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid rgba(218,30,43,0.05)', fontSize: '0.625rem' }}>
                  <span style={{ color: ink, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {`${e.source} → ${e.target} · ${e.relation}`}
                  </span>
                  <button onClick={() => e.id != null && delEdge(e.id)} style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', fontSize: '0.625rem' }}>×</button>
                </div>
              ))}
              {(graph?.edges.length ?? 0) === 0 && <div style={{ fontSize: '0.625rem', color: muted }}>暂无关系</div>}
            </div>
          </div>
          {grMsg && <div style={{ fontSize: '0.625rem', color: '#6a8a6a' }}>{grMsg}</div>}
          <div style={{ fontSize: '0.5625rem', color: '#4a4540', marginTop: 8 }}>
            {`编辑写入 character_relations / characters 表 · ${selIpName ? '当前默认角色：' + selIpName : ''}`}
          </div>
        </div>
      )}
    </div>
  )
}
