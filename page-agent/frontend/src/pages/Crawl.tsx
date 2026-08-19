// 玄策 · 数据采集 —— 嵌入 MediaCrawler WebUI（连通性探测 + 超时兜底 + 掉线自愈 + 重试）
// 注意：必须用 127.0.0.1 而非 localhost —— localhost 会优先解析到 IPv6 ::1，
// 而 uvicorn 只监听 IPv4，导致 iframe 挂起超时（fetch 探测有回退所以会误报"服务已响应"）。
import { useCallback, useEffect, useRef, useState } from 'react'

const CRAWLER_URL = 'http://127.0.0.1:8080'
const PROBE_TIMEOUT = 4000 // 探测超时（ms）
const IFRAME_TIMEOUT = 10000 // iframe 加载超时（ms）
const LIVENESS_INTERVAL = 5000 // 加载期间存活轮询（ms）

type Status = 'checking' | 'up' | 'down'

export default function Crawl() {
  const [status, setStatus] = useState<Status>('checking')
  const [err, setErr] = useState('')
  const [iframeKey, setIframeKey] = useState(0)
  const loadedRef = useRef(false)
  const timerRef = useRef<number | null>(null)
  const pollRef = useRef<number | null>(null)
  const failCountRef = useRef(0)

  /* 连通性探测：no-cors 下无法读状态码，但能区分「服务在线」与「连接失败」 */
  const probe = useCallback(async (): Promise<boolean> => {
    try {
      const ctrl = new AbortController()
      const timer = window.setTimeout(() => ctrl.abort(), PROBE_TIMEOUT)
      await fetch(CRAWLER_URL, { mode: 'no-cors', cache: 'no-store', signal: ctrl.signal })
      window.clearTimeout(timer)
      return true
    } catch {
      return false
    }
  }, [])

  const clearTimers = () => {
    if (timerRef.current != null) { window.clearTimeout(timerRef.current); timerRef.current = null }
    if (pollRef.current != null) { window.clearInterval(pollRef.current); pollRef.current = null }
  }

  const check = useCallback(async () => {
    clearTimers()
    failCountRef.current = 0
    setStatus('checking')
    setErr('')
    const ok = await probe()
    if (!ok) {
      setStatus('down')
      setErr(`无法连接 MediaCrawler（${CRAWLER_URL}）。请先启动服务，然后点击重试。`)
      return
    }
    setStatus('up')
    // 服务在线：给 iframe 一次加载机会，超时仍未加载完成则提示
    loadedRef.current = false
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      if (!loadedRef.current) {
        setErr('服务已响应，但 WebUI 页面加载超时。可点「重试连接」重新加载；若仍超时请确认服务监听了 127.0.0.1。')
      }
    }, IFRAME_TIMEOUT)
    // 加载完成前轮询存活：连续 2 次失败才判定掉线（避免单次探测抖动误报）；
    // iframe 一旦加载成功即停止轮询（iframe 本身就是存活指标）
    pollRef.current = window.setInterval(async () => {
      if (loadedRef.current) {
        clearTimers()
        return
      }
      const alive = await probe()
      if (alive) {
        failCountRef.current = 0
        return
      }
      failCountRef.current += 1
      if (failCountRef.current >= 2) {
        clearTimers()
        setStatus('down')
        setErr(`MediaCrawler 连接中断（${CRAWLER_URL}）。服务可能已停止，请重新启动后点击重试。`)
      }
    }, LIVENESS_INTERVAL)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [probe])

  useEffect(() => {
    void check()
    return clearTimers
  }, [check])

  const retry = () => {
    setIframeKey((k) => k + 1)
    void check()
  }

  return (
    <div style={{ padding: '16px 28px', minHeight: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h2 className="xj-section-title" style={{ padding: '0 0 2px', margin: 0 }}>数据采集</h2>
          <p style={{ fontSize: '0.625rem', color: 'var(--xj-muted)', margin: 0 }}>
            MediaCrawler · 小红书 / 抖音 / B站 / 微博 / 贴吧 / 知乎 / 快手 多平台内容抓取
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href={CRAWLER_URL} target="_blank" rel="noopener noreferrer"
            className="xj-btn" style={{ padding: '6px 16px', fontSize: '0.6875rem', textDecoration: 'none' }}>
            在新窗口打开
          </a>
          <button onClick={retry} className="xj-btn" style={{ padding: '6px 16px', fontSize: '0.6875rem' }}>
            重试连接
          </button>
        </div>
      </div>

      {status === 'checking' && (
        <div style={{ background: 'rgba(91,140,158,0.06)', border: '1px solid rgba(91,140,158,0.25)', padding: '12px 16px', marginBottom: 12, fontSize: '0.75rem', color: 'var(--xj-ink-soft)' }}>
          正在检测 MediaCrawler 服务（{CRAWLER_URL}）…
        </div>
      )}

      {status === 'down' && (
        <div style={{ background: 'rgba(218,30,43,0.05)', border: '1px solid rgba(218,30,43,0.2)', padding: '14px 16px', marginBottom: 12, fontSize: '0.75rem', color: 'var(--xj-red)' }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>⚠ {err}</div>
          <div>启动命令：</div>
          <code style={{ display: 'block', marginTop: 6, background: 'rgba(0,0,0,0.05)', padding: '6px 10px', fontSize: '0.6875rem' }}>
            cd MediaCrawler &amp;&amp; .venv\Scripts\python.exe -m uvicorn api.main:app --host 127.0.0.1 --port 8080
          </code>
          <button onClick={retry} className="xj-btn" style={{ marginTop: 10, padding: '5px 14px', fontSize: '0.625rem' }}>服务已启动，重新检测</button>
        </div>
      )}

      {status === 'up' && err && (
        <div style={{ background: 'rgba(217,168,69,0.07)', border: '1px solid rgba(217,168,69,0.35)', padding: '12px 16px', marginBottom: 12, fontSize: '0.75rem', color: 'var(--xj-gold)' }}>
          ⚠ {err}
        </div>
      )}

      <div style={{ flex: 1, border: '1px solid var(--xj-line)', background: '#fff', position: 'relative', minHeight: 600 }}>
        {status !== 'down' && !loadedRef.current && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--xj-muted)', fontSize: '0.75rem', zIndex: 2, background: '#fff' }}>
            {status === 'checking' ? '正在检测服务…' : '正在加载 MediaCrawler WebUI...'}
          </div>
        )}
        {status !== 'down' && (
          <iframe
            key={iframeKey}
            src={CRAWLER_URL}
            title="MediaCrawler"
            style={{ width: '100%', height: '100%', border: 'none', minHeight: 600 }}
            onLoad={() => { loadedRef.current = true; setErr(''); clearTimers() }}
          />
        )}
        {status === 'down' && (
          <div style={{ height: '100%', minHeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--xj-faint)', fontSize: '0.75rem' }}>
            服务离线 — 启动 MediaCrawler 后点击「重试连接」
          </div>
        )}
      </div>
    </div>
  )
}
