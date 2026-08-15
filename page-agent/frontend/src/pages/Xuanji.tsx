// 玄机科技 · IP运营知识库看板 —— 数据 100% 来自后端 /api/xuanji/*（真实公开数据）
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, RadarChart, Radar, ComposedChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { xuanjiApi } from '../api'
import type {
  XuanjiOverview, XuanjiIps, XuanjiIpo, XuanjiBili,
  XuanjiKnowledge, XuanjiReports, XuanjiSupply,
} from '../api'
import NewsFeed from './NewsFeed'

type TabKey = 'overview' | 'ips' | 'ipo' | 'bili' | 'knowledge' | 'reports' | 'supply' | 'news'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: '总览' },
  { key: 'ips', label: 'IP矩阵' },
  { key: 'ipo', label: 'IPO进展' },
  { key: 'bili', label: 'B站分析' },
  { key: 'supply', label: '供应链' },
  { key: 'knowledge', label: '知识图谱' },
  { key: 'reports', label: '静态速报' },
  { key: 'news', label: '动态速报' },
]

const C = ['#c0392b', '#d97706', '#16a34a', '#2563eb', '#7c3aed', '#0891b2']

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="xj-panel" style={{ padding: 20, marginBottom: 16 }}>
      <h3 style={{ fontSize: '0.75rem', color: 'var(--xj-red)', margin: '0 0 14px', fontFamily: '"Noto Serif SC",serif' }}>{title}</h3>
      {children}
    </div>
  )
}

function StageBadge({ stage }: { stage: string }) {
  const colorMap: Record<string, string> = {
    '巅峰期': '#c0392b', '稳定更新': '#16a34a', '上升期': '#16a34a',
    '经典IP': '#d97706', '跨媒介': '#7c3aed', '待激活': '#78716c', '待定': '#78716c',
  }
  const c = colorMap[stage] || '#78716c'
  return <span style={{ fontSize: '0.625rem', padding: '2px 8px', borderRadius: 10, background: `${c}1f`, color: c, fontWeight: 600 }}>{stage}</span>
}

