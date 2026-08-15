import { NavLink, Outlet } from 'react-router-dom'
import Particles from './Particles'
import AiCopilot from './AiCopilot'

const navItems = [
  { to: '/', label: '驾驶舱', end: true },
  { to: '/assets', label: 'IP资产' },
  { to: '/characters', label: '角色分析' },
  { to: '/assistant', label: 'AI助手' },
  { to: '/content', label: '内容运营' },
  { to: '/outsourcing', label: '供应链' },
  { to: '/community', label: '社区' },
  { to: '/data', label: '数据明细' },
  { to: '/xuanji', label: '玄机' },
  { to: '/3d', label: '3D陈列' },
  { to: '/crawl', label: '数据采集' },
  { to: '/settings', label: '设置' },
]

export default function Layout() {
  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <div className="sky-layer" />
      <div className="moon-halo" />
      <div className="moon-layer" />
      <div className="city-silhouette" />
      <div className="city-lights">
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} className="city-light-dot" style={{ animationDelay: `${i * 0.7}s` }} />
        ))}
      </div>
      <Particles />
      <div style={{ position: 'relative', zIndex: 10 }}>
        <header style={{ display: 'flex', alignItems: 'flex-end', gap: '18px', padding: '22px 32px 16px', background: 'linear-gradient(180deg, rgba(247,243,233,0.85) 0%, transparent 100%)' }}>
          <div style={{ flex: 1 }}>
            <h1 className="xj-brand">玄 策</h1>
            <p className="xj-subtitle" style={{ marginTop: 8 }}>国漫IP智能运营中心 · 玄机科技</p>
          </div>
          <nav style={{ display: 'flex', gap: 20, paddingBottom: 2, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {navItems.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => `xj-nav-link${isActive ? ' active' : ''}`}>{label}</NavLink>
            ))}
          </nav>
        </header>
        <hr className="xj-divider" />
        <main style={{ position: 'relative', zIndex: 1 }}><Outlet /></main>
      </div>
      <AiCopilot />
    </div>
  )
}
