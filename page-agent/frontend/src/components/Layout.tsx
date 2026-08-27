import { NavLink, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Particles from './Particles'
import AiCopilot from './AiCopilot'
import PageRain from './PageRain'
import XuanCeLogo from './XuanCeLogo'

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
  { to: '/import', label: '数据导入' },
  { to: '/settings', label: '设置' },
]

export default function Layout() {
  /* 开机序章期间暂停页面背景粒子/雨幕（避免与开机 WebGL 双份负载导致卡顿） */
  const [booting, setBooting] = useState(() => {
    try {
      return (window as unknown as { __XUANCE_BOOT__?: boolean }).__XUANCE_BOOT__ === true
    } catch {
      return false
    }
  })
  useEffect(() => {
    const sync = () => {
      try {
        setBooting((window as unknown as { __XUANCE_BOOT__?: boolean }).__XUANCE_BOOT__ === true)
      } catch {
        setBooting(false)
      }
    }
    window.addEventListener('xuance-boot', sync)
    return () => window.removeEventListener('xuance-boot', sync)
  }, [])

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
      {!booting && <Particles />}
      {/* 页面雨幕：稀疏雨滴氛围层（z-index 低于内容，pointer-events 穿透） */}
      {!booting && <PageRain />}
      <div style={{ position: 'relative', zIndex: 10 }}>
        <header style={{ display: 'flex', alignItems: 'flex-end', gap: '18px', padding: '22px 32px 16px', background: 'linear-gradient(180deg, rgba(247,243,233,0.85) 0%, transparent 100%)' }}>
          <div style={{ flex: 1 }}>
            <h1 className="xj-brand" aria-label="玄策"><XuanCeLogo /></h1>
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
