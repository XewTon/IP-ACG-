/*
 * 玄策 · 玄机 IP 视觉陈列馆 —— 按作品分区 × 三种展示模式
 *   - 左侧「作品导航」rail（与官网 xjent.com 作品结构一致）：秦时明月 / 天行九歌 / 武庚纪 / 斗罗大陆 / 天宝伏妖录
 *     / 吞噬星空 / 师兄啊师兄 / 斗罗大陆Ⅱ绝世唐门 / 天谕 / 牧神记 / 官方壁纸精选
 *   - 每个作品区三种模式：3D 画廊（多行自适应）/ 专业展柜（分页）/ 2D 陈列（降级）
 * 数据源：src/data/xuanjiWallpapers.ts（玄机官方壁纸精选，来源 xjent.com）
 */
import { useEffect, useMemo, useState } from 'react'
import { TYPE_LABEL, type IPAsset } from '../data/assets'
import { SERIES, wallpaperSeries, type SeriesId } from '../data/xuanjiSeries'
import { WALLPAPERS } from '../data/xuanjiWallpapers'
import Showcase from './3d/Showcase'
import GalleryCanvas from './3d/GalleryCanvas'
import { dark, type } from '../lib/theme'

type Mode = 'gallery' | 'showcase' | 'cards'
const MODES: { k: Mode; l: string; hint: string }[] = [
  { k: 'gallery', l: '3D 画廊', hint: '悬停放大 · 鼠标视差 · 点击查看' },
  { k: 'showcase', l: '专业展柜', hint: '原图 / 墨影点云 / 立绘浮雕 · 点击展品进入' },
  { k: 'cards', l: '2D 陈列', hint: '轻量浏览 · 无需 WebGL' },
]
const SHOWCASE_PAGE_SIZE = 6

function detectWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl') || c.getContext('experimental-webgl'))
  } catch {
    return false
  }
}

