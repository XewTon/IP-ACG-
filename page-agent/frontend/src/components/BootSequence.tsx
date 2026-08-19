/*
 * 玄策 · 开机序章 —— Cinematic 3D Futuristic Boot Sequence
 * 视觉叙事（约 9.4s）：
 *   BLACKOUT → SYSTEM WAKE → SPACE ACTIVATION → IMAGE DETECTED → DEPTH ANALYSIS
 *   → 3D RECONSTRUCTION（粒子重建 IP 立绘）→ HUD LOCK（空间 HUD 围绕角色）
 *   → CAMERA FLY THROUGH（镜头加速穿入 IP 世界）→ HYPERSPACE（数据汇聚→爆发→白闪）
 *   → XUANCE LOGO（数据线/粒子重建 Logo）→ SYSTEM ONLINE → ENTER THE IP WORLD
 * 技术：
 *   three.js（复用 gpuSplash 粒子重建 + EffectComposer/Bloom + 自定义电影后期 shader）
 *   GPU 粒子（BufferGeometry / ShaderMaterial / GPGPU）· 空间层级 Z=-20..+20 · 动态 DPR
 *   DOM HUD 采用极细 mono 排版并做镜头视差（不贴死在屏幕上）
 * 音频预留：每个阶段触发 (window as any).__xuanceBootAudio?.(phaseName)
 * 降级：WebGL 不可用 → CSS 电影级降级（终端→Logo→ENTER）；软渲染 → 低粒子 + 低 Bloom
 */
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { frameLoop, disposeObject } from '../lib/threeUtils'
import { buildSplashCloud, buildReliefCanvas } from '../lib/pointcloud'
import { GpuSplash } from '../lib/gpuSplash'
import { makeSoftSprite } from '../lib/softSprite'

const IMG = '/splash_figure.webp'
/* 深度图（可选增强）：scripts/generate_splash_depth.py 生成 splash_depth.png 后，
 * 立绘置换用高精度深度（更像建模）；缺失自动回退亮度浮雕 */
const DEPTH_SRC = '/splash_depth.png'
const TOTAL = 9.4

/* 诊断模式：URL 加 ?debug 时显示 GPU 档位/阶段/帧耗时/画面中心像素颜色 —— 用于精确定位偏色来源。
 * 再加 &black：不渲染任何 3D 内容（纯黑 + 暖金文字），用于分辨「淡蓝」是代码渲染还是显示器/系统偏色 */
const DEBUG = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')
const BLACK_TEST = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('black')

/* 加载图片到 canvas（深度图探测；404 或解码失败返回 null） */
function loadImageCanvas(src: string): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    const im = new Image()
    im.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = im.width
        c.height = im.height
        c.getContext('2d')!.drawImage(im, 0, 0)
        resolve(c)
      } catch {
        resolve(null)
      }
    }
    im.onerror = () => resolve(null)
    im.src = src
  })
}

/* 阶段时间轴（秒） */
const PH = {
  BLACKOUT: 0.8,
  WAKE: 1.6,
  SPACE: 2.4,
  DETECT: 3.2,
  RECON: 4.6,
  LOCK: 5.4,
  FLY: 6.5,
  HYPER: 7.0,
  LOGO: 8.0,
  ENTER: 9.4,
}

/* 显卡分级：软渲染（SwiftShader 等）/ 低端集成显卡（显存受限）。
 * 注意：Chrome/Edge 的 UNMASKED_RENDERER_WEBGL 形如
 *   "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics, OpenGL ...)"
 *   "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 ...)"
 * 旧正则按 "iris xe" / "radeon (vega|integrated)" 原样匹配会在括号/大小写处失效，
 * 导致 Iris Xe、AMD Vega 这类 iGPU 全被误判为高端档 → 60k 粒子 + Bloom + 1.5 DPR 直接卡死。
 * 修复：剥离括号/标点、统一小写后再做关键字匹配；型号识别不出时跑微基准兜底。 */
function detectGPU(): { soft: boolean; low: boolean } {
  try {
    const c = document.createElement('canvas')
    const gl = (c.getContext('webgl') || c.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (!gl) return { soft: true, low: true }
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const raw = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : ''
    /* 标准化：小写 + 非字母数字全部压成单个空格（"Intel(R) Iris(R) Xe" → "intel r iris r xe"） */
    const name = raw.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    const soft = /swiftshader|software|llvmpipe|microsoft basic render|warp/.test(name)
    /* iGPU / 移动端关键字表：剥离括号后 "iris xe" / "radeon tm vega" 等均能命中 */
    const low =
      /intel.*(iris|uhd graphics|hd graphics|hd 4|hd 5|hd 6|hd 7)/.test(name) ||
      /iris xe|iris plus|iris hd|uhd graphics|hd graphics/.test(name) ||
      /radeon tm (vega|graphics|r2|r3|r4|r5|r6|r7)|radeon (vega|integrated)/.test(name) ||
      /mali|adreno|powervr|videocore|geforce (mx|gt |gtx 7|gtx 8|gtx 9)|quadro k|mobile intel/.test(name)
    /* 型号未知（Firefox/隐私插件屏蔽 UNMASKED 等）→ 微基准兜底：512×512 三角形 24 帧，
     * 平均帧耗时 > 10ms 视为低端（iGPU 填充率瓶颈在此暴露） */
    const result: { soft: boolean; low: boolean } = soft
      ? { soft: true, low: true }
      : low
        ? { soft: false, low: true }
        : { soft: false, low: benchmarkSlow(gl) }
    /* 探测用 context 用完即释放，不占浏览器 WebGL context 名额 */
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return result
  } catch {
    return { soft: true, low: true }
  }
}

/* 填充率微基准：仅用于型号识别失败时兜底，一次 ~20-50ms，只跑一遍 */
function benchmarkSlow(gl: WebGLRenderingContext): boolean {
  try {
    const mk = (t: number) => {
      const s = gl.createShader(t)!
      gl.shaderSource(s, t === gl.VERTEX_SHADER
        ? 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'
        : 'precision mediump float;void main(){gl_FragColor=vec4(1.);}')
      gl.compileShader(s)
      return s
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, mk(gl.VERTEX_SHADER))
    gl.attachShader(prog, mk(gl.FRAGMENT_SHADER))
    gl.linkProgram(prog)
    gl.useProgram(prog)
    const buf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const fb = gl.createFramebuffer()!
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 512, 512, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    gl.viewport(0, 0, 512, 512)
    for (let i = 0; i < 6; i++) gl.drawArrays(gl.TRIANGLES, 0, 3) // 预热
    const t0 = performance.now()
    for (let i = 0; i < 24; i++) gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.finish()
    const ms = (performance.now() - t0) / 24
    gl.deleteFramebuffer(fb); gl.deleteTexture(tex); gl.deleteBuffer(buf); gl.deleteProgram(prog)
    return ms > 10
  } catch {
    return false
  }
}
const GPU = detectGPU()
const SOFT_RENDERER = GPU.soft
const LOW_GPU = GPU.low
/* 后期分档：低端/软渲染全部关闭后期（连 EffectComposer 都不建，直接渲屏 —— 省显存省带宽） */
const USE_BLOOM = !LOW_GPU
const USE_FILM = !LOW_GPU
/* 粒子数：低端/软渲染 14k 轻量 Points（GPU 内插值，零每帧上传）；高端 20k GPGPU
 * （原 60k 在弱卡上仍吃紧；20k 保持密度感同时 GPGPU 成本降 2/3） */
const PARTICLE_TARGET = LOW_GPU ? 14000 : 20000
/* 供 main.tsx 在模块加载期即启动粒子云构建（命中 splashCloudCache，黑场阶段就绪） */
export const SPLASH_IMG = IMG
export const BOOT_PARTICLE_TARGET = PARTICLE_TARGET

/* 粒子重建系统抽象：高端 GPGPU（gpuSplash）/ 低端轻量 Points */
type PSystem = {
  update(k: number, visible: number, dt: number, t: number): void
  dispose(): void
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a))
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
const easeIn = (x: number) => x * x * x
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3)
const lerp = (a: number, b: number, k: number) => a + (b - a) * k

