/*
 * 玄策 · 雨场景层（借鉴 codrops/RainEffect 的 WebGL 水滴折射技法）
 * 层结构：程序化夜雨背景（暗蓝灰渐变 + 光晕）为底，水滴在背景上折射（water-map 编码），
 * 形成"镜头雨滴"真实质感。独立 WebGL canvas，不依赖 three。
 */
const VERT = `
precision mediump float;
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`

const FRAG = `
precision highp float;
uniform sampler2D u_bg;
uniform sampler2D u_waterMap;
uniform vec2 u_resolution;
uniform float u_minRefraction;
uniform float u_refractionDelta;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 cur = texture2D(u_waterMap, vec2(uv.x, 1.0 - uv.y));
  float d = cur.b;                                  // 厚度
  vec2 ref = (vec2(cur.g, cur.r) - 0.5) * 2.0;      // 折射方向
  vec2 bgUV = vec2(uv.x, 1.0 - uv.y) + ref * (u_minRefraction + d * u_refractionDelta) * 0.0015;
  vec3 col = texture2D(u_bg, bgUV).rgb;
  float a = clamp(cur.a * 22.0 - 6.0, 0.0, 1.0);
  // 水滴高光（上缘受光）
  float hi = smoothstep(0.68, 0.95, d) * a;
  col += vec3(0.62, 0.72, 0.82) * hi * 0.5;
  gl_FragColor = vec4(col, a * 0.85);
}
`

interface Drop {
  x: number
  y: number
  r: number
  vx: number
  vy: number
  life: number
}

export class RainScene {
  private water: HTMLCanvasElement
  private wctx: CanvasRenderingContext2D
  private bg: HTMLCanvasElement
  private gl: WebGLRenderingContext
  private prog: WebGLProgram | null
  private drops: Drop[] = []
  private intensity = 1
  private wind = 0
  private running = false
  private disposed = false
  private last = 0
  private spawnAcc = 0
  private uniforms: Record<string, WebGLUniformLocation | null> = {}

