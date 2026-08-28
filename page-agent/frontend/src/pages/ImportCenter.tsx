// 玄策 · 数据导入中心 —— 上传原始内容 → GLM-4-Flash 分批整理 → 预览确认 → 分批入库 → 回滚
import { useEffect, useRef, useState } from 'react'
import { importApi, type ImportTask } from '../api'

const ink = '#2A2E37'
const muted = '#8a8578'
const gold = '#DA1E2B'

const STATUS_LABEL: Record<string, string> = {
  pending: '待整理', analyzing: '整理中', ready: '待确认', committing: '入库中',
  done: '已完成', failed: '失败', rolled_back: '已回滚',
}
const TARGET_LABEL: Record<string, string> = {
  community_feedback: '社区反馈池', xuanji_feed: '动态速报库', character_daily_metrics: '角色日指标',
  metrics: '平台指标(粉丝/播放)', follower_history: '粉丝历史',
}

export default function ImportCenter() {
  const [tasks, setTasks] = useState<ImportTask[]>([])
  const [target, setTarget] = useState('community_feedback')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const reload = async () => {
    try { setTasks((await importApi.tasks()).data) } catch (e: any) { setMsg('加载任务失败：' + String(e?.message || e)) }
  }

  useEffect(() => { void reload() }, [])

  const run = async (label: string, fn: () => Promise<any>) => {
    setBusy(label); setMsg('')
    try {
      const r = await fn()
      setMsg(r.message || label + '完成')
      await reload()
    } catch (e: any) {
      setMsg(label + '失败：' + String(e?.message || e))
    } finally {
      setBusy('')
    }
  }

  const onFile = async (f: File | null) => {
    if (!f) return
    await run('上传', () => importApi.upload(f, target))
    if (fileRef.current) fileRef.current.value = ''
  }

  const statusColor = (s: string) =>
    s === 'done' ? '#4a6a4a' : s === 'failed' ? '#A13A2A' : s === 'rolled_back' ? '#8a8578' : s === 'ready' ? '#8a7a2a' : '#5B8C9E'

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 32px 64px' }}>
      <h2 className="xj-section-title" style={{ padding: '0 0 6px', margin: 0 }}>数据导入中心</h2>
      <p style={{ fontSize: '0.625rem', color: 'var(--xj-muted)', margin: '0 0 24px' }}>
        上传原始内容（CSV / JSON / JSONL / TXT / 速报 DOCX）→ GLM-4-Flash 分批整理（清洗/去重/分类/情感/角色归属）→ 预览确认 → 分批入库 → 可回滚
      </p>

      {msg && <div style={{ fontSize: '0.6875rem', color: 'var(--xj-ink-soft)', marginBottom: 12, lineHeight: 1.6 }}>{msg}</div>}

      {/* 上传区 */}
      <div className="xj-panel" style={{ padding: '16px 18px', marginBottom: 24 }}>
        <div style={{ fontSize: '0.75rem', color: gold, marginBottom: 12, fontFamily: '"Noto Serif SC",serif' }}>① 上传原始内容</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.625rem', color: muted }}>目标表：
            <select value={target} onChange={(e) => setTarget(e.target.value)}
              style={{ marginLeft: 6, padding: '6px 10px', border: '1px solid rgba(218,30,43,0.2)', borderRadius: 6, background: '#fff', fontSize: '0.6875rem' }}>
              {Object.entries(TARGET_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <input ref={fileRef} type="file" accept=".csv,.json,.jsonl,.ndjson,.txt,.docx" style={{ fontSize: '0.625rem' }} onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
          <button className="xj-btn" style={{ padding: '6px 16px', fontSize: '0.625rem' }} disabled={!!busy}
            onClick={() => run('MediaCrawler 导入', () => importApi.mediacrawler(target))}>
            {busy ? '处理中...' : '一键导入 MediaCrawler 真实数据'}
          </button>
        </div>
        <div style={{ fontSize: '0.5625rem', color: 'var(--xj-faint)', marginTop: 10, lineHeight: 1.7 }}>
          支持格式：CSV（content/正文 列）、JSON 数组、JSONL 每行一条、TXT 每行一条。
          导入行统一标记来源 source=import:&lt;任务id&gt;，可随时回滚；MediaCrawler 导入自动完成「扫描 → 整理 → 入库」全链路。
          <br />
          速报 SOP：《玄机IP动态速报_YYYY-MM-DD.docx》（智普agent 抓取）上传后自动规则结构化 → 「动态速报库」，
          无需 GLM 整理、直接确认入库；期号日期取自文件名，重复导入自动去重，可回滚。
        </div>
      </div>

      {/* 任务列表 */}
      <div style={{ fontSize: '0.75rem', color: gold, marginBottom: 10, fontFamily: '"Noto Serif SC",serif' }}>② 导入任务（整理 → 提交 → 回滚）</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tasks.length === 0 && <div className="xj-panel" style={{ padding: 20, fontSize: '0.6875rem', color: muted, textAlign: 'center' }}>暂无导入任务 —— 上传文件或一键导入 MediaCrawler 数据开始</div>}
        {tasks.map((t) => (
          <div key={t.id} className="xj-panel" style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: ink }}>#{t.id} {t.name}</span>
              <span style={{ fontSize: '0.5625rem', padding: '2px 8px', borderRadius: 10, background: `${statusColor(t.status)}1a`, color: statusColor(t.status), fontWeight: 600 }}>{STATUS_LABEL[t.status] || t.status}</span>
              <span style={{ fontSize: '0.5625rem', color: muted }}>目标：{TARGET_LABEL[t.target] || t.target}</span>
              <span style={{ fontSize: '0.5625rem', color: muted }}>来源：{t.source_type}</span>
              <span style={{ fontSize: '0.5625rem', color: muted }}>模型：{t.model || '规则降级'}</span>
              <span style={{ fontSize: '0.5625rem', color: muted }}>{t.created_at?.replace('T', ' ')}</span>
              <span style={{ flex: 1 }} />
              <button className="xj-btn" style={{ padding: '4px 12px', fontSize: '0.5625rem' }} disabled={!!busy}
                onClick={() => setExpanded(expanded === t.id ? null : t.id)}>预览</button>
              {t.status === 'pending' || t.status === 'failed' ? (
                <button className="xj-btn" style={{ padding: '4px 12px', fontSize: '0.5625rem' }} disabled={!!busy}
                  onClick={() => run(`任务#${t.id} 整理`, () => importApi.analyze(t.id, true))}>整理</button>
              ) : null}
              {t.status === 'ready' && (
                <button className="xj-btn" style={{ padding: '4px 12px', fontSize: '0.5625rem', background: gold, color: '#fff', borderColor: gold }} disabled={!!busy}
                  onClick={() => run(`任务#${t.id} 入库`, () => importApi.commit(t.id))}>确认入库</button>
              )}
              {(t.status === 'done' || t.status === 'ready') && (
                <button className="xj-btn" style={{ padding: '4px 12px', fontSize: '0.5625rem', color: '#A13A2A', borderColor: 'rgba(218,30,43,0.4)' }} disabled={!!busy}
                  onClick={() => { if (confirm(`回滚任务 #${t.id} 写入的全部数据？`)) run(`任务#${t.id} 回滚`, () => importApi.rollback(t.id)) }}>回滚</button>
              )}
            </div>
            {t.status === 'done' && (
              <div style={{ fontSize: '0.5625rem', color: '#4a6a4a', marginTop: 8 }}>
                入库 {t.succeeded} 条 · 去重跳过 {t.failed} 条
              </div>
            )}
            {expanded === t.id && (
              <div style={{ marginTop: 12, maxHeight: 320, overflowY: 'auto', border: '1px solid rgba(218,30,43,0.08)', borderRadius: 6, padding: 8 }}>
                {t.payload.length === 0 && <div style={{ fontSize: '0.625rem', color: muted }}>尚未整理（无结构化预览）</div>}
                {t.payload.slice(0, 50).map((r, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '2.2fr 0.5fr 0.8fr 1fr 1.3fr', gap: 8, padding: '6px 4px', borderBottom: '1px solid rgba(218,30,43,0.04)', fontSize: '0.625rem', lineHeight: 1.5 }}>
                    <span style={{ color: 'var(--xj-ink-soft)' }}>{String(r.title || r.content || '').slice(0, 80)}</span>
                    <span style={{ color: 'var(--xj-faint)' }}>{r.score != null && r.score !== '' ? `★${r.score}` : '-'}</span>
                    <span style={{ color: 'var(--xj-faint)' }}>{r.category || r.sentiment || '-'}</span>
                    <span style={{ color: 'var(--xj-faint)' }}>{r.keyword || r.ip_name || '-'}</span>
                    <span style={{ color: 'var(--xj-faint)' }}>{[r.sentiment, r.role_type, r.character_name].filter(Boolean).join(' · ') || '-'}</span>
                  </div>
                ))}
                {t.payload.length > 50 && <div style={{ fontSize: '0.5625rem', color: muted, padding: 6 }}>… 共 {t.payload.length} 条（仅预览前 50）</div>}
              </div>
            )}
            {t.errors?.length > 0 && <div style={{ fontSize: '0.5625rem', color: '#A13A2A', marginTop: 6 }}>{t.errors.join('；')}</div>}
          </div>
        ))}
      </div>

      <p style={{ fontSize: '0.5625rem', color: '#4a4540', paddingTop: 24, lineHeight: 1.8 }}>
        闭环说明：上传/抓取原始内容 → GLM-4-Flash（glm-4-flash，已配置）分批整理为结构化 JSON → 预览确认 → 分批写入目标表（source=import:任务id）
        → 驾驶舱/社区/速报即时联动 → 需要时可回滚。无 LLM key 时自动降级为规则整理，管道不中断。
      </p>
    </div>
  )
}
