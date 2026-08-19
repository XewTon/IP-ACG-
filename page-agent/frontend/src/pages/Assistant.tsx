// 玄策 · AI运营助手（决策台，非纯聊天）
import { useEffect, useState } from 'react'
import { analyzeOps, getOpsScenarios, type OpsAnalyzeResult, type OpsScenario } from '../api'

const gold = '#DA1E2B'
const ink = '#2A2E37'
const muted = '#8a8578'

export default function Assistant() {
  const [scenarios, setScenarios] = useState<OpsScenario[]>([])
  const [query, setQuery] = useState('分析最近30天盖聂表现')
  const [scenario, setScenario] = useState<string | undefined>('character')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<OpsAnalyzeResult | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getOpsScenarios().then((d) => setScenarios(d.data)).catch(() => {})
  }, [])

  const run = async (q?: string, sc?: string) => {
    const text = (q ?? query).trim()
    if (!text) return
    setLoading(true)
    setError('')
    try {
      const res = await analyzeOps(text, sc ?? scenario)
      setResult(res)
    } catch (e: any) {
      setError(String(e.message || e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 32px 64px' }}>
      <h2 className="xj-section-title" style={{ padding: '0 0 6px', margin: 0 }}>AI 运营助手</h2>
      <p style={{ fontSize: '0.625rem', color: '#6B6258', margin: '0 0 8px' }}>
        运营决策工具 · 取数 → 分析 → 策略（LangChain Agent + IP 知识库 RAG）
      </p>
      <p style={{ fontSize: '0.625rem', color: muted, margin: '0 0 24px' }}>
        真实 LLM 分析（DashScope / 智谱，配置见设置或动态速报页）；未配置 API Key 时使用种子数据降级报告并标注。页面操控请用右下角 AI 助手浮窗。
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {scenarios.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              setScenario(s.id)
              setQuery(s.prompt)
              run(s.prompt, s.id)
            }}
            style={{
              background: scenario === s.id ? 'rgba(218,30,43,0.14)' : 'transparent',
              color: scenario === s.id ? gold : muted,
              border: '1px solid rgba(218,30,43,0.2)',
              padding: '6px 14px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="xj-panel" style={{ padding: 16, marginBottom: 20 }}>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={3}
          placeholder="输入运营问题，例如：分析最近30天盖聂表现"
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.75)',
            border: '1px solid rgba(218,30,43,0.18)',
            color: ink,
            padding: 12,
            fontSize: '0.875rem',
            resize: 'vertical',
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button
            onClick={() => run()}
            disabled={loading}
            style={{
              background: 'rgba(161,58,42,0.85)',
              color: '#f5efe4',
              border: 'none',
              padding: '8px 22px',
              fontSize: '0.8125rem',
              cursor: loading ? 'wait' : 'pointer',
              fontFamily: '"Noto Serif SC", serif',
            }}
          >
            {loading ? '分析中...' : '生成运营决策'}
          </button>
        </div>
      </div>

      {error && <div style={{ color: '#c9a96e', marginBottom: 16, fontSize: '0.8125rem' }}>{error}</div>}

      {result && (
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: ink, fontFamily: '"Noto Serif SC", serif' }}>{result.title}</h3>
            <span style={{ fontSize: '0.625rem', color: muted, border: '1px solid rgba(218,30,43,0.2)', padding: '2px 8px' }}>
              {result.mode.startsWith('llm:') ? `LLM Agent（${result.mode.split(':')[1]}）` : result.mode === 'llm' ? 'LLM Agent' : '规则降级（未配置 AI）'}
            </span>
          </div>
          <p style={{ color: muted, fontSize: '0.8125rem', lineHeight: 1.7, marginBottom: 18 }}>{result.summary}</p>

          {result.metrics?.length > 0 && (
            <>
              <div style={{ fontSize: '0.6875rem', color: gold, marginBottom: 8 }}>数据依据</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 20 }}>
                {result.metrics.map((m, i) => (
                  <div key={i} className="xj-panel" style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: '0.625rem', color: '#6B6258' }}>{m.label}</div>
                    <div style={{ fontSize: '1.1rem', color: gold, fontWeight: 700, marginTop: 4, fontFamily: '"Noto Serif SC", serif' }}>{String(m.value)}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {result.reasons?.length > 0 && (
            <div className="xj-panel" style={{ padding: 16, marginBottom: 14 }}>
              <div style={{ fontSize: '0.6875rem', color: gold, marginBottom: 8 }}>主要原因</div>
              {result.reasons.map((r, i) => (
                <div key={i} style={{ fontSize: '0.8125rem', color: muted, padding: '6px 0', borderBottom: i < result.reasons.length - 1 ? '1px solid rgba(218,30,43,0.06)' : 'none' }}>
                  {r}
                </div>
              ))}
            </div>
          )}

          {result.suggestions?.length > 0 && (
            <div className="xj-panel" style={{ padding: 16, marginBottom: 14 }}>
              <div style={{ fontSize: '0.6875rem', color: gold, marginBottom: 8 }}>可执行运营建议</div>
              {result.suggestions.map((s, i) => (
                <div key={i} style={{ fontSize: '0.8125rem', color: ink, padding: '8px 0', borderBottom: i < result.suggestions.length - 1 ? '1px solid rgba(218,30,43,0.06)' : 'none' }}>
                  <span style={{ color: gold, marginRight: 8 }}>{String(i + 1).padStart(2, '0')}</span>
                  {s}
                </div>
              ))}
            </div>
          )}

          {result.knowledge_hits?.length > 0 && (
            <div className="xj-panel" style={{ padding: 16 }}>
              <div style={{ fontSize: '0.6875rem', color: gold, marginBottom: 8 }}>知识库命中</div>
              {result.knowledge_hits.map((h, i) => (
                <pre key={i} style={{ whiteSpace: 'pre-wrap', fontSize: '0.6875rem', color: muted, margin: '0 0 10px', fontFamily: 'inherit', lineHeight: 1.6 }}>
                  {h.slice(0, 320)}
                </pre>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
