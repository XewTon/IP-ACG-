/*
 * 玄策 · 实时天气效果层（全站背景氛围）
 * 数据：OpenWeather 实时 → weatherSys（8s 平滑过渡）
 * 渲染分层（自后向前）：
 *   sky   zIndex 2 —— 常驻 Canvas：天光渐变 + 太阳(sunny) + 云朵 + 雾蒙
 *   fog   zIndex 5 —— Vanta FOG（雾天，WebGL 云雾）
 *   rain  zIndex 5 —— RainScene（镜头水滴折射，借鉴 codrops/RainEffect）
 *   snow  zIndex 5 —— Snowstorm（DOM 雪花，原版库）
 *   streak zIndex 6 —— RainStreaks（雨线 + 溅点 + 闪电）
 * 层互斥启用，天气切换时 1.5s opacity 淡入淡出。
 */
import { useEffect, useRef } from 'react'
import { weatherSys, type Weather } from './weather'
import { getWeatherWithCache } from '../lib/weatherApi'
import { RainScene } from '../lib/rainScene'
import { RainStreaks } from '../lib/rainStreaks'

declare global {
  interface Window {
    THREE?: Record<string, unknown>
    VANTA?: Record<string, (opts: Record<string, unknown>) => { destroy: () => void }>
    snowStorm?: {
      start: () => void
      stop: () => void
      disabled: number
      flakesMax: number
      flakesMaxActive: number
      targetElement: HTMLElement | null
      snowColor: string
      flakeWidth: number
      flakeHeight: number
      animationInterval: number
      excludeMobile: boolean
    }
  }
}

interface Cloud {
  x: number
  y: number
  scale: number
  opacity: number
  speed: number
  dark: number
}

const FADE = 1.5 // s，层淡入淡出

