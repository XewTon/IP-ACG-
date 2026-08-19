/*
 * 玄策 · 雨滴效果 —— 自包含 TypeScript 移植（原项目：https://github.com/codrops/RainEffect）
 * 原版依赖 gsap / core-js / glslify 与外部图片素材；本文件裁剪为纯 TS + WebGL：
 *   - 雨滴精灵（dropColor / dropAlpha）改为程序化生成（Canvas 2D 像素循环）
 *   - 折射源 u_textureFg 由调用方提供（如"全息立绘"canvas）
 *   - 背景层 u_textureBg 默认透明 2×2 → 雨滴以"玻璃上的水珠"叠加在现有场景之上
 * 渲染管线忠实复刻原版：CPU 模拟雨滴（位置/动量/碰撞/拖尾）→ 编码折射向量到水纹纹理
 * → 全屏 shader 按折射量采样前景贴图。
 */

export interface RainEffectOptions {
  minR?: number
  maxR?: number
  rainChance?: number
  rainLimit?: number
  dropletsRate?: number
  dropletsSize?: [number, number]
  trailRate?: number
  trailScaleRange?: [number, number]
  brightness?: number
  alphaMultiply?: number
  alphaSubtract?: number
  minRefraction?: number
  maxRefraction?: number
  /** 画布分辨率缩放（<1 时模拟面积与纹理上传开销同比例下降） */
  resolutionScale?: number
  /** 背景层贴图（默认透明 2×2）：传入立绘等，则雨幕下完整显示该图并对其折射 */
  background?: TexImageSource
  /** 背景层宽高比（用于 cover 填充计算），默认取 background 实际宽高比 */
  textureRatio?: number
}

const DROP_SIZE = 64

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  return c
}

function random(from: number, to?: number, map?: (n: number) => number): number {
  if (to === undefined) {
    to = from
    from = 0
  }
  const delta = to - from
  const interp = map ?? ((n: number) => n)
  return from + interp(Math.random()) * delta
}

function chance(p: number): boolean {
  return Math.random() <= p
}

function times(n: number, fn: () => void): void {
  for (let i = 0; i < Math.floor(n); i++) fn()
}

/* ---------------- 雨滴精灵：程序化生成 ---------------- */
interface DropSprites {
  dropColor: HTMLCanvasElement // r/g 编码折射方向，b 编码厚度，a 编码形状
  dropAlpha: HTMLCanvasElement // 水滴 alpha 遮罩
}

function buildDropSprites(): DropSprites {
  const size = DROP_SIZE
  const c = makeCanvas(size, size)
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(size, size)
  const px = img.data
  const cx = size / 2
  const cy = size / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const dx = (x + 0.5 - cx) / cx // [-1,1]
      const dy = (y + 0.5 - cy) / cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      // 软圆遮罩：中心 1 → 边缘 0
      const mask = Math.max(0, Math.min(1, 1.35 - dist * 1.15))
      if (mask <= 0.001) {
        px[i] = px[i + 1] = px[i + 2] = px[i + 3] = 0
        continue
      }
      // 折射向量：自中心向外，强度随距离增大（透镜边缘折射最强）
      const dirX = dist > 1e-4 ? dx / dist : 0
      const dirY = dist > 1e-4 ? dy / dist : 0
      const strength = Math.pow(dist, 1.6) * 0.42
      // 通道：R=y 偏移、G=x 偏移（shader 内 x=cur.g, y=cur.r）、B=厚度、A=alpha
      px[i] = Math.round((0.5 + dirY * strength) * 255)
      px[i + 1] = Math.round((0.5 + dirX * strength) * 255)
      px[i + 2] = Math.round((0.25 + 0.75 * (1 - dist)) * 255) // 中心厚、边缘薄
      px[i + 3] = Math.round(255 * mask)
    }
  }
  ctx.putImageData(img, 0, 0)

  // alpha 遮罩：柔和水滴轮廓
  const a = makeCanvas(size, size)
  const actx = a.getContext('2d')!
  const grad = actx.createRadialGradient(cx, cy, 1, cx, cy, cx * 0.98)
  grad.addColorStop(0, 'rgba(255,255,255,0.95)')
  grad.addColorStop(0.72, 'rgba(255,255,255,0.8)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  actx.fillStyle = grad
  actx.beginPath()
  actx.arc(cx, cy, cx * 0.98, 0, Math.PI * 2)
  actx.fill()

  return { dropColor: c, dropAlpha: a }
}

