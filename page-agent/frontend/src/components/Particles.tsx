/*
 * 玄策 · 图片人物粒子系统（主视觉背景）
 * 源图：天行九歌官方·卫庄四周年立绘（public/tianxingjiuge.jpg）
 * 「纸上墨影」模式：亮度填充 + 饱和度衣物补充 + 边缘 → 水墨剪影粒子，
 * 高光处落朱砂/天行金点睛；鼠标排斥/点击吸引；呼吸浮动
 * 环境粒子（尘埃/灵气/落花/天气）可在设置页开关
 */
import { useEffect, useRef } from 'react'
import { weatherSys } from './weather'

const IMG_SRC = '/tianxingjiuge.jpg'
const LS_FIG = 'bg_figure_particles'
const LS_ENV = 'bg_env_particles'

function rand(min: number, max: number) { return Math.random() * (max - min) + min }

interface DustParticle { type: 'dust'; x: number; y: number; size: number; opacity: number; vx: number; vy: number; color: string; life: number }
interface SpiritParticle { type: 'spirit'; x: number; y: number; baseY: number; size: number; opacity: number; phase: number; speed: number; color: string }
interface PetalParticle { type: 'petal'; x: number; y: number; size: number; opacity: number; rotation: number; rotSpeed: number; vy: number; vx: number; color: string }
interface ImgParticle { nx: number; ny: number; x: number; y: number; vx: number; vy: number; size: number; color: string; tone: 'ink' | 'red' | 'gold'; wa: number; phase: number; jx: number; jy: number }