/* 电影后期：色差 + 胶片颗粒 + 暗角（单 pass，克制） */
const filmShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uChroma: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uChroma;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      vec2 d = uv - 0.5;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + d * uChroma).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - d * uChroma).b;
      col += (hash(uv * 640.0 + uTime * 55.0) - 0.5) * 0.03;
      float vig = smoothstep(0.9, 0.38, length(d) * 1.12);
      col *= mix(0.7, 1.0, vig);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
}

/* ---- 体积立体 shader（立绘「建模感」）：顶点深度置换 + 梯度法线 + 漫反射 + 菲涅尔边缘光 ----
 * 完全自定义实现，不依赖 three 内置置换材质。深度源：splash_depth.png（若存在）或亮度浮雕图。
 * （此前「淡蓝」根源是白闪层 bug，已修复；本 shader 输出 = 原图色 × 暖光照，无偏色风险） */
const volumeVertex = /* glsl */ `
  uniform sampler2D uDepthMap;
  uniform float uDepthScale;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  /* 深度平滑采样（3×3 加权）：2D 立绘的明暗是「艺术明暗」而非真实几何深度，
   * 高频明暗（颧骨/眼窝/鼻影）直接置换会扭曲五官 —— 平滑后只保留大体轮廓起伏 */
  float depthAt(sampler2D t, vec2 uv) {
    float e = 1.0 / 512.0;
    float d = texture2D(t, uv).r * 4.0;
    d += texture2D(t, uv + vec2(e, 0.0)).r;
    d += texture2D(t, uv - vec2(e, 0.0)).r;
    d += texture2D(t, uv + vec2(0.0, e)).r;
    d += texture2D(t, uv - vec2(0.0, e)).r;
    return d / 8.0;
  }
  void main() {
    vUv = uv;
    float d = depthAt(uDepthMap, uv);
    vec3 pos = position;
    pos.z += d * uDepthScale;
    float e = 1.0 / 512.0;
    float hR = depthAt(uDepthMap, uv + vec2(e, 0.0));
    float hL = depthAt(uDepthMap, uv - vec2(e, 0.0));
    float hU = depthAt(uDepthMap, uv + vec2(0.0, e));
    float hD = depthAt(uDepthMap, uv - vec2(0.0, e));
    vNormal = normalize(vec3(hL - hR, hD - hU, 0.9));
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    vViewPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`

const volumeFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uLightDir;
  uniform vec3 uLightColor;
  uniform vec3 uAmbient;
  uniform vec3 uEdgeColor;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  void main() {
    vec4 tex = texture2D(uMap, vUv);
    if (tex.a < 0.06) discard;
    vec3 n = normalize(vNormal);
    vec3 l = normalize(uLightDir);
    float diff = max(dot(n, l), 0.0);
    vec3 col = tex.rgb * (uAmbient + uLightColor * diff);
    vec3 v = normalize(-vViewPos);
    float fres = pow(1.0 - max(dot(n, v), 0.0), 2.2);
    col += uEdgeColor * fres * 0.3;
    gl_FragColor = vec4(col, tex.a * uOpacity);
  }
