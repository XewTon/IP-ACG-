/*
 * 玄策 · 雨线层：真实雨幕（风倾角、远近两层）+ 落地溅点 + 雷暴闪电
 * Canvas 2D 前景层，与 RainScene（镜头水滴）叠加成完整雨景。
 */
interface Streak {
  x: number
  y: number
  len: number
  speed: number
  opacity: number
  layer: 0 | 1 // 0 远（细浅） 1 近（粗亮）
}
interface Splash {
  x: number
  y: number
  r: number
  life: number
}
interface Bolt {
  x: number
  y: number
  segs: { x: number; y: number }[]
  life: number
}

export class RainStreaks {
  private ctx: CanvasRenderingContext2D
  private streaks: Streak[] = []
  private splashes: Splash[] = []
  private bolts: Bolt[] = []
  private flash = 0
  private nextBolt = 2 + Math.random() * 5
  private intensity = 1
  private wind = 0
  private running = false
  private disposed = false
  private last = 0
  private spawnAcc = 0
  private W = 0
  private H = 0

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('rain streak ctx')
    this.ctx = ctx
    this.W = canvas.width
    this.H = canvas.height
  }

  setParams(intensity: number, wind: number) {
    this.intensity = Math.min(1, Math.max(0.15, intensity))
    this.wind = wind
  }

  resize() {
    this.W = this.canvas.width
    this.H = this.canvas.height
  }

  start() {
    if (this.running || this.disposed) return
    this.running = true
    this.last = performance.now()
    requestAnimationFrame(this.frame)
  }

  stop() {
    this.running = false
  }

  dispose() {
    this.disposed = true
    this.stop()
  }

  private spawn(dt: number) {
    const rate = 260 + this.intensity * 450
    this.spawnAcc += rate * dt
    while (this.spawnAcc > 1) {
      this.spawnAcc -= 1
      const layer: 0 | 1 = Math.random() < 0.65 ? 0 : 1
      this.streaks.push({
        x: Math.random() * (this.W + 200) - 100,
        y: -40,
        len: layer === 0 ? 9 + Math.random() * 10 : 16 + Math.random() * 14,
        speed: (layer === 0 ? 6 : 9) * (0.7 + this.intensity * 0.6),
        opacity: layer === 0 ? 0.14 + Math.random() * 0.12 : 0.22 + Math.random() * 0.18,
        layer,
      })
    }
    // 雨线位移（风倾角）
    const windPx = this.wind * 2.2
    for (let i = this.streaks.length - 1; i >= 0; i--) {
      const s = this.streaks[i]
      s.y += s.speed * dt * 60
      s.x += (windPx + (s.layer === 1 ? windPx * 0.6 : 0)) * dt
      if (s.y > this.H + 60) {
        // 落地溅点（近层才有）
        if (s.layer === 1 && Math.random() < 0.5 && this.splashes.length < 90) {
          this.splashes.push({ x: s.x, y: this.H - 4, r: 2 + Math.random() * 3, life: 1 })
        }
        this.streaks.splice(i, 1)
      }
    }
    if (this.streaks.length > 900) this.streaks.splice(0, this.streaks.length - 900)
    for (let i = this.splashes.length - 1; i >= 0; i--) {
      const p = this.splashes[i]
      p.life -= dt * 2.2
      if (p.life <= 0) this.splashes.splice(i, 1)
    }
  }

  private makeBolt(): Bolt {
    let x = Math.random() * this.W
    let y = 0
    const segs: { x: number; y: number }[] = [{ x, y }]
    const n = 7 + Math.floor(Math.random() * 6)
    for (let i = 0; i < n; i++) {
      y += this.H / n + (Math.random() - 0.5) * this.H * 0.12
      x += (Math.random() - 0.5) * 90
      segs.push({ x, y })
    }
    return { x: 0, y: 0, segs, life: 1 }
  }

  private frame = (now: number) => {
    if (!this.running || this.disposed) return
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    const c = this.ctx
    c.clearRect(0, 0, this.W, this.H)

    this.spawn(dt)

    // 雨线
    const windPx = this.wind * 2.2
    c.lineCap = 'round'
    for (const s of this.streaks) {
      const angle = Math.atan2(s.speed, windPx) // 与风向的倾角
      const dx = Math.cos(angle) * s.len
      const dy = Math.sin(angle) * s.len
      c.beginPath()
      c.moveTo(s.x, s.y)
      c.lineTo(s.x + dx, s.y + dy)
      c.strokeStyle = `rgba(150,176,192,${s.opacity})`
      c.lineWidth = s.layer === 0 ? 0.7 : 1.2
      c.stroke()
    }
    // 溅点
    for (const p of this.splashes) {
      c.beginPath()
      c.arc(p.x, p.y, p.r * (1.6 - p.life * 0.6), 0, Math.PI * 2)
      c.strokeStyle = `rgba(150,176,192,${p.life * 0.3})`
      c.lineWidth = 0.6
      c.stroke()
    }
    // 闪电
    this.flash = Math.max(0, this.flash - dt * 2.4)
    if (this.intensity > 0.55) {
      this.nextBolt -= dt
      if (this.nextBolt <= 0 && this.bolts.length === 0) {
        this.bolts.push(this.makeBolt())
        this.flash = 0.85
        this.nextBolt = 2 + Math.random() * 4
      }
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]
      b.life -= dt * 3.2
      if (b.life <= 0) {
        this.bolts.splice(i, 1)
        continue
      }
      c.beginPath()
      c.moveTo(b.segs[0].x, b.segs[0].y)
      for (const s of b.segs) c.lineTo(s.x, s.y)
      c.strokeStyle = `rgba(220,236,255,${b.life * 0.95})`
      c.lineWidth = 2.2
      c.stroke()
      c.lineWidth = 0.8
      c.strokeStyle = `rgba(255,255,255,${b.life * 0.8})`
      c.stroke()
    }
    if (this.flash > 0) {
      c.fillStyle = `rgba(210,228,248,${this.flash * 0.14})`
      c.fillRect(0, 0, this.W, this.H)
    }

    requestAnimationFrame(this.frame)
  }
}