/* ---------------- CPU 雨滴模拟（移植 raindrops.js） ---------------- */
interface Drop {
  x: number
  y: number
  r: number
  spreadX: number
  spreadY: number
  momentum: number
  momentumX: number
  lastSpawn: number
  nextSpawn: number
  parent: Drop | null
  isNew: boolean
  killed: boolean
  shrink: number
}

interface RainSimOptions {
  minR: number
  maxR: number
  maxDrops: number
  rainChance: number
  rainLimit: number
  dropletsRate: number
  dropletsSize: [number, number]
  dropletsCleaningRadiusMultiplier: number
  raining: boolean
  trailRate: number
  trailScaleRange: [number, number]
  collisionRadius: number
  collisionRadiusIncrease: number
  dropFallMultiplier: number
  collisionBoostMultiplier: number
  collisionBoost: number
}

class RainSim {
  readonly canvas: HTMLCanvasElement
  readonly ctx: CanvasRenderingContext2D
  readonly scale: number
  options: RainSimOptions
  private baseRainChance: number
  private baseDropletsRate: number
  private baseTrailRate: number
  private droplets: HTMLCanvasElement
  private dropletsCtx: CanvasRenderingContext2D
  private drops: Drop[] = []
  private dropsGfx: HTMLCanvasElement[] = []
  private clearDropletsGfx: HTMLCanvasElement
  private dropletsCounter = 0
  private textureCleaningIterations = 0

  constructor(width: number, height: number, scale: number, sprites: DropSprites, options: Partial<RainSimOptions> = {}) {
    this.scale = scale
    this.options = {
      minR: 10, maxR: 40, maxDrops: 900, rainChance: 0.18, rainLimit: 2,
      dropletsRate: 16, dropletsSize: [3, 5], dropletsCleaningRadiusMultiplier: 0.43,
      raining: true, trailRate: 0.9, trailScaleRange: [0.2, 0.5],
      collisionRadius: 0.65, collisionRadiusIncrease: 0.01,
      dropFallMultiplier: 1, collisionBoostMultiplier: 0.05, collisionBoost: 1,
      ...options,
    }
    this.baseRainChance = this.options.rainChance
    this.baseDropletsRate = this.options.dropletsRate
    this.baseTrailRate = this.options.trailRate
    this.canvas = makeCanvas(width, height)
    this.ctx = this.canvas.getContext('2d')!
    this.droplets = makeCanvas(width, height)
    this.dropletsCtx = this.droplets.getContext('2d')!
    this.renderDropsGfx(sprites)
    this.clearDropletsGfx = this.buildClearBrush()
  }

  private get areaMultiplier(): number {
    return Math.sqrt((this.canvas.width * this.canvas.height) / this.scale / (1024 * 768))
  }

  private get deltaR(): number {
    return this.options.maxR - this.options.minR
  }

  private renderDropsGfx(sprites: DropSprites): void {
    const size = DROP_SIZE
    const buffer = makeCanvas(size, size)
    const bctx = buffer.getContext('2d')!
    this.dropsGfx = Array.from({ length: 255 }, (_, i) => {
      const drop = makeCanvas(size, size)
      const dctx = drop.getContext('2d')!
      bctx.clearRect(0, 0, size, size)
      bctx.globalCompositeOperation = 'source-over'
      bctx.drawImage(sprites.dropColor, 0, 0, size, size)
      // 蓝色叠加编码厚度/深度
      bctx.globalCompositeOperation = 'screen'
      bctx.fillStyle = `rgba(0,0,${i},1)`
      bctx.fillRect(0, 0, size, size)
      dctx.globalCompositeOperation = 'source-over'
      dctx.drawImage(sprites.dropAlpha, 0, 0, size, size)
      dctx.globalCompositeOperation = 'source-in'
      dctx.drawImage(buffer, 0, 0, size, size)
      return drop
    })
  }

  private buildClearBrush(): HTMLCanvasElement {
    const c = makeCanvas(128, 128)
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.arc(64, 64, 64, 0, Math.PI * 2)
    ctx.fill()
    return c
  }