export default function WeatherFX() {
  const skyRef = useRef<HTMLCanvasElement>(null)
  const rainRef = useRef<HTMLCanvasElement>(null)
  const streakRef = useRef<HTMLCanvasElement>(null)
  const snowRef = useRef<HTMLDivElement>(null)
  const fogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const skyCanvas = skyRef.current
    const rainCanvas = rainRef.current
    const streakCanvas = streakRef.current
    const snowDiv = snowRef.current
    const fogDiv = fogRef.current
    if (!skyCanvas || !rainCanvas || !streakCanvas || !snowDiv || !fogDiv) return

    const W = () => window.innerWidth
    const H = () => window.innerHeight
    const sizeCanvas = (c: HTMLCanvasElement) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      c.width = Math.floor(W() * dpr)
      c.height = Math.floor(H() * dpr)
    }
    sizeCanvas(skyCanvas)
    sizeCanvas(rainCanvas)
    sizeCanvas(streakCanvas)
    const skyCtx = skyCanvas.getContext('2d')!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    /* ---------- 云朵（一次性生成） ---------- */
    const clouds: Cloud[] = []
    for (let i = 0; i < 18; i++) {
      clouds.push({
        x: Math.random() * W(),
        y: (0.02 + Math.random() * 0.3) * H(),
        scale: 0.9 + Math.random() * 1.4,
        opacity: 0.12 + Math.random() * 0.12,
        speed: 2 + Math.random() * 5,
        dark: Math.random(),
      })
    }

    /* ---------- 雨层 ---------- */
    let rainScene: RainScene | null = null
    let rainStreaks: RainStreaks | null = null
    let rainReady = false
    try {
      rainScene = new RainScene(rainCanvas)
      rainStreaks = new RainStreaks(streakCanvas)
      rainReady = true
    } catch (err) {
      console.error('[weather] rain layer init failed:', err)
      rainReady = false
    }

    /* ---------- 雾层（Vanta FOG，动态 import） ---------- */
    let vantaFog: { destroy: () => void } | null = null
        const initVanta = async () => {
      try {
        const THREE = await import('three')
        window.THREE = THREE as unknown as Record<string, unknown>
        const Vanta = (await import('vanta/dist/vanta.fog.min')).default
        vantaFog = Vanta({
          el: fogDiv,
          THREE: window.THREE,
          mouseControls: false,
          touchControls: false,
          gyroControls: false,
          minHeight: 200,
          minWidth: 200,
          highlightColor: 0x38506a,
          midtoneColor: 0x1c2a3a,
          lowlightColor: 0x0e1720,
          baseColor: 0x0a1017,
          speed: 0.5,
          zoom: 0.9,
        })
      } catch {
        /* vanta 不可用则跳过雾层 */
      }
    }
    void initVanta()

    /* ---------- 雪层（Snowstorm 原版库，script 标签加载以挂载全局 window.snowStorm） ---------- */
    const initSnow = async () => {
      try {
        const snowUrl: string = new URL('../vendor/snowstorm/snowstorm.js', import.meta.url).href
        const script = document.createElement('script')
        script.src = snowUrl
        script.onload = () => {
          const ss = window.snowStorm
          if (!ss) {
            console.error('[weather] snowstorm missing')
            return
          }
          try {
            ss.stop()
          } catch {
            /* ignore */
          }
          ss.disabled = 0 // stop() 内部 freeze() 置 1，需复位才能 start()
          ss.targetElement = snowDiv
          ss.flakesMax = 140
          ss.flakesMaxActive = 100
          ss.flakeWidth = 6
          ss.flakeHeight = 6
          ss.animationInterval = 28
          ss.excludeMobile = false
          ss.snowColor = 'rgba(176,188,200,0.85)'
          ss.start()
        }
        script.onerror = () => console.error('[weather] snowstorm load failed')
        document.head.appendChild(script)
      } catch {
        /* snowstorm 不可用则跳过雪层 */
      }
    }
    void initSnow()

    /* ---------- 层引用与切换 ---------- */
    const layers = {
      rain: rainReady ? [rainRef.current!, streakRef.current!] : [],
      snow: [snowDiv],
      fog: [fogDiv],
    }
    const setLayerVisible = (name: keyof typeof layers, on: boolean) => {
      for (const el of layers[name]) {
        el.style.transition = `opacity ${FADE}s ease`
        el.style.opacity = on ? '1' : '0'
      }
    }

    /* ---------- 天空层绘制 ---------- */
    const drawCloud = (c: Cloud, t: number, opacity: number) => {
      const s = Math.min(W(), H())
      const r = s * 0.11 * c.scale
      const x = c.x + t * c.speed * (opacity * 0.5 + 0.5) * 0.01
      const wrap = W() + r * 2
      const cx = ((x % wrap) + wrap) % wrap - r
      const cy = c.y
      const base = c.dark > 0.5 ? '82,98,116' : '104,120,138'
      const blobs = [
        [0, 0, 1],
        [-0.9, 0.25, 0.6],
        [0.9, 0.2, 0.65],
        [0.1, -0.4, 0.55],
      ] as const
      for (const [ox, oy, sc] of blobs) {
        const g = skyCtx.createRadialGradient(cx + ox * r, cy + oy * r, 0, cx + ox * r, cy + oy * r, r * sc)
        g.addColorStop(0, `rgba(${base},${c.opacity * opacity})`)
        g.addColorStop(1, `rgba(${base},0)`)
        skyCtx.fillStyle = g
        skyCtx.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4)
      }
    }

    const frame = (now: number) => {
      const w = weatherSys.update(Date.now())
      const t = now / 1000
      const cur: Weather = w.current

      /* 天空层 */
      const sk = skyCtx
      const cw = skyCanvas.width
      const ch = skyCanvas.height
      sk.clearRect(0, 0, cw, ch)
      sk.setTransform(dpr, 0, 0, dpr, 0, 0)
      // 天光渐变（随天气，氛围一眼可辨）
      const skyTints: Record<Weather, [number, number, number, number]> = {
        sunny: [233, 214, 160, 0.26],
        cloudy: [96, 118, 140, 0.26],
        rain: [52, 70, 92, 0.36],
        storm: [24, 32, 46, 0.48],
        snow: [150, 168, 186, 0.24],
        fog: [124, 140, 158, 0.24],
      }
      const [tr, tg, tb, ta] = skyTints[cur]
      const tint = sk.createLinearGradient(0, 0, 0, H() * 0.6)
      tint.addColorStop(0, `rgba(${tr},${tg},${tb},${ta})`)
      tint.addColorStop(1, `rgba(${tr},${tg},${tb},0)`)
      sk.fillStyle = tint
      sk.fillRect(0, 0, cw, ch)

      // 云影（多云/雨/雷暴：地面大暗斑缓慢移动，阴影随云量增强）
      if (cur === 'cloudy' || cur === 'rain' || cur === 'storm') {
        const shadowA = 0.06 + w.cloudOpacity * 0.12
        for (let i = 0; i < 3; i++) {
          const sw = W() * 0.45
          const sh = H() * 0.28
          const ox = ((t * (3 + i) * 6 + i * 400) % (W() + sw * 2)) - sw
          const oy = H() * (0.45 + i * 0.16) + Math.sin(t * 0.5 + i * 2) * H() * 0.03
          const g = sk.createRadialGradient(ox, oy, 0, ox, oy, sw)
          g.addColorStop(0, `rgba(18,26,36,${shadowA})`)
          g.addColorStop(1, 'rgba(18,26,36,0)')
          sk.fillStyle = g
          sk.fillRect(ox - sw, oy - sh, sw * 2, sh * 2)
        }
      }

      // 云朵
      const cloudOpacity = w.cloudOpacity
      for (const c of clouds) drawCloud(c, t, cloudOpacity)

      // 太阳（晴天，云多时被遮）+ 柔光射线
      if (cur === 'sunny' || (cur === 'cloudy' && w.cloudOpacity < 0.4)) {
        const sunAlpha = 1 - w.cloudOpacity * 0.9
        if (sunAlpha > 0.05) {
          const s = Math.min(W(), H())
          const sx = W() * 0.8
          const sy = H() * 0.15
          const r = s * 0.055
          const g0 = sk.createRadialGradient(sx, sy, 0, sx, sy, r * 8)
          g0.addColorStop(0, `rgba(242,227,179,${0.36 * sunAlpha})`)
          g0.addColorStop(0.35, `rgba(217,168,69,${0.16 * sunAlpha})`)
          g0.addColorStop(1, 'rgba(217,168,69,0)')
          sk.fillStyle = g0
          sk.fillRect(sx - r * 8, sy - r * 8, r * 16, r * 16)
          // 柔光射线（4 条）
          for (let i = 0; i < 4; i++) {
            const ang = (i / 4) * Math.PI * 2 + Math.PI * 0.12
            const len = r * 4.5
            const rg = sk.createLinearGradient(
              sx + Math.cos(ang) * r * 1.6,
              sy + Math.sin(ang) * r * 1.6,
              sx + Math.cos(ang) * len,
              sy + Math.sin(ang) * len,
            )
            rg.addColorStop(0, `rgba(242,227,179,${0.20 * sunAlpha})`)
            rg.addColorStop(1, 'rgba(242,227,179,0)')
            sk.fillStyle = rg
            sk.beginPath()
            sk.moveTo(sx + Math.cos(ang - 0.06) * r * 1.6, sy + Math.sin(ang - 0.06) * r * 1.6)
            sk.lineTo(sx + Math.cos(ang + 0.06) * r * 1.6, sy + Math.sin(ang + 0.06) * r * 1.6)
            sk.lineTo(sx + Math.cos(ang + 0.09) * len, sy + Math.sin(ang + 0.09) * len)
            sk.lineTo(sx + Math.cos(ang - 0.09) * len, sy + Math.sin(ang - 0.09) * len)
            sk.closePath()
            sk.fill()
          }
          const g2 = sk.createRadialGradient(sx, sy, 0, sx, sy, r)
          g2.addColorStop(0, `rgba(255,249,230,${0.95 * sunAlpha})`)
          g2.addColorStop(0.65, `rgba(244,214,150,${0.85 * sunAlpha})`)
          g2.addColorStop(1, `rgba(217,168,69,${0.2 * sunAlpha})`)
          sk.fillStyle = g2
          sk.beginPath()
          sk.arc(sx, sy, r, 0, Math.PI * 2)
          sk.fill()
        }
      }
      // 雾蒙（雾天整层灰白，配合 Vanta）
      if (cur === 'fog') {
        const fg = sk.createLinearGradient(0, 0, 0, H())
        fg.addColorStop(0, 'rgba(138,152,170,0.20)')
        fg.addColorStop(0.6, 'rgba(138,152,170,0.28)')
        fg.addColorStop(1, 'rgba(138,152,170,0.16)')
        sk.fillStyle = fg
        sk.fillRect(0, 0, cw, ch)
      }

      /* 专属层切换（互斥） */
      const isRain = cur === 'rain' || cur === 'storm'
      setLayerVisible('rain', isRain)
      setLayerVisible('snow', cur === 'snow')
      setLayerVisible('fog', cur === 'fog')
      if (isRain) {
        if (rainScene) rainScene.setParams(w.intensity, w.windSpeed)
        if (rainStreaks) rainStreaks.setParams(w.intensity, w.windSpeed)
      }
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)

    /* ---------- 雨/雪层启停随可见性 ---------- */
    let lastVisible: { rain: boolean; snow: boolean } | null = null
    const syncLayers = () => {
      const w = weatherSys.state
      const isRain = w.current === 'rain' || w.current === 'storm'
      const isSnow = w.current === 'snow'
      const changed = !lastVisible || lastVisible.rain !== isRain || lastVisible.snow !== isSnow
      if (!changed) return
      lastVisible = { rain: isRain, snow: isSnow }
      if (isRain) {
        if (rainScene) rainScene.start()
        if (rainStreaks) rainStreaks.start()
      } else {
        if (rainScene) rainScene.stop()
        if (rainStreaks) rainStreaks.stop()
      }
    }
    // 轮询（状态机过渡完成后切换）
    const layerTimer = window.setInterval(syncLayers, 300)

    /* ---------- 实时天气 API ---------- */
    ;(window as any).__weatherSys = weatherSys // TEMP-DEBUG
    let cancelled = false
    const refresh = async () => {
      try {
        const report = await getWeatherWithCache()
        if (cancelled) return
        weatherSys.setFromApi(report.weather, report.intensity, report.windSpeed)
      } catch {
        if (!cancelled) weatherSys.auto = true
      }
    }
    void refresh()
    const apiTimer = window.setInterval(refresh, 15 * 60 * 1000)
    const onVis = () => {
      if (!document.hidden) void refresh()
    }
    document.addEventListener('visibilitychange', onVis)

    const onResize = () => {
      sizeCanvas(skyCanvas)
      sizeCanvas(rainCanvas)
      sizeCanvas(streakCanvas)
      if (rainScene) rainScene.resize()
      if (rainStreaks) rainStreaks.resize()
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelled = true
      clearInterval(apiTimer)
      clearInterval(layerTimer)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('resize', onResize)
      rainScene?.dispose()
      rainStreaks?.dispose()
      if (window.snowStorm) window.snowStorm.stop()
      vantaFog?.destroy()
    }
  }, [])

  return (
    <>
      <canvas ref={skyRef} aria-hidden="true" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 2 }} />
      <div ref={fogRef} aria-hidden="true" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 5, opacity: 0 }} />
      <canvas ref={rainRef} aria-hidden="true" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 5, opacity: 0 }} />
      <div ref={snowRef} aria-hidden="true" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 5, opacity: 0, overflow: 'hidden' }} />
      <canvas ref={streakRef} aria-hidden="true" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 6, opacity: 0 }} />
    </>
  )
}
