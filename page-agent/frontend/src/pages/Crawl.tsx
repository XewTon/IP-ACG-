// 玄策 · 数据采集 —— 嵌入 MediaCrawler WebUI
import { useState } from 'react'

const CRAWLER_URL = 'http://localhost:8080'

export default function Crawl() {
  const [loaded, setLoaded] = useState(false)
  const [err, setErr] = useState('')

  return (
    <div style={{ padding: '16px 28px', minHeight: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h2 className="xj-section-title" style={{ padding: '0 0 2px', margin: 0 }}>数据采集</h2>
          <p style={{ fontSize: '0.625rem', color: 'var(--xj-muted)', margin: 0 }}>
            MediaCrawler · 小红书 / 抖音 / B站 / 微博 / 贴吧 / 知乎 / 快手 多平台内容抓取
          </p>
        </div>
        <a href={CRAWLER_URL} target="_blank" rel="noopener noreferrer"
          className="xj-btn" style={{ padding: '6px 16px', fontSize: '0.6875rem', textDecoration: 'none' }}>
          在新窗口打开
        </a>
      </div>

      {err && (
        <div style={{ background: 'rgba(218,30,43,0.05)', border: '1px solid rgba(218,30,43,0.2)', padding: '12px 16px', marginBottom: 12, fontSize: '0.75rem', color: 'var(--xj-red)' }}>
          无法连接 MediaCrawler（{CRAWLER_URL}）。请先启动：
          <code style={{ display: 'block', marginTop: 6, background: 'rgba(0,0,0,0.05)', padding: '6px 10px', fontSize: '0.6875rem' }}>
            cd MediaCrawler && uv run uvicorn api.main:app --port 8080
          </code>
        </div>
      )}

      <div style={{ flex: 1, border: '1px solid var(--xj-line)', background: '#fff', position: 'relative', minHeight: 600 }}>
        {!loaded && !err && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--xj-muted)', fontSize: '0.75rem' }}>
            正在加载 MediaCrawler WebUI...
          </div>
        )}
        <iframe
          src={CRAWLER_URL}
          title="MediaCrawler"
          style={{ width: '100%', height: '100%', border: 'none', minHeight: 600 }}
          onLoad={() => setLoaded(true)}
          onError={() => setErr('加载失败')}
        />
      </div>
    </div>
  )
}
