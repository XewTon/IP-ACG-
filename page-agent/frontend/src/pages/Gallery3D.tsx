// 玄策 · IP视觉陈列 —— 等待 R3F 稳定后启用 3D 展柜
// 当前使用 2D 卡片陈列，保留 3D 代码框架
import { useState } from 'react'

const ITEMS = [
  { name: '沈砚', role: '视角人物 · 大三历史系学生', img: '/splash_figure.png', desc: '在图书馆古籍部第一次看见「墨痕」。从被动发现到主动探索。', assets: '立绘×3 / 表情集×1 / 角色卡×1 / PV×1' },
  { name: '林疏影', role: '引路人 · 古董店主', img: '/splash.png', desc: '南锣鼓巷「疏影阁」老板。身处其中但选择旁观。', assets: '立绘×3 / 场景概念×2 / 角色卡×1 / PV×1' },
  { name: '老白', role: '灰色地带 · 情报贩子', img: '/reference.png', desc: '潘家园旧货市场的神秘情报贩子。不完全正派，但了解所有规则。', assets: '立绘×2 / 角色卡×1 / PV×1' },
]

export default function Gallery3D() {
  const [sel, setSel] = useState(0)
  const ch = ITEMS[sel]
  const next = () => setSel((sel + 1) % ITEMS.length)
  const prev = () => setSel((sel - 1 + ITEMS.length) % ITEMS.length)

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '48px 32px' }}>
      <h2 className="xj-section-title" style={{ padding: '0 0 6px', margin: 0 }}>IP 视觉陈列</h2>
      <p style={{ fontSize: '0.625rem', color: 'var(--xj-muted)', margin: '0 0 28px' }}>
        玄策核心角色 · 立绘展示 · 素材索引
      </p>

      {/* 主图 */}
      <div className="xj-panel" style={{ padding: 24, marginBottom: 16, textAlign: 'center' }}>
        <img src={ch.img} alt={ch.name}
          style={{ maxHeight: '50vh', maxWidth: '100%', objectFit: 'contain',
            filter: 'drop-shadow(0 4px 12px rgba(42,46,55,0.12))' }} />
      </div>

      {/* 信息 */}
      <div className="xj-panel" style={{ padding: '16px 24px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
          <span style={{ fontFamily: '"Noto Serif SC",serif', fontSize: '1.125rem', fontWeight: 700, color: 'var(--xj-ink)' }}>{ch.name}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--xj-red)' }}>{ch.role}</span>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--xj-muted)', lineHeight: 1.7, margin: 0 }}>{ch.desc}</p>
        <div style={{ marginTop: 10, fontSize: '0.6875rem', color: 'var(--xj-faint)', borderTop: '1px solid var(--xj-line-soft)', paddingTop: 10 }}>
          已产出素材：{ch.assets}
        </div>
      </div>

      {/* 导航 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
        <button onClick={prev} className="xj-btn" style={{ padding: '6px 18px' }}>{'← 上一个'}</button>
        {ITEMS.map((c, i) => (
          <button key={c.name} onClick={() => setSel(i)}
            style={{ background: i === sel ? 'var(--xj-red)' : 'transparent', color: i === sel ? '#FBF7EE' : 'var(--xj-ink-soft)', border: `1px solid ${i === sel ? 'var(--xj-red)' : 'var(--xj-line)'}`, padding: '6px 18px', cursor: 'pointer', fontFamily: '"Noto Serif SC",serif', fontSize: '0.75rem' }}>
            {c.name}
          </button>
        ))}
        <button onClick={next} className="xj-btn" style={{ padding: '6px 18px' }}>{'下一个 →'}</button>
      </div>
    </div>
  )
}