export default function Particles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let W = canvas.width, H = canvas.height, animId: number, lastFrame = performance.now()
    let paused = false, vg: CanvasGradient | null = null
    const resize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; vg = null }
    resize(); window.addEventListener('resize', resize)

    const dusts: DustParticle[] = [], spirits: SpiritParticle[] = [], petals: PetalParticle[] = []
    let imgPs: ImgParticle[] = [], imgAr = 16 / 9, imgReady = false

    const figOn = () => localStorage.getItem(LS_FIG) !== '0'
    const envOn = () => localStorage.getItem(LS_ENV) !== '0'

    for (let i = 0; i < 60; i++) dusts.push({ type: 'dust', x: rand(-0.1, 1.1) * W, y: rand(0, 1) * H, size: rand(0.4, 1.4), opacity: rand(0.06, 0.16), vx: rand(-0.12, 0.12), vy: rand(-0.2, -0.05), color: Math.random() < 0.6 ? 'silver' : 'gold', life: rand(0, 600) })
    for (let i = 0; i < 16; i++) { const by = rand(0.1, 0.9) * H; spirits.push({ type: 'spirit', x: rand(0.1, 0.9) * W, y: by, baseY: by, size: rand(1.1, 2.8), opacity: rand(0.12, 0.4), phase: rand(0, Math.PI * 2), speed: rand(8, 15), color: Math.random() < 0.5 ? 'gold' : 'moon' }) }
    for (let i = 0; i < 4; i++) petals.push({ type: 'petal', x: rand(0, 1) * W, y: rand(-0.5, 0) * H, size: rand(4, 9), opacity: rand(0.2, 0.4), rotation: rand(0, 360), rotSpeed: rand(-0.3, 0.3), vy: rand(0.15, 0.4), vx: rand(-0.2, 0.2), color: Math.random() < 0.6 ? 'pink' : 'white' })

    const mouse = { x: -9999, y: -9999, attract: false }
    const onMove = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY }
    const onLeave = () => { mouse.x = -9999; mouse.y = -9999 }
    const onClick = () => { mouse.attract = !mouse.attract }
    canvas.style.pointerEvents = 'auto'
    canvas.style.cursor = 'crosshair'
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseleave', onLeave)
    canvas.addEventListener('click', onClick)

    function buildParticles(im: HTMLImageElement) {
      const maxH = H * 0.86
      let w = im.width, h = im.height
      if (h > maxH) { h = maxH; w = Math.round(h * imgAr) }
      const off = document.createElement('canvas')
      off.width = Math.max(2, Math.round(w / 2))
      off.height = Math.max(2, Math.round(h / 2))
      const octx = off.getContext('2d', { willReadFrequently: true })
      if (!octx) return
      octx.drawImage(im, 0, 0, off.width, off.height)
      let data: Uint8ClampedArray | null = null
      try { data = octx.getImageData(0, 0, off.width, off.height).data } catch { data = null }
      if (!data) return
      const Wd = off.width, Hd = off.height

      // 中心裁剪窗（人物居中主体）
      const cx0 = Math.round(Wd * 0.10), cx1 = Math.round(Wd * 0.90)
      const cy0 = Math.round(Hd * 0.03), cy1 = Math.round(Hd * 0.97)
      const cw = cx1 - cx0, chh = cy1 - cy0
      imgAr = cw / chh

      const rawL = new Float32Array(Wd * Hd)
      const lum = new Float32Array(Wd * Hd)
      for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) {
        const i = (y * Wd + x) * 4
        const r = data[i], g = data[i + 1], b = data[i + 2]
        const l = r * 0.299 + g * 0.587 + b * 0.114
        rawL[y * Wd + x] = l
        let lp = (l - 128) * 1.45 + 128
        if (lp < 60) lp *= 0.4
        lum[y * Wd + x] = Math.min(255, Math.max(0, lp))
      }

      // 前景掩码：亮度填充 ∪ 饱和衣物 ∪ 边缘
      const mask = new Uint8Array(Wd * Hd)
      for (let y = cy0; y < cy1; y++) for (let x = cx0; x < cx1; x++) {
        const i = y * Wd + x
        if (lum[i] > 42) { mask[i] = 1; continue }
        const si = i * 4
        const r = data[si], g = data[si + 1], b = data[si + 2]
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
        if (mx - mn > 48 && rawL[i] > 30) mask[i] = 1
      }
      const mag = new Float32Array(Wd * Hd)
      let sum = 0
      for (let y = cy0 + 1; y < cy1 - 1; y++) for (let x = cx0 + 1; x < cx1 - 1; x++) {
        const i = y * Wd + x
        const gx = -lum[i - Wd - 1] - 2 * lum[i - 1] - lum[i + Wd - 1] + lum[i - Wd + 1] + 2 * lum[i + 1] + lum[i + Wd + 1]
        const gy = -lum[i - Wd - 1] - 2 * lum[i - Wd] - lum[i - Wd + 1] + lum[i + Wd - 1] + 2 * lum[i + Wd] + lum[i + Wd + 1]
        const m = Math.sqrt(gx * gx + gy * gy)
        mag[i] = m; sum += m
      }
      const E = (sum / (cw * chh)) * 1.4
      for (let y = cy0; y < cy1; y++) for (let x = cx0; x < cx1; x++) {
        const i = y * Wd + x
        if (mag[i] > E) mask[i] = 1
      }
      // 间隙填补：≥5/8 邻域被掩码则补上（消除衣袍内部空洞）
      const fill = new Uint8Array(Wd * Hd)
      for (let y = cy0 + 1; y < cy1 - 1; y++) for (let x = cx0 + 1; x < cx1 - 1; x++) {
        const i = y * Wd + x
        if (mask[i]) continue
        let n = 0
        n += mask[i - 1] + mask[i + 1] + mask[i - Wd] + mask[i + Wd]
        n += mask[i - Wd - 1] + mask[i - Wd + 1] + mask[i + Wd - 1] + mask[i + Wd + 1]
        if (n >= 5) fill[i] = 1
      }
      const isFg = (x: number, y: number) => mask[y * Wd + x] === 1 || fill[y * Wd + x] === 1

      // 粒子密度按视口面积缩放：1920×1080 为基准，移动端自动降密度
      const areaScale = Math.min(1.2, Math.max(0.12, (W * H) / (1920 * 1080)))
      let step = 1
      for (let t = 0; t < 7; t++) {
        let n = 0
        for (let y = cy0; y < cy1; y += step) for (let x = cx0; x < cx1; x += step) if (isFg(x, y)) n++
        if (n > 6800 * areaScale) step++
        else if (n < 5200 * areaScale && step > 1) step--
        else break
      }
      const ps: ImgParticle[] = []
      for (let y = cy0; y < cy1; y += step) for (let x = cx0; x < cx1; x += step) {
        if (!isFg(x, y)) continue
        const i = y * Wd + x, l = rawL[i]
        const lv = l / 255
        let tone: 'ink' | 'red' | 'gold' = 'ink'
        if (l > 200) {
          const rn = Math.random()
          if (rn < 0.045) tone = 'red'
          else if (rn < 0.06) tone = 'gold'
        }
        let color: string
        if (tone === 'ink') {
          const c = lv > 0.5 ? '42,46,55' : lv > 0.32 ? '58,62,74' : '84,88,98'
          color = `rgba(${c},`
        } else {
          color = tone === 'red' ? 'rgba(218,30,43,' : 'rgba(217,168,69,'
        }
        ps.push({
          nx: (x - cx0) / cw, ny: (y - cy0) / chh,
          x: rand(0, W), y: rand(0, H), vx: rand(-2, 2), vy: rand(-2, 2),
          size: tone === 'ink' ? 1.8 + lv * 1.8 : 2.4 + lv * 1.4,
          color, tone,
          wa: tone === 'ink' ? 0.58 + lv * 0.38 : 0.85,
          phase: rand(0, Math.PI * 2), jx: rand(-0.25, 0.25), jy: rand(-0.25, 0.25),
        })
      }
      imgPs = ps; imgReady = true
    }
    const im = new Image()
    im.onload = () => buildParticles(im)
    im.src = IMG_SRC

    function box() {
      const h = Math.min(H * 0.84, H * 0.92), w = h * imgAr
      return { ox: (W - w) / 2, oy: (H - h) / 2 - H * 0.015, w, h }
    }

    function animate(now: number) {
      if (paused) return
      const dt = Math.min(now - lastFrame, 50) / 16.67; lastFrame = now
      const weather = weatherSys.update(Date.now())
      const figEnabled = figOn(), envEnabled = envOn()

      ctx!.clearRect(0, 0, W, H)

      if (!vg) {
        vg = ctx!.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.78)
        vg.addColorStop(0, 'rgba(42,46,55,0)'); vg.addColorStop(1, 'rgba(42,46,55,0.05)')
      }
      ctx!.fillStyle = vg; ctx!.fillRect(0, 0, W, H)

      if (envEnabled) {
        for (const d of dusts) {
          d.x += d.vx * dt; d.y += d.vy * dt; d.life++
          d.opacity = (0.08 + 0.17 * Math.sin(d.life / 250) * 0.5 + 0.5) * 0.7
          if (d.x < -50) d.x = W + 50; if (d.x > W + 50) d.x = -50
          if (d.y < -50) d.y = H + 50; if (d.y > H + 50) d.y = -50
          if (d.color === 'gold') d.opacity *= weather.goldParticleBoost * 0.7 + 0.3
          ctx!.beginPath(); ctx!.arc(d.x, d.y, d.size, 0, Math.PI * 2)
          ctx!.fillStyle = d.color === 'gold' ? `rgba(217,168,69,${d.opacity})` : `rgba(74,78,90,${d.opacity * 0.6})`
          ctx!.fill()
        }
        for (const s of spirits) {
          s.y = s.baseY + Math.sin(now / 1000 / s.speed + s.phase) * 40
          s.x += Math.cos(now / 1000 / (s.speed * 1.5) + s.phase) * 0.15 * dt
          s.opacity = (0.15 + 0.35 * (Math.sin(now / 1000 / s.speed * Math.PI + s.phase) * 0.5 + 0.5)) * (weather.moonBrightness * 0.6 + 0.4)
          ctx!.beginPath(); ctx!.arc(s.x, s.y, s.size, 0, Math.PI * 2)
          ctx!.fillStyle = s.color === 'gold' ? `rgba(217,168,69,${s.opacity})` : `rgba(91,140,158,${s.opacity * 0.7})`
          ctx!.fill()
          if (s.size > 1.8) { ctx!.beginPath(); ctx!.arc(s.x, s.y, s.size * 3, 0, Math.PI * 2); ctx!.fillStyle = s.color === 'gold' ? `rgba(217,168,69,${s.opacity * 0.08})` : `rgba(91,140,158,${s.opacity * 0.06})`; ctx!.fill() }
        }
        for (const p of petals) {
          p.y += p.vy * dt; p.x += p.vx * dt + Math.sin(now / 8000 + p.x / 100) * 0.2 * dt; p.rotation += p.rotSpeed * dt
          if (p.y > H + 30) { p.y = -30; p.x = rand(0, W) }
          ctx!.save(); ctx!.translate(p.x, p.y); ctx!.rotate(p.rotation * Math.PI / 180)
          ctx!.fillStyle = p.color === 'pink' ? `rgba(185,139,158,${p.opacity})` : `rgba(217,168,69,${p.opacity * 0.8})`
          ctx!.beginPath(); ctx!.ellipse(0, 0, p.size * 0.6, p.size * 0.25, 0, 0, Math.PI * 2); ctx!.fill(); ctx!.restore()
        }

        // 天气粒子已移交 WeatherFX 独立层（雨/雪/雾真实渲染），此处保留环境粒子
      }

      if (figEnabled && imgReady && imgPs.length) {
        const b = box(), cx = b.ox + b.w / 2, cy = b.oy + b.h / 2
        const breath = 1 + 0.008 * Math.sin(now / 4200)
        const figAlpha = 0.86 * (weather.moonBrightness * 0.5 + 0.5)
        const mx = mouse.x, my = mouse.y
        for (const p of imgPs) {
          const tx = cx + (p.nx * b.w - b.w / 2) * breath + p.jx + Math.sin(now / 2800 + p.phase) * 0.8
          const ty = cy + (p.ny * b.h - b.h / 2) * breath + p.jy + Math.cos(now / 3200 + p.phase) * 0.8
          const dx = tx - p.x, dy = ty - p.y
          p.vx += dx * 0.16 * dt; p.vy += dy * 0.16 * dt
          if (mx > -9000) {
            const dxm = p.x - mx, dym = p.y - my
            const dist = Math.sqrt(dxm * dxm + dym * dym) || 0.0001
            if (dist < 140) {
              const force = (1 - dist / 140) * 1.15 * (mouse.attract ? -1 : 1)
              p.vx += (dxm / dist) * force * 5 * dt; p.vy += (dym / dist) * force * 5 * dt
            }
          }
          p.vx *= Math.pow(0.90, dt); p.vy *= Math.pow(0.90, dt)
          p.x += p.vx * dt; p.y += p.vy * dt
          const a = figAlpha * p.wa * (0.72 + 0.28 * Math.sin(now / 1800 + p.phase))
          ctx!.beginPath(); ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx!.fillStyle = p.color + `${a})`
          ctx!.fill()
          if (p.tone !== 'ink' && a > 0.25) {
            ctx!.beginPath(); ctx!.arc(p.x, p.y, p.size * 2.8, 0, Math.PI * 2)
            ctx!.fillStyle = p.color + `${a * 0.18})`
            ctx!.fill()
          }
        }
      }

      animId = requestAnimationFrame(animate)
    }
    animId = requestAnimationFrame(animate)

    const onVis = () => {
      paused = document.hidden
      if (!paused) {
        lastFrame = performance.now()
        animId = requestAnimationFrame(animate)
      }
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      cancelAnimationFrame(animId)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseleave', onLeave)
      canvas.removeEventListener('click', onClick)
    }
  }, [])

  return <canvas ref={canvasRef} aria-hidden="true" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'auto', zIndex: 4 }} />
}