  private drawDrop(ctx: CanvasRenderingContext2D, drop: Drop): void {
    const gfx = this.dropsGfx
    if (gfx.length === 0) return
    const scaleX = 1
    const scaleY = 1.5
    let d = Math.max(0, Math.min(1, (drop.r - this.options.minR) / this.deltaR) * 0.9)
    d *= 1 / ((drop.spreadX + drop.spreadY) * 0.5 + 1)
    d = Math.floor(d * (gfx.length - 1))
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(
      gfx[d],
      (drop.x - drop.r * scaleX * (drop.spreadX + 1)) * this.scale,
      (drop.y - drop.r * scaleY * (drop.spreadY + 1)) * this.scale,
      drop.r * 2 * scaleX * (drop.spreadX + 1) * this.scale,
      drop.r * 2 * scaleY * (drop.spreadY + 1) * this.scale,
    )
  }

  private clearDroplets(x: number, y: number, r: number): void {
    const ctx = this.dropletsCtx
    ctx.globalCompositeOperation = 'destination-out'
    ctx.drawImage(
      this.clearDropletsGfx,
      (x - r) * this.scale,
      (y - r) * this.scale,
      r * 2 * this.scale,
      r * 2 * this.scale * 1.5,
    )
  }

  private spawnRain(timeScale: number): Drop[] {
    const spawned: Drop[] = []
    if (!this.options.raining) return spawned
    const limit = this.options.rainLimit * timeScale * this.areaMultiplier
    let count = 0
    while (chance(this.options.rainChance * timeScale * this.areaMultiplier) && count < limit) {
      count++
      const r = random(this.options.minR, this.options.maxR, (n) => Math.pow(n, 3))
      if (this.drops.length >= this.options.maxDrops * this.areaMultiplier) break
      spawned.push({
        x: random(this.canvas.width / this.scale),
        y: random((this.canvas.height / this.scale) * -0.1, (this.canvas.height / this.scale) * 0.95),
        r,
        momentum: 1 + (r - this.options.minR) * 0.1 + random(0, 2),
        spreadX: 1.5,
        spreadY: 1.5,
        momentumX: 0,
        lastSpawn: 0,
        nextSpawn: 0,
        parent: null,
        isNew: true,
        killed: false,
        shrink: 0,
      })
    }
    return spawned
  }

  private updateDroplets(timeScale: number): void {
    /* 小水珠持续淡出：防止随机溅落水珠无限堆积导致画面过密（密集恐惧元凶） */
    this.dropletsCtx.globalCompositeOperation = 'destination-out'
    this.dropletsCtx.fillStyle = `rgba(0,0,0,${0.045 * timeScale})`
    this.dropletsCtx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    if (this.textureCleaningIterations > 0) {
      this.textureCleaningIterations -= 1 * timeScale
      this.dropletsCtx.fillStyle = `rgba(0,0,0,${0.05 * timeScale})`
      this.dropletsCtx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    }
    if (this.options.raining) {
      this.dropletsCounter += this.options.dropletsRate * timeScale * this.areaMultiplier
      times(this.dropletsCounter, () => {
        this.dropletsCounter--
        const [min, max] = this.options.dropletsSize
        const r = random(min, max, (n) => n * n)
        const x = random(this.canvas.width / this.scale)
        const y = random(this.canvas.height / this.scale)
        this.dropletsCtx.globalCompositeOperation = 'source-over'
        this.dropletsCtx.globalAlpha = 1
        this.drawDrop(this.dropletsCtx, {
          x, y, r, spreadX: 1, spreadY: 1, momentum: 0, momentumX: 0,
          lastSpawn: 0, nextSpawn: 0, parent: null, isNew: true, killed: false, shrink: 0,
        })
      })
    }
    this.ctx.drawImage(this.droplets, 0, 0, this.canvas.width, this.canvas.height)
  }