`

export default function BootSequence({ onDone }: { onDone: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const flashRef = useRef<HTMLDivElement>(null)
  const bootRef = useRef<HTMLDivElement>(null)
  const detectRef = useRef<HTMLDivElement>(null)
  const lockRef = useRef<HTMLDivElement>(null)
  const phaseRef = useRef<HTMLDivElement>(null)
  const logoRef = useRef<HTMLDivElement>(null)
  const enterRef = useRef<HTMLDivElement>(null)
  const debugEl = useRef<HTMLDivElement>(null)
  const skipFnRef = useRef<() => void>(() => {})
  const doneRef = useRef(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onDone()
      return
    }
    const overlay = overlayRef.current
    const canvas = canvasRef.current
    let disposed = false

    const finish = () => {
      if (doneRef.current) return
      doneRef.current = true
      onDone()
    }
    const skip = () => {
      if (doneRef.current) return
      if (overlay) {
        overlay.style.transition = 'opacity 0.4s ease'
        overlay.style.opacity = '0'
      }
      window.setTimeout(finish, 420)
    }
    skipFnRef.current = skip
    const onPointer = () => skip()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ') skip()
    }
    overlay?.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)

    /* 音频钩子（可选注入） */
    const audio = (window as unknown as { __xuanceBootAudio?: (p: string) => void }).__xuanceBootAudio
    const phaseName = (t: number): string => {
      if (t < PH.WAKE) return 'BLACKOUT'
      if (t < PH.SPACE) return 'SYSTEM_WAKE'
      if (t < PH.DETECT) return 'SPACE_ACTIVATION'
      if (t < PH.RECON) return 'IMAGE_DETECTED'
      if (t < PH.LOCK) return 'RECONSTRUCTION'
      if (t < PH.FLY) return 'HUD_LOCK'
      if (t < PH.HYPER) return 'CAMERA_FLY_THROUGH'
      if (t < PH.LOGO) return 'HYPERSPACE'
      if (t < PH.ENTER) return 'LOGO'
      return 'ENTER'
    }
    let lastPhase = ''
    const notifyPhase = (t: number) => {
      const p = phaseName(t)
      if (p !== lastPhase) {
        lastPhase = p
        if (audio) audio(p)
        if (phaseRef.current) phaseRef.current.textContent = `PHASE // ${p.replace(/_/g, ' ')}`
      }
    }

    /* ================= three.js 场景 ================= */
    let renderer: THREE.WebGLRenderer | null = null
    let unLoop: (() => void) | null = null
    let pSystem: PSystem | null = null
    let webglOK = true
    try {
      /* DPR/抗锯齿按显卡分级：低端 0.75× 分辨率（填充率减半，弱 iGPU 关键）+ 不透明画布；
       * 高端上限 1.25（全屏后期 pass 的像素量比 1.5 少 ~31%，中端独显也稳 60fps） */
      renderer = new THREE.WebGLRenderer({ canvas: canvas!, antialias: !LOW_GPU, alpha: !LOW_GPU, preserveDrawingBuffer: DEBUG })
      renderer.setPixelRatio(LOW_GPU ? 0.75 : Math.min(window.devicePixelRatio || 1, 1.25))
      renderer.setClearColor(0x0c0b0a, LOW_GPU ? 1 : 0)
    } catch {
      webglOK = false
    }

    const dispose3D = () => {
      if (unLoop) unLoop()
      if (pSystem) pSystem.dispose()
      if (composer) composer.dispose()
      if (renderer) renderer.dispose()
      extraDisposers.forEach((d) => d())
      extraDisposers.length = 0
      pSystem = null
      unLoop = null
      renderer = null
      composer = null
    }
    const extraDisposers: (() => void)[] = []
    let composer: EffectComposer | null = null

    if (webglOK && renderer && canvas) {
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x0c0b0a)
      scene.fog = new THREE.Fog(0x0c0b0a, 12, 40)
      const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 80)
      camera.position.set(0, 0, 9.2)
      camera.lookAt(0, 0, 0)

      /* 后期：仅高端建 EffectComposer（Bloom + 电影 shader）；低端直接渲屏 */
      const cw = canvas.clientWidth || window.innerWidth
      const ch = canvas.clientHeight || window.innerHeight
      let bloom: UnrealBloomPass | null = null
      let filmPass: ShaderPass | null = null
      if (!LOW_GPU) {
        composer = new EffectComposer(renderer)
        composer.addPass(new RenderPass(scene, camera))
        if (USE_BLOOM) {
          /* Bloom 克制化：强度 0.5→0.32、阈值 0.55→0.62 —— 蓝青星点/粒子不再被放大成全屏淡蓝雾 */
          bloom = new UnrealBloomPass(new THREE.Vector2(cw, ch), 0.32, 0.5, 0.62)
          bloom.resolution.set(0.35, 0.35)
          composer.addPass(bloom)
        }
        if (USE_FILM) {
          filmPass = new ShaderPass(filmShader)
          composer.addPass(filmPass)
        }
        composer.addPass(new OutputPass())
      }

      /* ---- 空间层级 Z=-30..+20 ---- */

      // 星场（z -30..-10）
      const starGeo = new THREE.BufferGeometry()
      const starN = LOW_GPU ? 180 : 420
      const starPos = new Float32Array(starN * 3)
      for (let i = 0; i < starN; i++) {
        starPos[i * 3] = (Math.random() - 0.5) * 60
        starPos[i * 3 + 1] = (Math.random() - 0.5) * 34
        starPos[i * 3 + 2] = -10 - Math.random() * 20
      }
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
      const starMat = new THREE.PointsMaterial({ color: 0x9fc4d8, size: 0.05, transparent: true, opacity: 0.65, sizeAttenuation: true, depthWrite: false })
      const stars = new THREE.Points(starGeo, starMat)
      scene.add(stars)

      // 数据节点（z -18..+4，缓慢漂移）
      const nodeGeo = new THREE.BufferGeometry()
      const nodeN = LOW_GPU ? 40 : 90
      const nodePos = new THREE.BufferAttribute(new Float32Array(nodeN * 3), 3)
      for (let i = 0; i < nodeN; i++) {
        nodePos.setXYZ(i, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 5, -18 + Math.random() * 22)
      }
      nodeGeo.setAttribute('position', nodePos)
      const nodeMat = new THREE.PointsMaterial({
        color: 0x6fd3e8, size: 0.06, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
      })
      const nodes = new THREE.Points(nodeGeo, nodeMat)
      scene.add(nodes)

      // 透视网格（两层，不同 Z → 镜头移动时真实视差）
      const gridFar = new THREE.GridHelper(36, 36, 0x1d4a66, 0x0e2338)
      gridFar.position.set(0, -1.5, -14)
      ;(gridFar.material as THREE.Material).transparent = true
      ;(gridFar.material as THREE.Material).opacity = 0.5
      scene.add(gridFar)
      const gridNear = new THREE.GridHelper(16, 16, 0x2f6b8a, 0x12324a)
      gridNear.position.set(0, -1.2, -6)
      ;(gridNear.material as THREE.Material).transparent = true
      ;(gridNear.material as THREE.Material).opacity = 0.55
      scene.add(gridNear)

      // 背景辉光（立绘后方体积感；暗蓝深空色调，避免「蓝色幕布」感）
      const glowTex = makeSoftSprite()
      const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x16304a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }))
      glowSprite.scale.set(7, 7, 1)
      glowSprite.position.set(0, 0, -0.6)
      scene.add(glowSprite)

      // 超空间光线（FLY/HYPER 阶段拉伸；低端档减少）
      const streakN = LOW_GPU ? 60 : 150
      const streakGeo = new THREE.BufferGeometry()
      const streakPos = new THREE.BufferAttribute(new Float32Array(streakN * 2 * 3), 3)
      const streakDir = new Float32Array(streakN * 3)
      for (let i = 0; i < streakN; i++) {
        const th = Math.random() * Math.PI * 2
        const ph = Math.acos(2 * Math.random() - 1)
        streakDir[i * 3] = Math.sin(ph) * Math.cos(th)
        streakDir[i * 3 + 1] = Math.sin(ph) * Math.sin(th)
        streakDir[i * 3 + 2] = Math.cos(ph)
      }
      streakGeo.setAttribute('position', streakPos)
      const streakMat = new THREE.LineBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0 })
      const streaks = new THREE.LineSegments(streakGeo, streakMat)
      scene.add(streaks)

      /* ---- HUD 空间元素（LOCK 阶段围绕角色） ---- */
      let boxLines: THREE.LineSegments | null = null
      let axes: THREE.Group | null = null
      let scanPlane: THREE.Mesh | null = null
      let hudGroup = new THREE.Group()
      scene.add(hudGroup)

      const buildHud = (aspect: number) => {
        const w = aspect * 2 + 0.34
        const h = 2.34
        const d = 1.4
        const pts: number[] = [
          -w / 2, -h / 2, -d / 2, w / 2, -h / 2, -d / 2,
          w / 2, -h / 2, -d / 2, w / 2, h / 2, -d / 2,
          w / 2, h / 2, -d / 2, -w / 2, h / 2, -d / 2,
          -w / 2, h / 2, -d / 2, -w / 2, -h / 2, -d / 2,
          -w / 2, -h / 2, d / 2, w / 2, -h / 2, d / 2,
          w / 2, -h / 2, d / 2, w / 2, h / 2, d / 2,
          w / 2, h / 2, d / 2, -w / 2, h / 2, d / 2,
          -w / 2, h / 2, d / 2, -w / 2, -h / 2, d / 2,
          -w / 2, -h / 2, -d / 2, -w / 2, -h / 2, d / 2,
          w / 2, -h / 2, -d / 2, w / 2, -h / 2, d / 2,
          w / 2, h / 2, -d / 2, w / 2, h / 2, d / 2,
          -w / 2, h / 2, -d / 2, -w / 2, h / 2, d / 2,
        ]
        const bg = new THREE.BufferGeometry()
        bg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
        boxLines = new THREE.LineSegments(bg, new THREE.LineBasicMaterial({ color: 0xd9a845, transparent: true, opacity: 0 }))
        boxLines.position.set(0, 0, 0.5)
        hudGroup.add(boxLines)

        // 低端档：仅保留线框盒（跳过 XYZ 轴与扫描线，省 draw call）
        if (LOW_GPU) return

        // XYZ 轴（暖金，与立绘暖调统一；不再用蓝色避免「淡蓝氛围」）
        axes = new THREE.Group()
        const axisMat = (c: number) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0 })
        const mkAxis = (dir: [number, number, number], mat: THREE.LineBasicMaterial) => {
          const g = new THREE.BufferGeometry()
          g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, dir[0], dir[1], dir[2]], 3))
          const l = new THREE.Line(g, mat)
          axes!.add(l)
        }
        mkAxis([1.9, 0, 0], axisMat(0xd9a845))
        mkAxis([0, 1.35, 0], axisMat(0xd9a845))
        mkAxis([0, 0, 1.1], axisMat(0xe8c07a))
        axes.position.set(-w / 2, -h / 2, -d / 2)
        hudGroup.add(axes)

        // 扫描线（立绘表面自下而上；暖金色）
        const sGeo = new THREE.PlaneGeometry(w + 0.1, 0.03)
        scanPlane = new THREE.Mesh(sGeo, new THREE.MeshBasicMaterial({ color: 0xd9a845, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }))
        scanPlane.position.set(0, 0, 0.42)
        hudGroup.add(scanPlane)
      }

      /* ---- 体积立体立绘（粒子聚形后定格展示，建模感）：
       * 自定义 shader 顶点深度置换 + 梯度法线光照 + 菲涅尔边缘光 + 背层板厚；
       * 深度优先 splash_depth.png（深度模型产物），缺失回退亮度浮雕 */
      let figureGroup: THREE.Group | null = null
      let figureMat: THREE.ShaderMaterial | null = null
      let figureBackMat: THREE.MeshBasicMaterial | null = null
      const addReliefFigure = async () => {
        try {
          const depth = await loadImageCanvas(DEPTH_SRC)
          if (disposed) return
          let reliefCanvas: HTMLCanvasElement | null = depth && depth.width > 8 ? depth : null
          if (!reliefCanvas) reliefCanvas = await buildReliefCanvas(IMG, 512).catch(() => null)
          if (disposed) return
          const im = new Image()
          await new Promise<void>((res, rej) => {
            im.onload = () => res()
            im.onerror = () => rej(new Error('splash image load failed'))
            im.src = IMG
          })
          if (disposed) return

          const aspect = im.width / im.height
          const tex = new THREE.CanvasTexture(im)
          tex.colorSpace = THREE.SRGBColorSpace
          const dtex = new THREE.CanvasTexture(reliefCanvas)
          const seg = LOW_GPU ? 64 : 160

          figureMat = new THREE.ShaderMaterial({
            uniforms: {
              uMap: { value: tex },
              uDepthMap: { value: dtex },
              uDepthScale: { value: LOW_GPU ? 0.1 : 0.16 },
              uLightDir: { value: new THREE.Vector3(0.5, 0.6, 1) },
              uLightColor: { value: new THREE.Color(0xffe8cc) },
              uAmbient: { value: new THREE.Color(0xd8cbb8) },
              uEdgeColor: { value: new THREE.Color(0x8a6a3a) },
              uOpacity: { value: 0 },
            },
            vertexShader: volumeVertex,
            fragmentShader: volumeFragment,
            transparent: true,
            depthWrite: false,
          })
          const front = new THREE.Mesh(new THREE.PlaneGeometry(aspect * 2, 2, Math.round(seg * aspect * 0.5), seg), figureMat)
          front.renderOrder = 2

          /* 背层：镜像贴图 + 中性暗化 → 镜头环绕侧视有板厚（不染色） */
          figureBackMat = new THREE.MeshBasicMaterial({
            map: tex,
            color: 0x4a4f58,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            side: THREE.DoubleSide,
          })
          const back = new THREE.Mesh(new THREE.PlaneGeometry(aspect * 2, 2), figureBackMat)
          back.scale.x = -1
          back.position.z = -0.3
          back.renderOrder = 2

          figureGroup = new THREE.Group()
          figureGroup.add(front, back)
          figureGroup.visible = false
          scene.add(figureGroup)
          extraDisposers.push(() => { tex.dispose(); dtex.dispose() })
        } catch (e) {
          console.error('[boot] figure init failed:', e)
        }
      }

      /* ---- 粒子重建：高端 GPGPU（gpuSplash）/ 低端轻量 Points ---- */
      buildSplashCloud(IMG, PARTICLE_TARGET)
        .then((pc) => {
          if (disposed || !renderer) return
          /* 闭包内属性窄化会失效：先把可选字段捕获为局部常量再使用 */
          const srcColors = pc.sourceColors
          const hotFlags = pc.hotFlags
          if (!srcColors) throw new Error('missing colors')
          if (LOW_GPU) {
            // 轻量 Points：聚形插值在 GPU 顶点着色器内完成（mix(aStart,aTarget,uProg)），
            // CPU 每帧只更新两个 uniform —— 彻底消除每帧 2 万×3 顶点的上传开销（弱 iGPU 关键优化）
            const N = pc.positions.length / 3
            const geo = new THREE.BufferGeometry()
            const spread = new Float32Array(N * 3)
            for (let i = 0; i < N; i++) {
              const th = Math.random() * Math.PI * 2
              const ph = Math.acos(2 * Math.random() - 1)
              const r = 2.4 + Math.random() * 2.6
              spread[i * 3] = Math.sin(ph) * Math.cos(th) * r
              spread[i * 3 + 1] = Math.sin(ph) * Math.sin(th) * r
              spread[i * 3 + 2] = Math.cos(ph) * r
            }
            geo.setAttribute('position', new THREE.BufferAttribute(spread, 3))
            geo.setAttribute('aStart', new THREE.BufferAttribute(spread, 3))
            geo.setAttribute('aTarget', new THREE.BufferAttribute(pc.positions, 3))
            geo.setAttribute('aColor', new THREE.BufferAttribute(srcColors, 3))
            const mat = new THREE.ShaderMaterial({
              uniforms: {
                uProg: { value: 0 },
                uOpacity: { value: 0 },
                uSize: { value: 0.028 },
                uPixelRatio: { value: 0.75 * (window.devicePixelRatio || 1) },
              },
              vertexShader: /* glsl */ `
                attribute vec3 aStart;
                attribute vec3 aTarget;
                attribute vec3 aColor;
                uniform float uProg;
                uniform float uSize;
                uniform float uPixelRatio;
                varying vec3 vColor;
                void main() {
                  vec3 p = mix(aStart, aTarget, uProg);
                  vec4 mv = modelViewMatrix * vec4(p, 1.0);
                  gl_PointSize = uSize * uPixelRatio * (220.0 / max(0.01, -mv.z));
                  gl_Position = projectionMatrix * mv;
                  vColor = aColor;
                }
              `,
              fragmentShader: /* glsl */ `
                uniform float uOpacity;
                varying vec3 vColor;
                void main() {
                  vec2 d = gl_PointCoord - 0.5;
                  float a = 1.0 - smoothstep(0.28, 0.5, length(d));
                  if (a <= 0.003) discard;
                  gl_FragColor = vec4(vColor, a * uOpacity);
                }
              `,
              transparent: true,
              depthWrite: false,
            })
            const pts = new THREE.Points(geo, mat)
            scene.add(pts)
            pSystem = {
              update(k: number, visible: number) {
                mat.uniforms.uProg.value = k
                mat.uniforms.uOpacity.value = visible
              },
              dispose() { geo.dispose(); mat.dispose() },
            }
          } else {
            /* GpuSplash 构造含 3 个 GPGPU shader 编译 + 60k×9 顶点/纹理分配，单次 50~200ms；
             * rAF 延后一帧执行：先让当前帧画完，重活落在纯黑屏阶段，肉眼不可见 */
            requestAnimationFrame(() => {
              if (disposed || !renderer) return
              try {
                const s = new GpuSplash(renderer, {
                  positions: pc.positions,
                  sourceColors: srcColors,
                  hotFlags: hotFlags!,
                  aspect: pc.aspect,
                }, scene)
                s.setOpacity(0)
                s.setGlowOpacity(0)
                pSystem = {
                  update(k: number, visible: number, dt: number, t: number) {
                    s.update(k, dt, t)
                    s.setOpacity(visible * (0.85 - 0.3 * k))
                    s.setGlowOpacity(visible * 0.4)
                  },
                  dispose() { s.dispose() },
                }
              } catch (e) {
                console.error('[boot] particle init failed:', e)
              }
            })
          }
          buildHud(pc.aspect)
          void addReliefFigure()
        })
        .catch((e) => {
          console.error('[boot] particle init failed:', e)
          buildHud(1.5)
        })

      /* ---- 镜头运动（电影感：缓动/惯性/加速） ---- */
      const camPath = (t: number): { x: number; y: number; z: number; lookY: number; fov: number; shake: number } => {
        let x = 0, y = 0, z = 9.2, lookY = 0.1, fov = 50, shake = 0
        if (t < PH.WAKE) {
          z = lerp(9.2, 8.8, easeInOut(seg(t, 0, PH.WAKE)))
        } else if (t < PH.SPACE) {
          z = lerp(8.8, 8.0, easeOut(seg(t, PH.WAKE, PH.SPACE)))
          x = -0.05
        } else if (t < PH.DETECT) {
          z = lerp(8.0, 6.8, easeInOut(seg(t, PH.SPACE, PH.DETECT)))
          x = Math.sin(t * 0.9) * 0.14
          y = -0.02
        } else if (t < PH.RECON) {
          z = lerp(6.8, 5.4, easeInOut(seg(t, PH.DETECT, PH.RECON)))
          y = -0.05
        } else if (t < PH.LOCK) {
          z = lerp(5.4, 4.0, easeInOut(seg(t, PH.RECON, PH.LOCK)))
        } else if (t < PH.FLY) {
          /* 立体展示段：镜头保持中景（不贴脸）+ 轻微弧线环绕，侧面可见板厚与置换起伏 */
          z = lerp(4.0, 3.4, easeInOut(seg(t, PH.LOCK, PH.FLY)))
          x = Math.sin(t * 0.8) * 0.35
          y = Math.cos(t * 0.7) * 0.18
        } else if (t < PH.HYPER) {
          z = lerp(3.4, 0.7, easeIn(seg(t, PH.FLY, PH.HYPER)))
          fov = lerp(50, LOW_GPU ? 64 : 74, easeIn(seg(t, PH.LOCK, PH.FLY)))
          shake = easeIn(seg(t, PH.LOCK, PH.FLY)) * (LOW_GPU ? 0.028 : 0.05)
          x = Math.sin(t * 57) * shake
          y = Math.sin(t * 47) * shake
        } else if (t < PH.LOGO) {
          z = lerp(0.7, 0.35, seg(t, PH.FLY, PH.HYPER))
          fov = lerp(LOW_GPU ? 64 : 74, LOW_GPU ? 60 : 66, seg(t, PH.FLY, PH.HYPER))
          shake = (1 - seg(t, PH.FLY, PH.HYPER)) * (LOW_GPU ? 0.028 : 0.05)
          x = Math.sin(t * 90) * shake
          y = Math.sin(t * 80) * shake
        } else if (t < PH.ENTER) {
          const k = easeOut(seg(t, PH.LOGO, PH.ENTER))
          z = lerp(0.35, 6.4, k)
          fov = lerp(66, 52, k)
        } else {
          z = 6.4 - seg(t, PH.ENTER, TOTAL) * 0.4
          y = Math.sin(t * 0.4) * 0.06
        }
        return { x, y, z, lookY, fov, shake }
      }

      /* 自适应降档状态：掉帧持续超阈值后降分辨率（见帧循环）；提升到 onResize 之前供其引用 */
      let degraded = false
      let ema = 16.7
      const targetDPR = () => (degraded ? 0.85 : LOW_GPU ? 0.75 : Math.min(window.devicePixelRatio || 1, 1.25))

      const onResize = () => {
        const w = canvas.clientWidth
        const h = canvas.clientHeight
        if (!w || !h) return
        /* 跨屏拖动 / 缩放窗口时 DPR 可能变化，重算渲染与后期目标（composer.setPixelRatio 会连带缩放所有 pass） */
        renderer!.setPixelRatio(targetDPR())
        if (composer) composer.setPixelRatio(targetDPR())
        renderer!.setSize(w, h, false)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        if (composer) {
          composer.setSize(w, h)
          if (bloom) bloom.setSize(w, h)
        }
      }
      onResize()
      window.addEventListener('resize', onResize)

      /* DOM HUD 视差目标 */
      const parallaxTargets: { el: HTMLElement | null; fx: number; fy: number }[] = [
        { el: bootRef.current, fx: 12, fy: 8 },
        { el: detectRef.current, fx: 20, fy: 10 },
        { el: lockRef.current, fx: -24, fy: 14 },
        { el: phaseRef.current, fx: 6, fy: 4 },
      ]

      let last = performance.now()
      let t0 = last
      let frame = 0
      let loopErrLogged = false
      unLoop = frameLoop((now) => {
        try {
        const dt = Math.min(0.05, (now - last) / 1000)
        last = now
        const t = (now - t0) / 1000
        frame++
        if (!LOW_GPU && !degraded && t > 1.5) {
          ema = ema * 0.92 + dt * 1000 * 0.08
          if (ema > 26) {
            degraded = true
            /* composer.setPixelRatio 会连带重设所有 pass（含 Bloom）的渲染目标，且不动 canvas 样式 */
            renderer!.setPixelRatio(0.85)
            if (composer) composer.setPixelRatio(0.85)
          }
        }
        notifyPhase(t)

        const cam = camPath(t)
        camera.position.set(cam.x, cam.y + 0.05, cam.z)
        camera.fov = cam.fov
        camera.updateProjectionMatrix()
        camera.lookAt(0, cam.lookY, 0.2)

        /* 粒子重建：RECON 聚形，聚形完成后作为科技氛围继续飘散在立绘周围，
         * 直到镜头穿入（6.5s）才淡出 —— 恢复「粒子 + 立绘」同台的科技感 */
        if (pSystem) {
          try {
            const reconK = easeOut(seg(t, PH.DETECT, PH.RECON))
            const fadeOutK = 1 - easeIn(seg(t, PH.FLY, PH.FLY + 0.4))
            const visible = Math.max(0, Math.min(1, reconK)) * Math.max(0, fadeOutK)
            pSystem.update(reconK, visible, dt, t)
          } catch (e) {
            console.error('[boot] particle update failed, disabling particles:', e)
            pSystem.dispose()
            pSystem = null
          }
        }

        /* 体积立体立绘：粒子聚形完成后淡入（4.6s）→ 定格展示（镜头环绕 + 扫光）→ 6.7s 淡出让位超空间。
         * 防御：立绘块出错仅隐藏立绘，不影响后续阶段 */
        if (figureGroup && figureMat) {
          try {
            const inK = easeInOut(seg(t, PH.RECON, PH.RECON + 0.5))
            const outK = 1 - easeInOut(seg(t, PH.FLY + 0.2, PH.HYPER))
            const opacity = Math.max(0, inK * outK)
            figureGroup.visible = opacity > 0.01
            figureMat.uniforms.uOpacity.value = opacity
            if (figureBackMat) figureBackMat.opacity = opacity * 0.85
            /* 扫光：光照方向绕立绘旋转 → 光影划过置换表面，建模立体感随光显现 */
            const a = t * 0.7
            ;(figureMat.uniforms.uLightDir.value as THREE.Vector3).set(Math.sin(a), 0.45, Math.cos(a))
          } catch (e) {
            console.error('[boot] figure update failed, hiding figure:', e)
            figureGroup.visible = false
            figureGroup = null
            figureMat = null
            figureBackMat = null
          }
        }

        /* 背景辉光：仅粒子聚形期（DETECT→RECON）提供氛围 —— 立绘展示阶段保持归零，
         * 深蓝辉光会从立绘镂空处透出（白闪 bug 已修复，但立绘期辉光仍保持克制） */
        glowSprite.material.opacity = 0.18 * easeInOut(seg(t, PH.DETECT - 0.4, PH.DETECT)) * (1 - easeInOut(seg(t, PH.RECON - 0.4, PH.RECON)))

        /* Bloom：粒子聚形 + 立绘展示期（6.7s 前）彻底关闭 —— 「逐渐递进」的雾正是粒子聚形时
         * 亮度逐帧累积 + 蓝青星点/节点被 Bloom 逐帧放大扩散所致；仅超空间爆发段保留 0.32 */
        if (bloom) bloom.strength = t >= PH.HYPER - 0.3 && t < PH.LOGO + 0.4 ? 0.32 : 0

        /* HUD 空间元素：LOCK 出现，FLY 淡出 */
        const hudK = easeInOut(seg(t, PH.LOCK - 0.4, PH.LOCK)) * (1 - easeInOut(seg(t, PH.FLY - 0.3, PH.FLY)))
        if (boxLines) (boxLines.material as THREE.Material).opacity = 0.5 * hudK
        if (axes) axes.children.forEach((c) => { ((c as THREE.Line).material as THREE.Material).opacity = 0.6 * hudK })
        if (scanPlane) {
          scanPlane.position.y = lerp(-1.15, 1.15, seg(t, PH.LOCK - 0.2, PH.LOCK + 0.6))
          ;(scanPlane.material as THREE.Material).opacity = 0.55 * hudK * seg(t, PH.LOCK - 0.2, PH.LOCK + 0.8)
        }
        hudGroup.visible = hudK > 0.01

        /* 超空间光线：立绘定格期（LOCK 5.4→6.0s）保持静默，6.0s 起渐起 → FLY 拉伸 → HYPER 爆发。
         * 此前 LOCK 即激活，蓝白光线贯穿整个立绘展示期覆盖立绘 —— 这就是「淡蓝覆盖图片展示」的元凶 */
        let streakK = 0
        if (t >= PH.FLY && t < PH.HYPER) streakK = easeOut(seg(t, PH.FLY, PH.HYPER)) * 3.6
        else if (t < PH.LOGO) streakK = lerp(3.6, 0.15, seg(t, PH.HYPER, PH.LOGO))
        if (t >= PH.FLY && t < PH.LOGO + 0.35) {
          for (let i = 0; i < streakN; i++) {
            const tip = streakK * (0.8 + (i % 7) * 0.3)
            streakPos.setXYZ(i * 2, 0, 0, 0)
            streakPos.setXYZ(i * 2 + 1, streakDir[i * 3] * tip, streakDir[i * 3 + 1] * tip, streakDir[i * 3 + 2] * tip * 2.2)
          }
          streakPos.needsUpdate = true
        }
        streakMat.opacity = clamp01((streakK > 0.05 ? 0.5 : 0) * seg(t, PH.LOCK, PH.HYPER)) * (t < PH.LOGO ? 1 : 1 - seg(t, PH.LOGO, PH.LOGO + 0.3))

        /* 数据节点漂移：每 4 帧上传一次（幅度本就 0.002，肉眼无感，省带宽） */
        if ((frame & 3) === 0) {
          for (let i = 0; i < nodeN; i++) {
            const yy = nodePos.getY(i) + Math.sin(t * 0.6 + i) * 0.002
            nodePos.setY(i, yy)
          }
          nodePos.needsUpdate = true
        }

        /* 白闪（HYPER 爆发）：仅爆发瞬间亮起、随后衰减，其余时间必须为 0。
         * 旧公式在 t < LOGO 时算出 1-seg(0)=1，导致淡蓝白 #eaf6ff 以 92% 不透明度
         * 从第一帧盖满全屏 —— 这就是「淡蓝氛围」的真正根源 */
        if (flashRef.current) {
          const fk =
            t >= PH.HYPER - 0.05 && t < PH.HYPER + 0.02
              ? seg(t, PH.HYPER - 0.05, PH.HYPER + 0.02)
              : t >= PH.HYPER + 0.02 && t < PH.HYPER + 0.35
                ? 1 - seg(t, PH.HYPER + 0.02, PH.HYPER + 0.35)
                : 0
          flashRef.current.style.opacity = String(clamp01(fk * 0.92))
        }

        /* 电影 shader：FLY/HYPER 色差增强（软渲染无此 pass） */
        if (filmPass) {
          filmPass.uniforms.uTime.value = t
          filmPass.uniforms.uChroma.value = t >= PH.LOCK && t < PH.LOGO ? 0.0028 : 0.001
        }

        /* DOM HUD 镜头视差 */
        for (const p of parallaxTargets) {
          if (p.el) {
            p.el.style.transform = `translate3d(${(cam.x * p.fx).toFixed(1)}px, ${(cam.y * p.fy).toFixed(1)}px, 0)`
          }
        }

        /* DOM 阶段显隐 */
        bootRef.current?.classList.toggle('on', t >= PH.WAKE - 0.1 && t < PH.SPACE + 0.3)
        detectRef.current?.classList.toggle('on', t >= PH.DETECT - 0.1 && t < PH.RECON + 0.1)
        lockRef.current?.classList.toggle('on', t >= PH.LOCK - 0.15 && t < PH.FLY + 0.05)
        logoRef.current?.classList.toggle('on', t >= PH.LOGO - 0.15)
        enterRef.current?.classList.toggle('on', t >= PH.ENTER - 0.9)

        if (BLACK_TEST) {
          /* 纯黑画面测试：跳过场景渲染，只清屏 —— 用于判断「淡蓝」是否显示器/系统偏色 */
          renderer!.clear()
        } else if (composer) composer.render()
        else renderer!.render(scene, camera)

        /* 诊断（?debug）：全屏 5×5 平均色 + 中心像素 + 各元素状态 —— 判断整体氛围色调来源 */
        if (DEBUG && (frame % 6 === 0) && debugEl.current) {
          try {
            const gl = renderer!.getContext()
            const dw = gl.drawingBufferWidth
            const dh = gl.drawingBufferHeight
            const px = new Uint8Array(4)
            let rs = 0, gs = 0, bs = 0
            for (let gy = 0; gy < 5; gy++) {
              for (let gx = 0; gx < 5; gx++) {
                gl.readPixels(Math.floor((dw * (gx + 0.5)) / 5), Math.floor((dh * (gy + 0.5)) / 5), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
                rs += px[0]; gs += px[1]; bs += px[2]
              }
            }
            gl.readPixels(dw >> 1, dh >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
            debugEl.current.textContent =
              `GPU:${LOW_GPU ? 'LOW' : 'HIGH'}  t:${t.toFixed(2)}s  ${lastPhase}\n` +
              `avg5x5 rgb(${Math.round(rs / 25)},${Math.round(gs / 25)},${Math.round(bs / 25)})\n` +
              `center rgb(${px[0]},${px[1]},${px[2]})\n` +
              `fig:${figureGroup ? 'on' : 'off'} bloom:${bloom ? bloom.strength.toFixed(2) : '-'} film:${filmPass ? 'on' : '-'}\n` +
              `stars:${stars.visible ? 1 : 0} nodes:${nodes.visible ? 1 : 0} grids:${gridFar.visible ? 1 : 0} hud:${hudGroup.visible ? 1 : 0}`
          } catch { /* ignore */ }
        }

        if (t >= TOTAL) skip()
        } catch (e) {
          /* 全局保险：任何帧异常都吞掉并继续下一帧 —— 动画必然完整播完，后续科技阶段不再丢失 */
          if (!loopErrLogged) { loopErrLogged = true; console.error('[boot] frame error (continuing):', e) }
        }
      })

      extraDisposers.push(() => {
        window.removeEventListener('resize', onResize)
        starGeo.dispose(); starMat.dispose()
        nodeGeo.dispose(); nodeMat.dispose()
        gridFar.geometry.dispose(); (gridFar.material as THREE.Material).dispose()
        gridNear.geometry.dispose(); (gridNear.material as THREE.Material).dispose()
        glowTex.dispose(); glowSprite.material.dispose()
        streakGeo.dispose(); streakMat.dispose()
        if (boxLines) { boxLines.geometry.dispose(); (boxLines.material as THREE.Material).dispose() }
        if (axes) disposeObject(axes)
        if (scanPlane) { scanPlane.geometry.dispose(); (scanPlane.material as THREE.Material).dispose() }
        hudGroup.traverse((o) => disposeObject(o))
        if (figureGroup) figureGroup.traverse((o) => disposeObject(o))
      })

      /* 启动即清理标志：置 disposed 保证延后回调（rAF 构造、粒子云 .then）在卸载后不执行 */
      return () => {
        disposed = true
        dispose3D()
      }
    } else {
      /* ===== CSS 电影级降级（无 WebGL） ===== */
      const cssT0 = performance.now()
      const cssTick = (now: number) => {
        if (disposed) return
        const t = (now - cssT0) / 1000
        notifyPhase(t)
        bootRef.current?.classList.toggle('on', t >= 0.4 && t < 2.0)
        detectRef.current?.classList.toggle('on', t >= 2.0 && t < 4.0)
        lockRef.current?.classList.toggle('on', t >= 4.0 && t < 5.6)
        logoRef.current?.classList.toggle('on', t >= 5.6)
        enterRef.current?.classList.toggle('on', t >= 6.6)
        if (flashRef.current && t >= 5.2 && t < 5.8) flashRef.current.style.opacity = String(0.8 * Math.sin(seg(t, 5.2, 5.8) * Math.PI))
        if (t >= TOTAL - 0.6) skip()
        else requestAnimationFrame(cssTick)
      }
      requestAnimationFrame(cssTick)
      return () => { disposed = true }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDone])

  return (
    <div ref={overlayRef} className="boot-overlay">
      <canvas ref={canvasRef} className="boot-canvas" />

      {/* 阶段标签（左上） */}
      <div ref={phaseRef} className="boot-phase">PHASE // BOOT</div>

      {/* WAKE 终端 */}
      <div ref={bootRef} className="boot-terminal">
        <div>SYSTEM BOOT</div>
        <div className="dim">XUANCE CORE — INITIALIZING...</div>
        <div className="dim line">OPTICAL ENGINE ........ ONLINE</div>
        <div className="dim line">SPATIAL ENGINE ........ ONLINE</div>
        <div className="dim line">IMAGE CORE ............ ONLINE</div>
        <div className="dim line">IP DATABASE ........... ONLINE</div>
      </div>

      {/* DETECT 数据 */}
      <div ref={detectRef} className="boot-detect">
        <div className="tag">TARGET DETECTED</div>
        <div className="dim">IMAGE INPUT — 1920 × 1080</div>
        <div className="dim">SUBJECT DETECTION — <span className="ok">98.7%</span></div>
        <div className="dim">DEPTH ANALYSIS — <span className="run">PROCESSING...</span></div>
      </div>

      {/* LOCK 数据块 */}
      <div ref={lockRef} className="boot-lock">
        <div>SUBJECT : CHARACTER</div>
        <div>TYPE : IP ASSET</div>
        <div>DEPTH : 3.84m</div>
        <div>CONFIDENCE : 98.7%</div>
        <div className="ok">STATUS : VERIFIED</div>
      </div>

      {/* LOGO（数据线重建） */}
      <div ref={logoRef} className="boot-logo">
        <div className="boot-logo-title">玄 策</div>
        <div className="boot-logo-sub">XUANCE // IP INTELLIGENCE SYSTEM</div>
        <div className="boot-logo-online">SYSTEM ONLINE</div>
      </div>

      {/* ENTER */}
      <div ref={enterRef} className="boot-enter">
        <button className="boot-enter-btn" onClick={() => skipFnRef.current()}>ENTER THE IP WORLD</button>
        <div className="boot-enter-hint">CLICK TO ENTER · ESC TO SKIP</div>
      </div>

      {/* 白闪 / 胶片颗粒 / 暗角 */}
      <div ref={flashRef} className="boot-flash" />
      <div className="boot-grain" />

      {/* 诊断面板（?debug）：显示 GPU 档位 / 阶段 / 画面中心像素颜色 / 立绘与 Bloom 状态 */}
      {DEBUG && (
        <div ref={debugEl} style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 99, fontFamily: 'Consolas, monospace', fontSize: 11, lineHeight: 1.6, color: '#8fe0c0', background: 'rgba(0,0,0,0.65)', padding: '6px 10px', borderRadius: 4, pointerEvents: 'none', whiteSpace: 'pre' }} />
      )}

      <style>{`
        .boot-overlay {
          position: fixed; inset: 0; z-index: 9999;
          background: #0c0b0a;
          overflow: hidden; user-select: none; cursor: pointer;
        }
        .boot-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }

        /* ---- 通用 mono 微排印 ---- */
        .boot-overlay .dim { opacity: 0.62; }
        .boot-overlay .ok { color: #6fe0c0; }
        .boot-overlay .run { color: #d9a845; }
        .boot-overlay [class*='boot-']:not(.boot-canvas):not(.boot-overlay) {
          font-family: 'IBM Plex Mono', 'JetBrains Mono', Consolas, monospace;
          letter-spacing: 0.12em;
          pointer-events: none;
        }
        .boot-overlay [class*='boot-'].on { opacity: 1; }

        .boot-phase {
          position: absolute; left: 26px; top: 24px;
          font-size: 0.5625rem; color: rgba(217,168,69,0.55);
          opacity: 0.6; transition: opacity 0.4s;
        }

        /* WAKE 终端（左上）—— 暖白文字，避免淡蓝氛围 */
        .boot-terminal {
          position: absolute; left: 30px; top: 56px;
          font-size: 0.5625rem; line-height: 1.9; color: rgba(232,215,180,0.85);
          opacity: 0; transition: opacity 0.5s;
        }
        .boot-terminal .line { color: rgba(200,180,150,0.7); }

        /* DETECT（右下） */
        .boot-detect {
          position: absolute; right: 34px; bottom: 96px; text-align: right;
          font-size: 0.5625rem; line-height: 2; color: rgba(232,215,180,0.8);
          opacity: 0; transition: opacity 0.5s;
        }
        .boot-detect .tag { color: #d9a845; letter-spacing: 0.2em; }

        /* LOCK 数据块（右侧） */
        .boot-lock {
          position: absolute; right: 34px; top: 50%;
          transform: translateY(-50%);
          font-size: 0.5625rem; line-height: 2.1; color: rgba(232,215,180,0.82);
          opacity: 0; transition: opacity 0.5s;
          border-left: 1px solid rgba(217,168,69,0.35); padding-left: 14px;
        }

        /* LOGO（数据线重建） */
        .boot-logo {
          position: absolute; left: 0; right: 0; top: 42%;
          text-align: center; opacity: 0; transition: opacity 0.9s;
        }
        .boot-logo-title {
          display: inline-block;
          font-family: 'Noto Serif SC', serif; font-size: 3.2rem; font-weight: 900;
          letter-spacing: 0.32em; text-indent: 0.32em;
          color: #E8E0CF;
          text-shadow: 0 0 34px rgba(111,195,232,0.35), 0 2px 3px rgba(0,0,0,0.6);
          background: linear-gradient(100deg, transparent 30%, rgba(111,195,232,0.35) 50%, transparent 70%) no-repeat;
          background-size: 220% 100%;
          -webkit-background-clip: text; background-clip: text;
          animation: bootLogoScan 2.2s ease-out forwards;
        }
        @keyframes bootLogoScan {
          0% { background-position: 130% 0; }
          100% { background-position: -60% 0; }
        }
        .boot-logo-sub {
          margin-top: 16px; font-size: 0.625rem; letter-spacing: 0.42em;
          color: rgba(150,210,245,0.6);
        }
        .boot-logo-online {
          margin-top: 22px; font-size: 0.5625rem; letter-spacing: 0.3em;
          color: #6fe0c0;
          animation: bootBlink 1.6s steps(1) infinite;
        }
        @keyframes bootBlink { 0%, 62% { opacity: 1; } 63%, 100% { opacity: 0.35; } }

        /* ENTER */
        .boot-enter {
          position: absolute; left: 0; right: 0; bottom: 18%;
          text-align: center; opacity: 0; transition: opacity 0.8s;
        }
        .boot-enter-btn {
          background: transparent; color: #cfeaff;
          border: 1px solid rgba(87,196,232,0.45);
          padding: 12px 42px; font-size: 0.6875rem; letter-spacing: 0.3em;
          font-family: 'IBM Plex Mono', Consolas, monospace;
          cursor: pointer; position: relative; overflow: hidden;
          transition: all 0.4s ease; pointer-events: auto;
        }
        .boot-enter-btn::before {
          content: ''; position: absolute; left: 0; right: 0; height: 2px; top: 0;
          background: linear-gradient(90deg, transparent, #57c4e8, transparent);
          animation: bootBtnScan 2s linear infinite;
        }
        @keyframes bootBtnScan { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        .boot-enter-btn:hover {
          border-color: #57c4e8; color: #fff;
          box-shadow: 0 0 26px rgba(87,196,232,0.35);
        }
        .boot-enter-hint {
          margin-top: 14px; font-size: 0.5rem; letter-spacing: 0.24em;
          color: rgba(150,210,245,0.35);
        }

        /* 白闪 / 颗粒 / 暗角 */
        .boot-flash {
          position: absolute; inset: 0; background: #eaf6ff;
          opacity: 0; pointer-events: none; z-index: 5;
        }
        .boot-grain {
          position: absolute; inset: 0; pointer-events: none; z-index: 6;
          opacity: 0.5; mix-blend-mode: overlay;
          /* 去色关键：feTurbulence fractalNoise 是彩色噪声（偏蓝绿），overlay 混合会让
           * 整个画面蒙上淡蓝绿颗粒雾 —— grayscale(1) 只留颗粒质感，不再染色 */
          filter: grayscale(1);
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E");
        }
      `}</style>
    </div>
  )
}