  constructor(private canvas: HTMLCanvasElement) {
    this.water = document.createElement('canvas')
    this.water.width = Math.max(2, Math.floor(canvas.width / 2))
    this.water.height = Math.max(2, Math.floor(canvas.height / 2))
    const wc = this.water.getContext('2d')
    if (!wc) throw new Error('water ctx')
    this.wctx = wc
    this.bg = this.makeBg()
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false })
    if (!gl) throw new Error('webgl unsupported')
    this.gl = gl
    this.prog = this.buildProgram()
    if (!this.prog) throw new Error('rain shader build failed')
    this.setupQuad()
  }

  setParams(intensity: number, wind: number) {
    this.intensity = Math.min(1, Math.max(0.15, intensity))
    this.wind = wind
  }

  /** 窗口尺寸变化：重建背景/水滴画布（WebGL viewport 随 canvas 尺寸） */
  resize() {
    this.bg = this.makeBg()
    this.water.width = Math.max(2, Math.floor(this.canvas.width / 2))
    this.water.height = Math.max(2, Math.floor(this.canvas.height / 2))
    this.drops = []
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

  private makeBg(): HTMLCanvasElement {
    const c = document.createElement('canvas')
    c.width = this.canvas.width
    c.height = this.canvas.height
    const g = c.getContext('2d')!
    const grad = g.createLinearGradient(0, 0, 0, c.height)
    grad.addColorStop(0, '#0a0f16')
    grad.addColorStop(0.55, '#101923')
    grad.addColorStop(1, '#0c131b')
    g.fillStyle = grad
    g.fillRect(0, 0, c.width, c.height)
    // 远处光晕（雨夜城市感）
    for (let i = 0; i < 6; i++) {
      const x = Math.random() * c.width
      const y = c.height * (0.35 + Math.random() * 0.45)
      const r = 30 + Math.random() * 90
      const rg = g.createRadialGradient(x, y, 0, x, y, r)
      rg.addColorStop(0, `rgba(91,140,158,${0.05 + Math.random() * 0.06})`)
      rg.addColorStop(1, 'rgba(91,140,158,0)')
      g.fillStyle = rg
      g.fillRect(x - r, y - r, r * 2, r * 2)
    }
    return c
  }

  private buildProgram(): WebGLProgram | null {
    const gl = this.gl
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('[rain] shader error:', gl.getShaderInfoLog(s))
        return null
      }
      return s
    }
    const vs = compile(gl.VERTEX_SHADER, VERT)
    const fs = compile(gl.FRAGMENT_SHADER, FRAG)
    if (!vs || !fs) return null
    const p = gl.createProgram()!
    gl.attachShader(p, vs)
    gl.attachShader(p, fs)
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('[rain] link error:', gl.getProgramInfoLog(p))
      return null
    }
    gl.useProgram(p)
    const names = ['u_bg', 'u_waterMap', 'u_resolution', 'u_minRefraction', 'u_refractionDelta']
    for (const n of names) this.uniforms[n] = gl.getUniformLocation(p, n)
    return p
  }

  private setupQuad() {
    const gl = this.gl
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(this.prog!, 'a_position')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  }

  private spawn(dt: number) {
    const rate = 6 + this.intensity * 26
    this.spawnAcc += rate * dt
    while (this.spawnAcc > 1) {
      this.spawnAcc -= 1
      const w = this.water.width
      this.drops.push({
        x: Math.random() * w,
        y: -10,
        r: 3 + Math.random() * 7 * this.intensity,
        vx: -this.wind * 0.02 * w,
        vy: (0.35 + Math.random() * 0.8) + this.intensity * 0.4,
        life: 1,
      })
    }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i]
      d.x += d.vx * dt * 60
      d.y += d.vy * dt * 60
      d.life -= dt * 0.06
      if (d.y > this.water.height + 10 || d.life <= 0) this.drops.splice(i, 1)
    }
    if (this.drops.length > 260) this.drops.splice(0, this.drops.length - 260)
  }

  private drawWater() {
    const c = this.wctx
    c.clearRect(0, 0, this.water.width, this.water.height)
    for (const d of this.drops) {
      const g = c.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r)
      g.addColorStop(0, 'rgba(128,128,255,0.95)')
      g.addColorStop(0.7, 'rgba(128,128,220,0.85)')
      g.addColorStop(1, 'rgba(128,128,160,0.6)')
      c.fillStyle = g
      c.beginPath()
      c.arc(d.x, d.y, d.r, 0, Math.PI * 2)
      c.fill()
    }
  }

  private frame = (now: number) => {
    if (!this.running || this.disposed) return
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    this.spawn(dt)
    this.drawWater()
    const gl = this.gl
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.useProgram(this.prog)
    // bg
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.bgTex())
    gl.uniform1i(this.uniforms.u_bg, 0)
    // water（每帧上传最新水滴画布）
    gl.activeTexture(gl.TEXTURE1)
    const wt = this.waterTex()
    gl.bindTexture(gl.TEXTURE_2D, wt)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.water)
    gl.uniform1i(this.uniforms.u_waterMap, 1)
    gl.uniform2f(this.uniforms.u_resolution, this.canvas.width, this.canvas.height)
    gl.uniform1f(this.uniforms.u_minRefraction, 0.35)
    gl.uniform1f(this.uniforms.u_refractionDelta, 0.85)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    requestAnimationFrame(this.frame)
  }

  private bgTexCache: WebGLTexture | null = null
  private bgTex(): WebGLTexture {
    const gl = this.gl
    if (this.bgTexCache) return this.bgTexCache
    const t = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.bg)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    this.bgTexCache = t
    return t
  }

  private waterTexCache: WebGLTexture | null = null
  private waterTex(): WebGLTexture {
    const gl = this.gl
    if (this.waterTexCache) return this.waterTexCache
    const t = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    this.waterTexCache = t
    return t
  }
}
