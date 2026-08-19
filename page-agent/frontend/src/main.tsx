import React, { useCallback, useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import BootSequence, { SPLASH_IMG, BOOT_PARTICLE_TARGET } from './components/BootSequence'
import WeatherFX from './components/WeatherFX'
import { buildSplashCloud } from './lib/pointcloud'
import './index.css'

/* 开机序章：每次刷新均播放；?nosplash 显式跳过；prefers-reduced-motion 由 BootSequence 内部跳过 */
function shouldSkipSplash(): boolean {
  try {
    return new URLSearchParams(window.location.search).has('nosplash')
  } catch {
    return false
  }
}

/* 尽早启动粒子云构建：模块加载即开始（解码 + flood-fill + 60k 采样全在后台进行，
 * 黑场阶段即就绪），BootSequence 内命中 splashCloudCache 秒回 —— 消除开机动画首段的主线程阻塞。
 * 同时预热图片 HTTP 缓存，替代原 prewarmSplashImage 的二次解码。 */
if (!shouldSkipSplash()) {
  void buildSplashCloud(SPLASH_IMG, BOOT_PARTICLE_TARGET).catch(() => {})
}

/* 开机标志：开机期间 Layout 暂停挂载页面背景粒子 / 雨幕（避免双份 GPU 负载） */
function setBootFlag(v: boolean): void {
  try {
    ;(window as unknown as { __XUANCE_BOOT__?: boolean }).__XUANCE_BOOT__ = v
    window.dispatchEvent(new Event('xuance-boot'))
  } catch {
    /* ignore */
  }
}

function Root() {
  const [showBoot, setShowBoot] = useState(() => {
    if (shouldSkipSplash()) return false
    setBootFlag(true)
    return true
  })

  const handleBootDone = useCallback(() => {
    setBootFlag(false)
    setShowBoot(false)
  }, [])

  /* 开机期间：隐藏 App 子树（跳过绘制/合成，弱显卡不空耗）、锁定滚动 */
  useEffect(() => {
    document.body.style.overflow = showBoot ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [showBoot])

  return (
    <>
      <div id="app-shell" style={{ visibility: showBoot ? 'hidden' : 'visible' }}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </div>
      {/* 天气特效在开机序章结束后再挂载，避免双 WebGL 叠加卡顿 */}
      {!showBoot && <WeatherFX />}
      {showBoot && <BootSequence onDone={handleBootDone} />}
    </>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
