// 玄策 · 动态速报 —— 定时抓取 + LLM分析结果展示
import { useEffect, useState } from 'react'
import { newsApi, type NewsConfig, type NewsKeyword, type NewsFeedItem } from '../api'

const CAT_LABEL: Record<string, string> = { company: '公司', ipo: 'IPO', ip: 'IP', industry: '行业', strategy: '战略' }
const SCORE_STAR = (n: number) => { const c = Math.max(0, Math.min(5, Math.round(n || 0))); return '★'.repeat(c) + '☆'.repeat(5 - c) }

export default function NewsFeed() {
  const [config, setConfig] = useState<NewsConfig | null>(null)
  const [feed, setFeed] = useState<NewsFeedItem[]>([])
  const [newKw, setNewKw] = useState('')
  const [fetching, setFetching] = useState(false)
  const [msg, setMsg] = useState('')
  const [zhipuKey, setZhipuKey] = useState('')
  const [zhipuModel, setZhipuModel] = useState('glm-4.5')
  const [showZhipu, setShowZhipu] = useState(false)
  const [minScore, setMinScore] = useState(0)
  const [catFilter, setCatFilter] = useState('')
  const [pipeRunning, setPipeRunning] = useState(false)
  const [loadErr, setLoadErr] = useState('')

  const load = async () => {
    try {
      const [c, f] = await Promise.all([newsApi.getConfig(), newsApi.listFeed({ min_score: minScore || undefined })])
      setConfig(c)
      setFeed(f.data)
      setLoadErr('')
    } catch (e: any) {
      setLoadErr(`数据加载失败：${e?.message || e}`)
    }
  }
  useEffect(() => { load() }, [minScore])

  const addKw = async () => { if (!newKw.trim()) return; await newsApi.addKeyword(newKw.trim()); setNewKw(''); load() }
  const delKw = async (id: number) => { await newsApi.deleteKeyword(id); load() }
  const delFeed = async (id: number) => { if (confirm('删除?')) { await newsApi.deleteFeed(id); load() } }

  const fetchNow = async () => {
    setFetching(true); setMsg('抓取分析中...')
    try { const r = await newsApi.fetchNow(); setMsg(`${r.message}（共 ${r.count} 条）`) } catch (e: any) { setMsg(`抓取失败: ${e.message || e}`) }
    setFetching(false); load()
  }

  // 一键跑 pipeline（搜索→LLM分析→docx）→ 下载
  const runPipeline = async () => {
    setPipeRunning(true); setMsg('pipeline 运行中（搜索→LLM分析→生成docx，约1-2分钟）...')
    try {
      const r = await fetch('/api/pipeline/run', { method: 'POST' })
      if (!r.ok) { const e = await r.json(); throw new Error(JSON.stringify(e.detail || e)) }
      const d = await r.json()
      // 用本地日期拼下载 URL（后端 pipeline 用 date.today() 本地日期命名；UTC 在凌晨会差一天导致 404）
      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      setMsg(`✅ 速报生成成功！正在下载...`)
      // 触发下载
      window.open(`/api/pipeline/download/${today}`, '_blank')
    } catch (e: any) { setMsg(`pipeline 失败: ${e.message || e}`) }
    setPipeRunning(false); load()
  }

  const saveZhipu = async () => { await newsApi.saveZhipu(zhipuKey, zhipuModel); setShowZhipu(false); setMsg('智谱配置已保存'); load() }

  const visible = feed.filter(f => !catFilter || f.category === catFilter)

  const inputStyle: React.CSSProperties = { background: '#fff', border: '1px solid rgba(218,30,43,0.15)', color: '#2A2E37', padding: '7px 10px', fontSize: '0.75rem', fontFamily: '"Noto Sans SC",sans-serif' }

  return (
    <div>
      {/* 顶部操作 */}
      <div className="xj-panel" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--xj-red)', fontFamily: '"Noto Serif SC",serif' }}>追踪关键词</span>
          {config?.keywords.map(k => (
            <span key={k.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.625rem', padding: '3px 8px', border: '1px solid rgba(218,30,43,0.2)', color: 'var(--xj-ink)' }}>
              {k.keyword}
              <button onClick={() => delKw(k.id)} style={{ background: 'none', border: 'none', color: 'var(--xj-faint)', cursor: 'pointer', fontSize: '0.625rem' }}>×</button>
            </span>
          ))}
          <input placeholder="加关键词" value={newKw} onChange={e => setNewKw(e.target.value)} onKeyDown={e => e.key === 'Enter' && addKw()}
            style={{ ...inputStyle, width: 140 }} />
          <button className="xj-btn" style={{ padding: '6px 12px', fontSize: '0.625rem' }} onClick={addKw}>+</button>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
          <button className="xj-btn" style={{ padding: '7px 16px', fontSize: '0.6875rem' }} onClick={fetchNow} disabled={fetching}>
            {fetching ? '抓取中...' : '立即抓取'}
          </button>
          <button className="xj-btn" style={{ padding: '7px 16px', fontSize: '0.6875rem', background: 'var(--xj-red)', color: '#faf7f2', borderColor: 'var(--xj-red)' }} onClick={runPipeline} disabled={pipeRunning}>
            {pipeRunning ? '生成中...' : '⚡ 生成速报docx'}
          </button>
          <span style={{ fontSize: '0.625rem', color: 'var(--xj-muted)' }}>
            智谱：{config?.zhipu.configured ? `已配置(${config.zhipu.model})` : '未配置'}
          </span>
          <button style={{ background: 'none', border: 'none', color: 'var(--xj-red)', cursor: 'pointer', fontSize: '0.625rem' }} onClick={() => setShowZhipu(!showZhipu)}>
            {showZhipu ? '收起' : '配置智谱'}
          </button>
          {msg && <span style={{ fontSize: '0.625rem', color: 'var(--xj-ink)' }}>{msg}</span>}
        </div>
        {showZhipu && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
            <input placeholder="智谱API Key" type="password" value={zhipuKey} onChange={e => setZhipuKey(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <select value={zhipuModel} onChange={e => setZhipuModel(e.target.value)} style={inputStyle}>
              <option value="glm-4.5">glm-4.5</option>
              <option value="glm-4-plus">glm-4-plus</option>
              <option value="glm-4-flash">glm-4-flash</option>
            </select>
            <button className="xj-btn" style={{ padding: '6px 14px', fontSize: '0.625rem' }} onClick={saveZhipu}>保存</button>
            {config?.zhipu.configured && (
              <button style={{ background: 'none', border: 'none', color: 'var(--xj-faint)', cursor: 'pointer', fontSize: '0.625rem' }} onClick={async () => { await newsApi.clearZhipu(); load() }}>清除</button>
            )}
          </div>
        )}
      </div>

      {/* 筛选 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <span style={{ fontSize: '0.625rem', color: 'var(--xj-muted)' }}>类别</span>
        {['', 'company', 'ipo', 'ip', 'strategy', 'industry'].map(c => (
          <button key={c} onClick={() => setCatFilter(c)} style={{ background: catFilter === c ? 'rgba(218,30,43,0.1)' : 'transparent', color: catFilter === c ? 'var(--xj-red)' : 'var(--xj-ink)', border: '1px solid rgba(218,30,43,0.2)', fontSize: '0.625rem', cursor: 'pointer', padding: '3px 10px' }}>
            {c ? CAT_LABEL[c] : '全部'}
          </button>
        ))}
        <span style={{ fontSize: '0.625rem', color: 'var(--xj-muted)', marginLeft: 8 }}>星级</span>
        <select value={minScore} onChange={e => setMinScore(+e.target.value)} style={inputStyle}>
          <option value={0}>全部</option><option value={3}>≥3星</option><option value={4}>≥4星</option><option value={5}>5星</option>
        </select>
      </div>

      {/* 结果列表 */}
      {loadErr && <div style={{ padding: 20, textAlign: 'center', fontSize: '0.75rem', color: 'var(--xj-red)' }}>{loadErr}（请确认后端已启动）</div>}
      {!loadErr && visible.length === 0 && <div style={{ padding: 32, textAlign: 'center', fontSize: '0.75rem', color: 'var(--xj-faint)' }}>暂无抓取结果，点击"立即抓取"</div>}
      {visible.map(f => (
        <div key={f.id} className="xj-panel" style={{ padding: '14px 18px', marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.5625rem', padding: '2px 8px', borderRadius: 4, background: 'rgba(218,30,43,0.08)', color: 'var(--xj-red)' }}>{f.keyword}</span>
            <span style={{ fontSize: '0.5625rem', padding: '2px 8px', borderRadius: 4, background: 'rgba(91,140,158,0.08)', color: 'var(--xj-blue)' }}>{CAT_LABEL[f.category] || f.category}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--xj-red)', letterSpacing: 2 }}>{SCORE_STAR(f.score)}</span>
            <span style={{ fontSize: '0.5625rem', color: 'var(--xj-faint)', marginLeft: 'auto' }}>{f.fetch_date}</span>
            <button onClick={() => delFeed(f.id)} style={{ background: 'none', border: 'none', color: 'var(--xj-faint)', cursor: 'pointer', fontSize: '0.625rem' }}>×</button>
          </div>
          <a href={f.url || undefined} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--xj-ink)', textDecoration: 'none', display: 'block', marginBottom: 4 }}>{f.title}</a>
          {f.summary && <div style={{ fontSize: '0.625rem', color: 'var(--xj-muted)', lineHeight: 1.7, marginBottom: 6 }}>{f.summary}</div>}
          {f.interview_value && (
            <div style={{ fontSize: '0.625rem', color: 'var(--xj-blue)', borderTop: '1px solid var(--xj-line-soft)', paddingTop: 6 }}>
              💡 面试价值：{f.interview_value}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