  /** 单步推进（由外层 RAF 驱动，timeScale = 1 表示 60fps 一帧） */
  step(timeScale: number): void {
    const o = this.options
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.updateDroplets(timeScale)
    const newDrops = this.spawnRain(timeScale)

    this.drops.sort((a, b) => {
      const va = a.y * (this.canvas.width / this.scale) + a.x
      const vb = b.y * (this.canvas.width / this.scale) + b.x
      return va > vb ? 1 : va === vb ? 0 : -1
    })

    for (let i = 0; i < this.drops.length; i++) {
      const drop = this.drops[i]
      if (drop.killed) continue

      if (chance((drop.r - o.minR * o.dropFallMultiplier) * (0.1 / this.deltaR) * timeScale)) {
        drop.momentum += random(0, (drop.r / o.maxR) * 4)
      }
      if (drop.r <= o.minR && chance(0.05 * timeScale)) drop.shrink += 0.01
      drop.r -= drop.shrink * timeScale
      if (drop.r <= 0) { drop.killed = true; continue }

      if (o.raining) {
        drop.lastSpawn += drop.momentum * timeScale * o.trailRate
        if (drop.lastSpawn > drop.nextSpawn && this.drops.length < o.maxDrops * this.areaMultiplier) {
          newDrops.push({
            x: drop.x + random(-drop.r, drop.r) * 0.1,
            y: drop.y - drop.r * 0.01,
            r: drop.r * random(o.trailScaleRange[0], o.trailScaleRange[1]),
            spreadY: drop.momentum * 0.1,
            spreadX: 1,
            momentum: 0,
            momentumX: 0,
            lastSpawn: 0,
            nextSpawn: 0,
            parent: drop,
            isNew: true,
            killed: false,
            shrink: 0,
          })
          drop.r *= Math.pow(0.97, timeScale)
          drop.lastSpawn = 0
          drop.nextSpawn = random(o.minR, o.maxR) - drop.momentum * 2 * o.trailRate + (o.maxR - drop.r)
        }
      }

      drop.spreadX *= Math.pow(0.4, timeScale)
      drop.spreadY *= Math.pow(0.7, timeScale)

      const moved = drop.momentum > 0
      if (moved) {
        drop.y += drop.momentum
        drop.x += drop.momentumX
        if (drop.y > this.canvas.height / this.scale + drop.r) drop.killed = true
      }

      const checkCollision = (moved || drop.isNew) && !drop.killed
      drop.isNew = false
      if (checkCollision) {
        for (let j = i + 1; j < Math.min(i + 70, this.drops.length); j++) {
          const drop2 = this.drops[j]
          if (drop === drop2 || drop.r <= drop2.r || drop.parent === drop2 || drop2.parent === drop || drop2.killed) continue
          const dx = drop2.x - drop.x
          const dy = drop2.y - drop.y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < (drop.r + drop2.r) * (o.collisionRadius + drop.momentum * o.collisionRadiusIncrease * timeScale)) {
            const pi = Math.PI
            const r1 = drop.r
            const r2 = drop2.r
            const a1 = pi * r1 * r1
            const a2 = pi * r2 * r2
            let targetR = Math.sqrt((a1 + a2 * 0.8) / pi)
            if (targetR > o.maxR) targetR = o.maxR
            drop.r = targetR
            drop.momentumX += dx * 0.1
            drop.spreadX = 0
            drop.spreadY = 0
            drop2.killed = true
            drop.momentum = Math.max(drop2.momentum, Math.min(40, drop.momentum + targetR * o.collisionBoostMultiplier + o.collisionBoost))
          }
        }
      }

      drop.momentum -= Math.max(1, o.minR * 0.5 - drop.momentum) * 0.1 * timeScale
      if (drop.momentum < 0) drop.momentum = 0
      drop.momentumX *= Math.pow(0.7, timeScale)

      if (!drop.killed) {
        newDrops.push(drop)
        if (moved && o.dropletsRate > 0) this.clearDroplets(drop.x, drop.y, drop.r * o.dropletsCleaningRadiusMultiplier)
        this.drawDrop(this.ctx, drop)
      }
    }

    this.drops = newDrops
  }

  /** 雨量强度（0~1）：按基准值缩放降雨概率 / 液滴速率 / 拖尾（不叠加） */
  setIntensity(v: number): void {
    const k = Math.max(0, Math.min(1, v))
    this.options.raining = k > 0.02
    this.options.rainChance = this.baseRainChance * k
    this.options.dropletsRate = this.baseDropletsRate * k
    this.options.trailRate = this.baseTrailRate * k
  }
}