export default function Xuanji() {
  const [tab, setTab] = useState<TabKey>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [overview, setOverview] = useState<XuanjiOverview | null>(null)
  const [ips, setIps] = useState<XuanjiIps | null>(null)
  const [ipo, setIpo] = useState<XuanjiIpo | null>(null)
  const [bili, setBili] = useState<XuanjiBili | null>(null)
  const [knowledge, setKnowledge] = useState<XuanjiKnowledge | null>(null)
  const [reports, setReports] = useState<XuanjiReports | null>(null)
  const [supply, setSupply] = useState<XuanjiSupply | null>(null)

  useEffect(() => {
    Promise.all([
      xuanjiApi.overview(), xuanjiApi.ips(), xuanjiApi.ipo(), xuanjiApi.bili(),
      xuanjiApi.knowledge(), xuanjiApi.reports(), xuanjiApi.supply(),
    ])
      .then(([o, i, p, b, k, r, s]) => {
        setOverview(o); setIps(i); setIpo(p); setBili(b)
        setKnowledge(k); setReports(r); setSupply(s)
        setLoading(false)
      })
      .catch((e) => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) return <div style={{ padding: '48px 32px', color: 'var(--xj-faint)' }}>加载中...</div>
  if (error) return <div style={{ padding: '48px 32px', color: 'var(--xj-red)' }}>加载失败：{error}</div>

  const kpiCards = overview?.kpis ?? []
  const ipRadar = (ips?.data ?? []).slice(0, 4).map((ip) => ({
    name: ip.name, 播放热度: ip.heat, 社区讨论: ip.discussion,
    二创活跃: ip.fanwork, 付费转化: ip.pay_convert, 口碑评分: ip.reputation,
  }))

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 32px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <h2 className="xj-section-title" style={{ padding: '0 0 6px', margin: 0 }}>玄机科技 · IP运营知识库</h2>
          <p style={{ fontSize: '0.625rem', color: 'var(--xj-muted)', margin: '4px 0 0' }}>
            国漫产业认知 · 公司深度 · IPO · 数据分析 · 商业化 —— 数据来自公开信息（招股书/问询函/百科/新闻），由后端 /api/xuanji/* 供给
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="xj-btn"
            style={{
              padding: '7px 16px', fontSize: '0.6875rem',
              background: tab === t.key ? 'var(--xj-red)' : 'transparent',
              color: tab === t.key ? '#faf7f2' : 'var(--xj-ink)',
              border: '1px solid rgba(218,30,43,0.4)',
            }}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'overview' && overview && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
            {kpiCards.map((k) => (
              <div key={k.label} className="xj-panel" style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: '0.625rem', color: 'var(--xj-muted)', marginBottom: 4 }}>{k.label}</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--xj-ink)', fontFamily: '"Noto Serif SC",serif' }}>
                  {k.value}<span style={{ fontSize: '0.625rem', color: 'var(--xj-muted)', marginLeft: 2 }}>{k.unit}</span>
                </div>
                {k.delta && (
                  <div style={{ fontSize: '0.5625rem', marginTop: 4, color: k.delta_dir === 'up' ? '#6a8a6a' : k.delta_dir === 'down' ? 'var(--xj-gold)' : 'var(--xj-muted)' }}>
                    {k.delta_dir === 'up' ? '↑ ' : k.delta_dir === 'down' ? '↓ ' : ''}{k.delta}
                  </div>
                )}
                <div style={{ fontSize: '0.5625rem', color: 'var(--xj-faint)', marginTop: 2 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Panel title="营收增长趋势（2023-2025）">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={overview.revenue_trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => [`${v} 亿`, '']} />
                  <Legend />
                  <Bar dataKey="revenue" name="营业收入(亿)" fill="#c0392b" radius={[4, 4, 0, 0]} barSize={28} />
                  <Bar dataKey="net_profit" name="归母净利润(亿)" fill="#d97706" radius={[4, 4, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="客户集中度变化（%）">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={overview.client_trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => [`${v}%`, '']} />
                  <Legend />
                  <Line type="monotone" dataKey="tencent" name="腾讯系占比" stroke="#c0392b" strokeWidth={2} />
                  <Line type="monotone" dataKey="top5" name="前五大客户占比" stroke="#d97706" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Panel>
          </div>

          <Panel title="收入构成：代工 vs 自营（2025）">
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <ResponsiveContainer width="40%" height={220}>
                <PieChart>
                  <Pie data={[{ name: '代工业务', value: overview.composition.agency }, { name: '自营IP', value: overview.composition.self_ip }]}
                    dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {C.slice(0, 2).map((c) => <Cell key={c} fill={c} />)}
                  </Pie>
                  <Tooltip formatter={(v: number, n: string) => [`${v}%`, n]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ fontSize: '0.6875rem', color: 'var(--xj-faint)', lineHeight: 1.9 }}>
                代工（数字内容制作服务）占比超 95%，按项目结算，收入可预测但利润率低。<br />
                自营IP（数字内容创作）占比低但增长空间大 —— 这是玄机 IPO 的核心故事：<br />
                从代工制作公司转型为 IP 运营公司，用募资反哺自营 IP。
              </div>
            </div>
          </Panel>
        </>
      )}

      {tab === 'ips' && ips && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, marginBottom: 16 }}>
            {ips.data.map((ip) => (
              <div key={ip.id} className="xj-panel" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, color: 'var(--xj-ink)', fontSize: '0.8125rem' }}>{ip.name}</span>
                  <StageBadge stage={ip.stage} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: '0.625rem', color: 'var(--xj-faint)' }}>
                  <div>状态：{ip.status}</div>
                  <div>进度：{ip.progress}</div>
                  <div>生命周期：{ip.lifecycle}</div>
                  <div>平台：{ip.platform}</div>
                </div>
                <div style={{ fontSize: '0.625rem', color: 'var(--xj-muted)', marginTop: 8, lineHeight: 1.6 }}>{ip.commercial}</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 10 }}>
                  {(ip.tags || '').split('|').map((t) => (
                    <span key={t} style={{ fontSize: '0.5625rem', padding: '2px 8px', borderRadius: 4, background: 'rgba(218,30,43,0.08)', color: 'var(--xj-red)' }}>{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Panel title="各IP五维雷达对比">
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={ipRadar} cx="50%" cy="50%" outerRadius="72%">
                  <PolarGrid stroke="#e7e5e4" />
                  <PolarAngleAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                  {['播放热度', '社区讨论', '二创活跃', '付费转化', '口碑评分'].map((m, i) => (
                    <Radar key={m} name={m} dataKey={m} stroke={C[i]} fill={C[i]} fillOpacity={0.12} />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="IP联动策略矩阵">
              <div style={{ fontSize: '0.625rem', color: 'var(--xj-muted)', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(218,30,43,0.15)', textAlign: 'left' }}>
                      {['IP组合', '联动方式', '可行性', '优先级'].map((h) => <th key={h} style={{ padding: '8px 6px' }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {ips.strategies.map((s, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(218,30,43,0.05)' }}>
                        <td style={{ padding: '8px 6px', color: 'var(--xj-ink)' }}>{s.combo}</td>
                        <td style={{ padding: '8px 6px' }}>{s.mode}</td>
                        <td style={{ padding: '8px 6px', color: s.feasibility === '高' ? '#6a8a6a' : s.feasibility === '中' ? 'var(--xj-gold)' : 'var(--xj-muted)' }}>{s.feasibility}</td>
                        <td style={{ padding: '8px 6px', color: 'var(--xj-red)' }}>{s.priority}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </>
      )}

      {tab === 'ipo' && ipo && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
          <Panel title="IPO 关键节点时间线">
            <div style={{ position: 'relative', paddingLeft: 20 }}>
              {ipo.timeline.map((t, i) => (
                <div key={i} style={{ position: 'relative', marginBottom: 16 }}>
                  <span style={{
                    position: 'absolute', left: -20, top: 4, width: 10, height: 10, borderRadius: '50%',
                    background: t.level === 'danger' ? '#c0392b' : t.level === 'warning' ? '#d97706' : '#c0392b',
                    border: '2px solid #faf7f2', boxShadow: '0 0 0 1px rgba(218,30,43,0.3)',
                  }} />
                  <div style={{ fontSize: '0.5625rem', color: 'var(--xj-muted)' }}>{t.date_label}</div>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--xj-ink)' }}>{t.title}</div>
                  <div style={{ fontSize: '0.625rem', color: 'var(--xj-faint)', marginTop: 2 }}>{t.detail}</div>
                </div>
              ))}
            </div>
          </Panel>

          <div>
            <Panel title="首轮问询五大核心问题">
              <div style={{ fontSize: '0.625rem', color: 'var(--xj-muted)', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 440 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(218,30,43,0.15)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 6px' }}>问题</th><th style={{ padding: '8px 6px' }}>核心关切</th><th style={{ padding: '8px 6px' }}>回复要点</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ipo.inquiry.map((q) => (
                      <tr key={q.no} style={{ borderBottom: '1px solid rgba(218,30,43,0.05)', verticalAlign: 'top' }}>
                        <td style={{ padding: '8px 6px', color: 'var(--xj-ink)', whiteSpace: 'nowrap' }}>{q.no}. {q.topic}</td>
                        <td style={{ padding: '8px 6px' }}>{q.concern}</td>
                        <td style={{ padding: '8px 6px' }}>{q.reply}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
            <Panel title="股权结构">
              <div style={{ fontSize: '0.625rem', color: 'var(--xj-muted)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(218,30,43,0.15)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 6px' }}>股东</th><th style={{ padding: '8px 6px' }}>角色</th><th style={{ padding: '8px 6px' }}>说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ipo.shareholders.map((s, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(218,30,43,0.05)', verticalAlign: 'top' }}>
                        <td style={{ padding: '8px 6px', color: 'var(--xj-ink)', whiteSpace: 'nowrap' }}>{s.name}</td>
                        <td style={{ padding: '8px 6px' }}>{s.role}</td>
                        <td style={{ padding: '8px 6px' }}>{s.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </div>
      )}

      {tab === 'bili' && bili && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Panel title="B站内容漏斗：从曝光到传播（%）">
            {bili.funnel.map((f, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.625rem', color: 'var(--xj-muted)', marginBottom: 4 }}>
                  <span>{f.name}</span><span style={{ color: 'var(--xj-red)' }}>{f.value}</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: 'rgba(218,30,43,0.08)', width: '100%' }}>
                  <div style={{ height: 8, borderRadius: 4, background: C[i % C.length], width: `${Math.min(100, f.value)}%` }} />
                </div>
              </div>
            ))}
            <div style={{ fontSize: '0.5625rem', color: 'var(--xj-faint)', marginTop: 12, lineHeight: 1.8 }}>
              曝光→兴趣约35%，兴趣→转化约34%，转化→留存约50%，留存→传播约33%。
            </div>
          </Panel>
          <Panel title="各IP B站内容数据对比">
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={bili.ips}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="play_w10k" name="官方视频播放(万)" fill="#c0392b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="fanwork_w" name="二创视频数" fill="#d97706" radius={[4, 4, 0, 0]} />
                <Line dataKey="danmaku" name="弹幕量" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </Panel>
        </div>
      )}

      {tab === 'supply' && supply && (
        <>
          <Panel title="衍生品供应链（手册 6.4）">
            <div style={{ fontSize: '0.625rem', color: 'var(--xj-muted)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(218,30,43,0.15)', textAlign: 'left' }}>
                    {['品类', '环节', '成本结构', '定价逻辑', '渠道', '风险'].map((h) => <th key={h} style={{ padding: '8px 6px' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {supply.items.map((s) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid rgba(218,30,43,0.05)', verticalAlign: 'top' }}>
                      <td style={{ padding: '8px 6px', color: 'var(--xj-ink)', whiteSpace: 'nowrap' }}>{s.category}</td>
                      <td style={{ padding: '8px 6px' }}>{s.name}</td>
                      <td style={{ padding: '8px 6px' }}>{s.cost}</td>
                      <td style={{ padding: '8px 6px' }}>{s.pricing}</td>
                      <td style={{ padding: '8px 6px' }}>{s.channel}</td>
                      <td style={{ padding: '8px 6px' }}>{s.risk}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="收入结构 3 年优化目标（手册 6.6）">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={supply.revenue_targets.map((t) => ({ name: t.source, 当前: t.current_pct, 目标: t.target_pct }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => [`${v}%`, '']} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="当前" fill="#9ca3af" radius={[4, 4, 0, 0]} />
                <Bar dataKey="目标" fill="#c0392b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ fontSize: '0.5625rem', color: 'var(--xj-faint)', lineHeight: 1.8, marginTop: 8 }}>
              {supply.revenue_targets.map((t) => `${t.source}：${t.current_pct}% → ${t.target_pct}%（${t.path}）`).join('；')}
            </div>
          </Panel>
        </>
      )}

      {tab === 'knowledge' && knowledge && (
        <>
          {knowledge.modules.map((m) => (
            <Panel key={m.module} title={m.module}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                {m.items.map((it) => (
                  <div key={it.title} style={{ background: 'rgba(218,30,43,0.03)', borderRadius: 8, padding: 12, borderLeft: '3px solid rgba(218,30,43,0.55)' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--xj-ink)', marginBottom: 4 }}>{it.title}</div>
                    <div style={{ fontSize: '0.625rem', color: 'var(--xj-faint)', lineHeight: 1.6 }}>{it.desc}</div>
                  </div>
                ))}
              </div>
            </Panel>
          ))}
        </>
      )}

      {tab === 'reports' && reports && (
        <>
          {reports.data.map((r) => (
            <div key={r.id} className="xj-panel" style={{ padding: 20, marginBottom: 14 }}>
              <span style={{ display: 'inline-block', fontSize: '0.5625rem', padding: '2px 10px', borderRadius: 10, background: 'rgba(218,30,43,0.1)', color: 'var(--xj-red)', marginBottom: 8 }}>{r.date_label}</span>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--xj-ink)', marginBottom: 6 }}>{r.headline}</div>
              <div style={{ fontSize: '0.625rem', color: 'var(--xj-faint)', lineHeight: 1.8 }}>{r.detail}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {r.tags_list.map((t) => (
                  <span key={t} style={{ fontSize: '0.5625rem', padding: '2px 8px', borderRadius: 4, background: 'rgba(218,30,43,0.06)', color: 'var(--xj-muted)' }}>{t}</span>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {tab === 'news' && <NewsFeed />}

      <p style={{ fontSize: '0.5625rem', color: '#4a4540', paddingTop: 16 }}>
        数据源：玄机科技IP运营知识库手册 v1.0（2026-08-11）· 北交所问询函公开信息 · 各平台公开数据。本页数据全部来自后端 GET /api/xuanji/*，与数据库一致。动态速报由每日 09:00 定时抓取 + 智谱LLM分析生成。
      </p>
    </div>
  )
}