/* 2D 降级陈列（键盘 ← → / ESC / 加载失败兜底） */
function CardsGallery({ items, selectedId, onSelect }: { items: IPAsset[]; selectedId: string | null; onSelect: (id: string | null) => void }) {
  const [imgErr, setImgErr] = useState<Record<string, boolean>>({})
  const idx = Math.max(0, items.findIndex((a) => a.id === selectedId))
  const ch = items[idx] ?? items[0]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') onSelect(items[(idx + 1) % items.length].id)
      if (e.key === 'ArrowLeft') onSelect(items[(idx - 1 + items.length) % items.length].id)
      if (e.key === 'Escape') onSelect(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [idx, items, onSelect])

  return (
    <div>
      <div className="xj-panel" style={{ padding: 24, marginBottom: 14, textAlign: 'center', background: '#0E0D0C', border: '1px solid rgba(212,160,74,0.3)' }}>
        {imgErr[ch.id] ? (
          <div style={{ padding: '60px 0', color: dark.muted, fontSize: '0.75rem' }}>素材加载失败（{ch.src}）</div>
        ) : (
          <img
            key={ch.id}
            src={ch.src}
            alt={ch.name}
            onError={() => setImgErr((m) => ({ ...m, [ch.id]: true }))}
            style={{ maxHeight: '46vh', maxWidth: '100%', objectFit: 'contain', filter: 'drop-shadow(0 6px 20px rgba(0,0,0,0.5))' }}
          />
        )}
      </div>
      <div className="xj-panel" style={{ padding: '16px 24px', marginBottom: 14, background: dark.paper, color: dark.ink }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: type.serif, fontSize: '1rem', fontWeight: 700 }}>{ch.name}</span>
          <span style={{ fontSize: '0.6875rem', color: dark.accent }}>{ch.work} · {TYPE_LABEL[ch.type]}</span>
        </div>
        <p style={{ fontSize: '0.6875rem', color: dark.muted, lineHeight: 1.7, margin: '0 0 8px' }}>{ch.note}</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ch.tags.map((t) => (
            <span key={t} style={{ fontSize: '0.5625rem', color: dark.accent, border: `1px solid ${dark.line}`, padding: '2px 8px', borderRadius: 3 }}>{t}</span>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button className="xj-btn" style={{ padding: '6px 16px' }} onClick={() => onSelect(items[(idx - 1 + items.length) % items.length].id)}>← 上一个</button>
        {items.map((a) => (
          <button key={a.id} onClick={() => onSelect(a.id)}
            style={{ background: a.id === selectedId ? 'var(--xj-red)' : 'transparent', color: a.id === selectedId ? '#FBF7EE' : 'var(--xj-ink-soft)', border: `1px solid ${a.id === selectedId ? 'var(--xj-red)' : 'var(--xj-line)'}`, padding: '6px 14px', cursor: 'pointer', fontFamily: type.serif, fontSize: '0.6875rem' }}>
            {a.name.replace(/壁纸$/, '')}
          </button>
        ))}
        <button className="xj-btn" style={{ padding: '6px 16px' }} onClick={() => onSelect(items[(idx + 1) % items.length].id)}>下一个 →</button>
      </div>
      <p style={{ fontSize: '0.5625rem', color: dark.muted, textAlign: 'center', marginTop: 12 }}>← → 键盘切换 · ESC 取消选中</p>
    </div>
  )
}

export default function Gallery3D() {
  const [mode, setMode] = useState<Mode>(() => (detectWebGL() ? 'gallery' : 'cards'))
  const [activeSeries, setActiveSeries] = useState<SeriesId>('qinshimingyue')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [scPage, setScPage] = useState(0)

  /* 按作品分区：override 映射优先 */
  const itemsOf = useMemo(() => {
    const map = new Map<SeriesId, (typeof WALLPAPERS)[number][]>()
    for (const s of SERIES) map.set(s.id, [])
    for (const w of WALLPAPERS) {
      const sid = wallpaperSeries(w.series, w.id)
      const list = map.get(sid)
      if (list) list.push(w)
    }
    return map
  }, [])

  const items: IPAsset[] = itemsOf.get(activeSeries) ?? []
  const seriesInfo = SERIES.find((s) => s.id === activeSeries) ?? SERIES[SERIES.length - 1]
  const pageItems = mode === 'showcase' ? items.slice(scPage * SHOWCASE_PAGE_SIZE, (scPage + 1) * SHOWCASE_PAGE_SIZE) : items
  const totalPages = Math.max(1, Math.ceil(items.length / SHOWCASE_PAGE_SIZE))

  useEffect(() => {
    setSelectedId(null)
    setScPage(0)
  }, [activeSeries, mode])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const selected = selectedId ? items.find((a) => a.id === selectedId) ?? null : null
  const modeHint = MODES.find((m) => m.k === mode)?.hint ?? ''

  return (
    <div style={{ maxWidth: 1160, margin: '0 auto', padding: '32px 28px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h2 className="xj-section-title" style={{ padding: '0 0 6px', margin: 0 }}>玄机 · IP 视觉陈列馆</h2>
          <p style={{ fontSize: '0.625rem', color: 'var(--xj-muted)', margin: '4px 0 0' }}>
            官方壁纸精选（来源 <a href="https://www.xjent.com/100033/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--xj-blue)' }}>xjent.com 精美壁纸</a>）· 按作品分区 · {modeHint}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {MODES.map((m) => (
            <button key={m.k} onClick={() => setMode(m.k)}
              className="xj-btn" style={{
                padding: '6px 14px', fontSize: '0.6875rem',
                background: mode === m.k ? 'var(--xj-red)' : 'transparent',
                color: mode === m.k ? '#FBF7EE' : 'var(--xj-ink-soft)',
                border: `1px solid ${mode === m.k ? 'var(--xj-red)' : 'rgba(218,30,43,0.35)'}`,
              }}>
              {m.l}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
        {/* 作品导航 rail */}
        <aside style={{ width: 150, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4, position: 'sticky', top: 16 }}>
          {SERIES.map((s) => {
            const cnt = (itemsOf.get(s.id) ?? []).length
            const active = s.id === activeSeries
            return (
              <button key={s.id} onClick={() => setActiveSeries(s.id)}
                style={{
                  textAlign: 'left', padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
                  fontFamily: type.sans, fontSize: '0.75rem', letterSpacing: '0.04em',
                  background: active ? 'var(--xj-red)' : 'transparent',
                  color: active ? '#FBF7EE' : 'var(--xj-ink-soft)',
                  border: active ? '1px solid var(--xj-red)' : '1px solid var(--xj-line)',
                }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  <span style={{ fontSize: '0.5625rem', opacity: 0.75 }}>{cnt || ''}</span>
                </span>
              </button>
            )
          })}
          <a href="https://www.xjent.com/" target="_blank" rel="noopener noreferrer"
            style={{ marginTop: 10, fontSize: '0.5625rem', color: 'var(--xj-muted)', textAlign: 'center', textDecoration: 'none' }}>
            官网 xjent.com ↗
          </a>
        </aside>

        {/* 主区 */}
        <main style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
            <span style={{ fontFamily: type.serif, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--xj-ink)' }}>{seriesInfo.name}</span>
            <span style={{ fontSize: '0.625rem', color: 'var(--xj-muted)' }}>
              {items.length} 张官方壁纸{seriesInfo.siteUrl && ` · ${seriesInfo.id === 'official' ? '官网精美壁纸' : '官网作品页'}`}
            </span>
            {seriesInfo.siteUrl && (
              <a href={seriesInfo.siteUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.625rem', color: 'var(--xj-blue)', textDecoration: 'none', marginLeft: 'auto' }}>
                查看官网 →
              </a>
            )}
          </div>

          {items.length === 0 ? (
            <div className="xj-panel" style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--xj-faint)', fontSize: '0.75rem', lineHeight: 2 }}>
              该系列官方壁纸持续收录中 —— 可在 <b>官方壁纸精选</b> 区浏览全量精选壁纸，或前往
              <a href={seriesInfo.siteUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--xj-blue)' }}>官网 {seriesInfo.name} 页</a>查看。
            </div>
          ) : (
            <>
              {mode === 'gallery' && (
                <div style={{ position: 'relative', height: 540, borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(212,160,74,0.35)', background: '#0E0D0C' }}>
                  <GalleryCanvas assets={items} selectedId={selectedId} onSelect={setSelectedId} />
                  {selected && (
                    <div style={{
                      position: 'absolute', right: 18, top: 18, zIndex: 5, width: 236,
                      padding: '16px 18px', borderRadius: 10,
                      background: 'linear-gradient(150deg, rgba(26,23,20,0.94), rgba(14,13,12,0.86))',
                      border: '1px solid rgba(212,160,74,0.35)', backdropFilter: 'blur(6px)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontFamily: type.serif, fontSize: '0.9375rem', fontWeight: 700, color: dark.ink }}>{selected.name}</div>
                          <div style={{ fontSize: '0.625rem', color: dark.accent, marginTop: 4 }}>{seriesInfo.name} · 官方壁纸</div>
                        </div>
                        <button onClick={() => setSelectedId(null)} style={{ background: 'none', border: 'none', color: dark.muted, cursor: 'pointer', fontSize: '0.8125rem', lineHeight: 1 }}>×</button>
                      </div>
                      <p style={{ fontSize: '0.625rem', color: dark.muted, lineHeight: 1.7, margin: '10px 0' }}>{selected.note}</p>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                        {selected.tags.map((t) => (
                          <span key={t} style={{ fontSize: '0.5625rem', color: dark.accent, border: `1px solid ${dark.line}`, padding: '2px 7px', borderRadius: 3 }}>{t}</span>
                        ))}
                      </div>
                      {'source' in selected && (
                        <a href={(selected as { source?: string }).source} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: '0.5625rem', color: dark.blue, textDecoration: 'none' }}>
                          官网原图 ↗
                        </a>
                      )}
                    </div>
                  )}
                  <div style={{ position: 'absolute', left: 16, bottom: 12, fontSize: '0.5625rem', color: 'rgba(154,140,117,0.75)', letterSpacing: '0.14em', zIndex: 5 }}>
                    悬停放大 · 鼠标视差 · 点击素材查看 · ESC 取消
                  </div>
                </div>
              )}

              {mode === 'showcase' && (
                <>
                  <Showcase assets={pageItems} />
                  {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 10 }}>
                      <button className="xj-btn" style={{ padding: '5px 14px', fontSize: '0.625rem' }} disabled={scPage === 0} onClick={() => setScPage((p) => Math.max(0, p - 1))}>← 上一页</button>
                      <span style={{ fontSize: '0.625rem', color: 'var(--xj-muted)' }}>{scPage + 1} / {totalPages}</span>
                      <button className="xj-btn" style={{ padding: '5px 14px', fontSize: '0.625rem' }} disabled={scPage >= totalPages - 1} onClick={() => setScPage((p) => Math.min(totalPages - 1, p + 1))}>下一页 →</button>
                    </div>
                  )}
                  <p style={{ fontSize: '0.625rem', color: 'var(--xj-muted)', marginTop: 12 }}>
                    展柜模式：点击展品拉出 → 切换「原图 / 墨影点云 / 立绘浮雕」→ 拖拽旋转 · 滚轮缩放 · ESC 返回展架。
                  </p>
                </>
              )}

              {mode === 'cards' && (
                <CardsGallery items={items} selectedId={selectedId} onSelect={setSelectedId} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