/* ---------------- WebGL 渲染器（移植 rain-renderer.js + shader_water.frag） ---------------- */
const waterVert = /* glsl */ `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    v_texCoord = a_texCoord;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

const waterFrag = /* glsl */ `
  precision mediump float;
  uniform sampler2D u_waterMap;
  uniform sampler2D u_textureShine;
  uniform sampler2D u_textureFg;
  uniform sampler2D u_textureBg;
  varying vec2 v_texCoord;
  uniform vec2 u_resolution;
  uniform vec2 u_parallax;
  uniform float u_parallaxFg;
  uniform float u_parallaxBg;
  uniform float u_textureRatio;
  uniform bool u_renderShine;
  uniform bool u_renderShadow;
  uniform float u_minRefraction;
  uniform float u_refractionDelta;
  uniform float u_brightness;
  uniform float u_alphaMultiply;
  uniform float u_alphaSubtract;

  vec4 blend(vec4 bg, vec4 fg) {
    vec3 bgm = bg.rgb * bg.a;
    vec3 fgm = fg.rgb * fg.a;
    float ia = 1.0 - fg.a;
    float a = fg.a + bg.a * ia;
    vec3 rgb;
    if (a != 0.0) rgb = (fgm + bgm * ia) / a;
    else rgb = vec3(0.0);
    return vec4(rgb, a);
  }
  vec2 pixel() { return vec2(1.0) / u_resolution; }
  vec2 parallax(float v) { return u_parallax * pixel() * v; }
  vec2 texCoord() { return vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y) / u_resolution; }
  vec2 scaledTexCoord() {
    float ratio = u_resolution.x / u_resolution.y;
    vec2 scale = vec2(1.0);
    vec2 offset = vec2(0.0);
    float ratioDelta = ratio - u_textureRatio;
    if (ratioDelta >= 0.0) { scale.y = 1.0 + ratioDelta; offset.y = ratioDelta / 2.0; }
    else { scale.x = 1.0 - ratioDelta; offset.x = -ratioDelta / 2.0; }
    return (texCoord() + offset) / scale;
  }
  vec4 fgColor(float x, float y) {
    float p2 = u_parallaxFg * 2.0;
    vec2 scale = vec2((u_resolution.x + p2) / u_resolution.x, (u_resolution.y + p2) / u_resolution.y);
    vec2 scaledTexCoord = texCoord() / scale;
    vec2 offset = vec2((1.0 - (1.0 / scale.x)) / 2.0, (1.0 - (1.0 / scale.y)) / 2.0);
    return texture2D(u_waterMap, (scaledTexCoord + offset) + (pixel() * vec2(x, y)) + parallax(u_parallaxFg));
  }
  void main() {
    vec4 bg = texture2D(u_textureBg, scaledTexCoord() + parallax(u_parallaxBg));
    vec4 cur = fgColor(0.0, 0.0);
    float d = cur.b;
    float x = cur.g;
    float y = cur.r;
    float a = clamp(cur.a * u_alphaMultiply - u_alphaSubtract, 0.0, 1.0);
    vec2 refraction = (vec2(x, y) - 0.5) * 2.0;
    vec2 refractionParallax = parallax(u_parallaxBg - u_parallaxFg);
    vec2 refractionPos = scaledTexCoord() + (pixel() * refraction * (u_minRefraction + d * u_refractionDelta)) + refractionParallax;
    vec4 tex = texture2D(u_textureFg, refractionPos);
    if (u_renderShine) {
      float maxShine = 490.0;
      float minShine = maxShine * 0.18;
      vec2 shinePos = vec2(0.5) + ((1.0 / 512.0) * refraction) * -(minShine + (maxShine - minShine) * d);
      vec4 shine = texture2D(u_textureShine, shinePos);
      tex = blend(tex, shine);
    }
    vec4 fg = vec4(tex.rgb * u_brightness, a);
    if (u_renderShadow) {
      float borderAlpha = fgColor(0.0, -(d * 6.0)).a;
      borderAlpha = borderAlpha * u_alphaMultiply - (u_alphaSubtract + 0.5);
      borderAlpha = clamp(borderAlpha, 0.0, 1.0) * 0.2;
      vec4 border = vec4(0.0, 0.0, 0.0, borderAlpha);
      fg = blend(border, fg);
    }
    gl_FragColor = blend(bg, fg);
  }
`

function createGLProgram(gl: WebGLRenderingContext, vertSrc: string, fragSrc: string): WebGLProgram {
  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type)!
    gl.shaderSource(sh, src)
    gl.compileShader(sh)
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error('[rainEffect] shader error:', gl.getShaderInfoLog(sh))
      gl.deleteShader(sh)
      return null
    }
    return sh
  }
  const vs = compile(gl.VERTEX_SHADER, vertSrc)!
  const fs = compile(gl.FRAGMENT_SHADER, fragSrc)!
  const prog = gl.createProgram()!
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('[rainEffect] program link error:', gl.getProgramInfoLog(prog))
    gl.deleteProgram(prog)
    return null!
  }
  return prog
}

class RainRenderer {
  readonly canvas: HTMLCanvasElement
  private gl: WebGLRenderingContext
  private program: WebGLProgram
  private sim: RainSim
  private waterMap: WebGLTexture // 单位 0：雨滴位置纹理（每帧更新）
  private textureFg: WebGLTexture // 单位 1：折射源
  private textureBg: WebGLTexture // 单位 2：透明背景层
  private uniforms: Record<string, WebGLUniformLocation | null> = {}
  parallaxX = 0
  parallaxY = 0
  private raf = 0
  private lastRender: number | null = null
  private disposed = false

  constructor(canvas: HTMLCanvasElement, sim: RainSim, textureFgSource: TexImageSource, options: RainEffectOptions = {}) {
    this.canvas = canvas
    this.sim = sim
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false }) ||
      (canvas.getContext('experimental-webgl', { alpha: true, premultipliedAlpha: false }) as WebGLRenderingContext | null)
    if (!gl) throw new Error('webgl unavailable')
    this.gl = gl

    gl.viewport(0, 0, canvas.width, canvas.height)
    this.program = createGLProgram(gl, waterVert, waterFrag)
    gl.useProgram(this.program)

    const setUniform = (name: string, ...args: unknown[]) => {
      const loc = gl.getUniformLocation(this.program, 'u_' + name)
      this.uniforms[name] = loc
      if (args.length) this.applyUniform(name, args)
    }

    // 全屏四边形（position 与 texCoord 共用同一缓冲，复刻原版）
    const quad = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, quad)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
    ]), gl.STATIC_DRAW)
    const posLoc = gl.getAttribLocation(this.program, 'a_position')
    const tcLoc = gl.getAttribLocation(this.program, 'a_texCoord')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)
    gl.enableVertexAttribArray(tcLoc)
    gl.vertexAttribPointer(tcLoc, 2, gl.FLOAT, false, 0, 0)

    // 单位 0：水纹纹理（雨滴模拟画布，每帧上传）
    this.waterMap = gl.createTexture()!
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.waterMap)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sim.canvas)
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_waterMap'), 0)

    const transparent = makeCanvas(2, 2)
    const bgSource = options.background ?? transparent
    this.textureFg = this.createTexture(textureFgSource, 1, 'u_textureFg')
    this.textureBg = this.createTexture(bgSource, 2, 'u_textureBg')

    setUniform('resolution', canvas.width, canvas.height)
    setUniform('textureRatio', options.textureRatio ?? (bgSource && (bgSource as { width?: number }).width ? (bgSource as HTMLCanvasElement).width / (bgSource as HTMLCanvasElement).height : 1))
    setUniform('renderShine', false)
    setUniform('renderShadow', false)
    setUniform('minRefraction', options.minRefraction ?? 140)
    setUniform('refractionDelta', (options.maxRefraction ?? 420) - (options.minRefraction ?? 140))
    setUniform('brightness', options.brightness ?? 1.8)
    setUniform('alphaMultiply', options.alphaMultiply ?? 9)
    setUniform('alphaSubtract', options.alphaSubtract ?? 4)
    setUniform('parallaxBg', 5)
    setUniform('parallaxFg', 20)
    setUniform('parallax', 0, 0)
  }

  private applyUniform(name: string, args: unknown[]): void {
    const gl = this.gl
    const loc = this.uniforms[name]
    if (!loc) return
    if (name === 'resolution' || name === 'parallax') gl.uniform2f(loc, args[0] as number, args[1] as number)
    else if (name === 'textureRatio') gl.uniform1f(loc, args[0] as number)
    else if (name === 'renderShine' || name === 'renderShadow') gl.uniform1i(loc, args[0] as number)
    else if (name === 'minRefraction' || name === 'refractionDelta' || name === 'brightness' ||
             name === 'alphaMultiply' || name === 'alphaSubtract' || name === 'parallaxBg' || name === 'parallaxFg') {
      gl.uniform1f(loc, args[0] as number)
    }
  }

  private createTexture(source: TexImageSource, unit: number, uniformName: string): WebGLTexture {
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE0 + unit)
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    gl.uniform1i(gl.getUniformLocation(this.program, uniformName), unit)
    return tex
  }

  start(): void {
    this.raf = requestAnimationFrame(this.loop)
  }

  private loop = (): void => {
    if (this.disposed) return
    const now = Date.now()
    if (this.lastRender == null) this.lastRender = now
    let timeScale = (now - this.lastRender) / ((1 / 60) * 1000)
    if (timeScale > 1.1) timeScale = 1.1
    this.lastRender = now

    this.sim.step(timeScale)

    const gl = this.gl
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.uniform2f(this.uniforms['parallax'], this.parallaxX, this.parallaxY)

    // 水纹纹理每帧上传（雨滴位置/折射向量）
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.waterMap)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.sim.canvas)

    gl.drawArrays(gl.TRIANGLES, 0, 6)
    this.raf = requestAnimationFrame(this.loop)
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    const gl = this.gl
    gl.deleteTexture(this.waterMap)
    gl.deleteTexture(this.textureFg)
    gl.deleteTexture(this.textureBg)
    gl.deleteProgram(this.program)
  }
}

/* ---------------- 对外 API ---------------- */
export interface RainEffect {
  /** 雨量强度 0~1（同时控制降雨参数与画布透明度） */
  setIntensity(v: number): void
  /** 鼠标视差目标（-1~1） */
  setParallax(x: number, y: number): void
  resize(): void
  dispose(): void
}

/**
 * 创建雨滴效果（叠加层）。
 * @param canvas 目标画布（全屏、绝对定位、pointer-events:none）
 * @param fgSource 折射源（全息立绘 canvas / 图片）
 */
export function createRainEffect(canvas: HTMLCanvasElement, fgSource: TexImageSource, options?: RainEffectOptions): RainEffect | null {
  try {
    const resScale = Math.max(0.4, Math.min(1, options?.resolutionScale ?? 1))
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * resScale
    canvas.width = Math.floor(window.innerWidth * dpr)
    canvas.height = Math.floor(window.innerHeight * dpr)
    const sprites = buildDropSprites()
    const sim = new RainSim(canvas.width, canvas.height, dpr, sprites, {
      minR: 14, maxR: 46, rainChance: 0.3, rainLimit: 4,
      dropletsRate: 50, dropletsSize: [3, 5.5], trailRate: 1.4,
      trailScaleRange: [0.2, 0.4],
    })
    sim.setIntensity(0.4)
    const renderer = new RainRenderer(canvas, sim, fgSource, options)
    renderer.start()

    let disposed = false
    const onPointer = (e: PointerEvent) => {
      if (disposed) return
      renderer.parallaxX = (e.clientX / window.innerWidth) * 2 - 1
      renderer.parallaxY = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', onPointer)

    return {
      setIntensity(v: number) {
        sim.setIntensity(v)
        canvas.style.opacity = String(Math.max(0, Math.min(1, v * 1.15)))
      },
      setParallax(x: number, y: number) {
        renderer.parallaxX = x
        renderer.parallaxY = y
      },
      resize() {
        const w = Math.floor(window.innerWidth * dpr)
        const h = Math.floor(window.innerHeight * dpr)
        canvas.width = w
        canvas.height = h
      },
      dispose() {
        disposed = true
        window.removeEventListener('pointermove', onPointer)
        renderer.dispose()
      },
    }
  } catch (err) {
    console.error('[rainEffect] init failed:', err)
    return null
  }
}
