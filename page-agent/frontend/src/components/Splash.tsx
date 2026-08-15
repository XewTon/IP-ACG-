/*
 * 玄策 · 开启动画 —— 卫庄立绘粒子向心聚形 → 空间显影（GPU 粒子版）
 * 时间轴：
 *   INIT (0-1.2s)       科技启动：旋转环 + 数据流 + HUD 脉冲 + 网格光点
 *   CONVERGE (1.2-4.6s) 20 万粒子自远处螺旋聚形（easeOutQuart 全程可感）
 *   REASSEMBLY (4.7-6.1s) 前景立绘扫描显影：粒子保留在前层形成空间层次
 *   RECONSTRUCTED (6.1-7.4s) 视差呼吸：粒子层(z 0~1.05)与立绘(z 0)深度分离
 * 氛围：强科技风 —— 透视网格 / 远景天际线 / 星点 / 四角 HUD / 扫描线
 * 粒子状态全部驻留 GPU 纹理（fbalda/particle-logo 式 transform-feedback 物理）
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { buildSplashCloud } from '../lib/pointcloud'
import { makeRenderer, frameLoop } from '../lib/threeUtils'
import { GpuSplash } from '../lib/gpuSplash'
import Seal from './Seal'

const IMG = '/splash_figure.png'
const INIT_DUR = 1.2
const CONVERGE_DUR = 3.4
const REVEAL_DUR = 1.4
const HOLD = 1.3

/* 软渲染（SwiftShader/llvmpipe 等）光栅化 birds 几何（每粒子 3 三角形）极慢 → 自动降粒子数 */
function detectSoftRenderer(): boolean {
  try {
    const c = document.createElement('canvas')
    const gl = (c.getContext('webgl') || c.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (!gl) return true
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : ''
    return /swiftshader|software|llvmpipe|mesa/i.test(name)
  } catch {
    return true
  }
}
const PARTICLE_TARGET = detectSoftRenderer() ? 60000 : 150000

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4)
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/* 前景显影 shader：透明立绘 plane + 亮度浮雕视差 + 扫描显影 + 前缘金光 */
const revealVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const revealFragment = /* glsl */ `
  uniform sampler2D uTex;
  uniform float uReveal;
  uniform float uTime;
  uniform float uFade; // 显影完成后淡出（1 → 0），最终人物由粒子构成
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec2 uv = vUv;
    // 亮度浮雕：局部梯度 → uv 微偏移，立绘有立体起伏而非平贴
    float lum  = dot(texture2D(uTex, uv).rgb, vec3(0.299, 0.587, 0.114));
    float lumL = dot(texture2D(uTex, uv + vec2(-0.0015, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
    float lumU = dot(texture2D(uTex, uv + vec2(0.0, -0.0015)).rgb, vec3(0.299, 0.587, 0.114));
    uv += vec2(lum - lumL, lum - lumU) * 2.4 * uReveal;
    // 呼吸：显影完成后轻微浮动
    uv += vec2(sin(uTime * 0.45) * 0.0012, cos(uTime * 0.37) * 0.0012) * uReveal;
    vec4 tex = texture2D(uTex, uv);
    // 扫描显影：自上而下
    float revealed = uReveal * 1.08 - 0.04;
    float s = 1.0 - vUv.y;
    float alpha = 1.0 - smoothstep(revealed - 0.02, revealed + 0.02, s);
    // 前缘金色光带
    float edge = smoothstep(revealed - 0.16, revealed - 0.02, s) * (1.0 - alpha);
    vec3 col = tex.rgb + edge * vec3(0.85, 0.66, 0.27) * 0.35;
    // 不规则边缘融入：uv 外围 22% 渐隐 + 噪声扰动边界（消除矩形贴图感，放大时自然化入粒子云）
    float fadeX = smoothstep(0.0, 0.22, vUv.x) * smoothstep(1.0, 0.78, vUv.x);
    float fadeY = smoothstep(0.0, 0.22, vUv.y) * smoothstep(1.0, 0.78, vUv.y);
    float nEdge = hash(vUv * 9.13);
    float edgeFade = clamp(fadeX * fadeY + (nEdge - 0.5) * 0.4, 0.0, 1.0);
    // 同色调微噪点（与粒子质感趋同，破除"图片感"）
    float nGrain = hash(vUv * 131.7 + uTime * 0.7);
    col += (nGrain - 0.5) * 0.04 * tex.a;
    // 半透明融入 + 显影后淡出（最终人物由纯粒子构成）
    gl_FragColor = vec4(col, tex.a * alpha * edgeFade * 0.78 * uFade);
  }
`

export default function Splash({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const brandRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const phaseRef = useRef<HTMLSpanElement>(null)
  const dataTimeRef = useRef<HTMLSpanElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef(false)
  const [ready, setReady] = useState(false)

  /* 数据流：INIT 阶段流动的金色数据点（横向轨迹） */
  const streams = useMemo(() => {
    const rng = mulberry32(11)
    return Array.from({ length: 26 }).map(() => ({
      top: rng() * 100,
      dur: 1.6 + rng() * 2.4,
      delay: -rng() * 4,
      len: 8 + rng() * 18,
      gold: rng() < 0.4,
    }))
  }, [])

  /* 终端 boot 日志流（Terminal Boot 范式）：逐行打印系统自检 */
  const bootLog = useMemo(() => [
    '> XUANCE-01 KERNEL v2.4.1',
    '> GPU PARTICLE GRID ....... OK',
    '> MESH STREAM 200,000 PTS . OK',
    '> HOLOGRAIN PALETTE ....... OK',
    '> CINNABAR HOTZONE ........ DETECTED',
    '> GOLD HOTZONE ............ DETECTED',
    '> DEPTH FIELD CALIBRATION . OK',
    '> CONVERGENCE ENGINE ....... READY',
  ], [])

  /* 星点：背景纵深 */
  const stars = useMemo(() => {
    const rng = mulberry32(23)
    return Array.from({ length: 40 }).map(() => ({
      left: rng() * 100,
      top: rng() * 100,
      size: rng() < 0.5 ? 1 : 2,
      gold: rng() < 0.35,
    }))
  }, [])

  const dust = useMemo(() => {
    const rng = mulberry32(7)
    return Array.from({ length: 60 }).map(() => ({
      left: rng() * 100,
      top: rng() * 100,
      size: 1 + rng() * 1.6,
      dur: 3 + rng() * 5,
      delay: -rng() * 6,
      dx: (rng() - 0.5) * 30,
      dy: -(4 + rng() * 18),
    }))
  }, [])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onDone()
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = makeRenderer(canvas)
    } catch {
      // WebGL 首次初始化失败（GPU 进程未就绪等）：降级播放 CSS 动画，
      // 不跳过整段动画 —— INIT 环/网格/雷达照常动，3.4s 后自然结束
      const end = () => { if (disposed || doneRef.current) return; onDone() }
      window.setTimeout(end, 3400)
      return
    }
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50)
    camera.position.set(0, 0, 3.4)
    camera.lookAt(0, 0, 0.7)

    // 泛光后处理
    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(canvas.clientWidth, canvas.clientHeight),
      0.12,  // strength
      0.35,  // radius
      0.85,  // threshold
    )
    composer.addPass(bloom)
    composer.addPass(new OutputPass())

    let splash: GpuSplash | null = null
    let revealMat: THREE.ShaderMaterial | null = null
    const t0 = performance.now()
    let convergeStart = -1
    let finished = false
    let disposed = false
    let brandShown = false
    let initDone = false

    const finish = () => {
      if (doneRef.current) return
      doneRef.current = true
      onDone()
    }
    const skip = () => {
      if (doneRef.current || finished) return
      finished = true
      const el = overlayRef.current
      if (el) {
        el.style.transition = 'opacity 0.4s ease'
        el.style.opacity = '0'
      }
      window.setTimeout(finish, 450)
    }
    const onPointer = () => skip()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ') skip()
    }
    const ov = overlayRef.current
    ov?.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)

    buildSplashCloud(IMG, PARTICLE_TARGET)
      .then((pc) => {
        if (disposed) return
        if (!pc.sourceColors || !pc.hotFlags) throw new Error('missing gpu data')
        splash = new GpuSplash(renderer, {
          positions: pc.positions,
          sourceColors: pc.sourceColors,
          hotFlags: pc.hotFlags,
          aspect: pc.aspect,
        }, scene)
        // 前景显影层：透明立绘 plane（z=0，粒子 z∈[0,1.05] 在其前方 → 视差层次）
        if (pc.foreground) {
          const tex = new THREE.CanvasTexture(pc.foreground)
          tex.colorSpace = THREE.SRGBColorSpace
          tex.anisotropy = 8
          revealMat = new THREE.ShaderMaterial({
            uniforms: {
              uTex: { value: tex },
              uReveal: { value: 0 },
              uFade: { value: 1 },
              uTime: { value: 0 },
            },
            vertexShader: revealVertex,
            fragmentShader: revealFragment,
            transparent: true,
            depthWrite: false,
            depthTest: false,
          })
          const plane = new THREE.Mesh(
            new THREE.PlaneGeometry(pc.aspect * 2, 2),
            revealMat,
          )
          plane.renderOrder = 1
          scene.add(plane)
        }
        camera.lookAt(0, 0, 0.7)
        // INIT 阶段：让科技启动动效先行，粒子随后开始聚形
        convergeStart = Math.max(INIT_DUR, (performance.now() - t0) / 1000 + 0.12)
        setReady(true)
      })
      .catch((e) => {
        console.error('[splash] GPU splash init failed:', e)
        if (disposed) return
        // 首次失败（图片/GPU 冷启动）：重试一次；仍失败则降级播放 CSS 动画后结束
        buildSplashCloud(IMG, PARTICLE_TARGET)
          .then((pc) => {
            if (disposed) return
            if (!pc.sourceColors || !pc.hotFlags) throw new Error('missing gpu data')
            splash = new GpuSplash(renderer, {
              positions: pc.positions,
              sourceColors: pc.sourceColors,
              hotFlags: pc.hotFlags,
              aspect: pc.aspect,
            }, scene)
            if (pc.foreground) {
              const tex = new THREE.CanvasTexture(pc.foreground)
              tex.colorSpace = THREE.SRGBColorSpace
              tex.anisotropy = 8
              revealMat = new THREE.ShaderMaterial({
                uniforms: { uTex: { value: tex }, uReveal: { value: 0 }, uTime: { value: 0 }, uFade: { value: 1 } },
                vertexShader: revealVertex,
                fragmentShader: revealFragment,
                transparent: true,
                depthWrite: false,
                depthTest: false,
              })
              const plane = new THREE.Mesh(new THREE.PlaneGeometry(pc.aspect * 2, 2), revealMat)
              plane.renderOrder = 1
              scene.add(plane)
            }
            camera.lookAt(0, 0, 0.7)
            convergeStart = Math.max(INIT_DUR, (performance.now() - t0) / 1000 + 0.12)
            setReady(true)
          })
          .catch((e2) => {
            console.error('[splash] retry failed, degraded CSS mode:', e2)
            if (disposed) return
            // 降级：CSS 动画（环/网格/雷达）继续播放，4.5s 后自然结束
            const el = overlayRef.current
            if (el && !disposed) {
              el.style.transition = 'opacity 0.5s ease'
              window.setTimeout(() => { if (!disposed) el.style.opacity = '0' }, 4000)
              window.setTimeout(() => { if (!disposed) finish() }, 4500)
            } else if (!disposed) {
              finish()
            }
          })
      })

    const onResize = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (w === 0 || h === 0) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      composer.setSize(w, h)
      bloom.setSize(w, h)
    }
    onResize()

    let last = performance.now()
    const unLoop = frameLoop(() => {
      const now = performance.now()
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const tt = (now - t0) / 1000

      // INIT 阶段：旋转环淡出（粒子开始聚形时）
      if (!initDone && convergeStart > 0) {
        initDone = true
        if (ringRef.current) ringRef.current.style.opacity = '0'
      }

      if (splash && convergeStart > 0) {
        const C = CONVERGE_DUR
        const end = convergeStart + C
        const r0 = end + 0.15
        const rend = r0 + REVEAL_DUR
        const prog = easeOutQuart(clamp01((tt - convergeStart) / C))
        // 显影进度
        const r = clamp01((tt - r0) / REVEAL_DUR)
        if (revealMat) {
          revealMat.uniforms.uReveal.value = r
          revealMat.uniforms.uTime.value = tt
        }
        const settle = clamp01((tt - convergeStart) / 0.25)
        // 立绘显影完成后淡出（0.8s），最终人物由纯粒子构成（birds 翼形粒子）
        const fadeOut = 1 - clamp01((r - 0.92) / 0.08)
        if (revealMat) revealMat.uniforms.uFade.value = fadeOut
        // 粒子层：散开 0.85 → 成形 0.5（plane 淡出后粒子承担人物呈现）
        splash.setOpacity(settle * (0.85 - 0.35 * r))
        splash.setGlowOpacity(0.35 * settle * (1 - 0.6 * r))
        // 镜头推进：3.55 → 2.75
        camera.position.z = 3.55 - 0.8 * easeInOutCubic(clamp01((tt - convergeStart) / (C * 0.7)))
        // 聚拢微旋 + 显影后视差摆动（粒子层与 plane 层深度分离 → 立体空间感）
        camera.position.y = Math.sin(tt * 0.8) * 0.06 * (1 - prog) + Math.sin(tt * 0.31) * 0.05 * r
        camera.position.x = Math.sin(tt * 0.45) * 0.17 * r
        camera.lookAt(0, 0, 0.7)
        if (tt < end) {
          splash.update(prog, dt, tt)
        } else {
          splash.update(1, dt, tt)
        }
        // HUD 读数
        if (phaseRef.current) {
          if (tt < convergeStart) phaseRef.current.textContent = 'SYSTEM BOOT'
          else if (r <= 0) phaseRef.current.textContent = `CONVERGE ${Math.round(prog * 100)}%`
          else if (r < 1) phaseRef.current.textContent = `REASSEMBLY ${Math.round(r * 100)}%`
          else phaseRef.current.textContent = 'RECONSTRUCTED'
        }
        // 落款：显影开始 0.5s 后浮现
        if (brandRef.current && !finished && tt >= r0 + 0.5) {
          if (!brandShown) {
            brandShown = true
            brandRef.current.style.opacity = '1'
            const chars = brandRef.current.querySelectorAll<HTMLElement>('.splash-brand-char')
            chars.forEach((el, i) => {
              window.setTimeout(() => {
                el.style.opacity = '1'
                el.style.transform = 'none'
              }, i * 200)
            })
            const sealEl = brandRef.current.querySelector<HTMLElement>('.splash-seal')
            if (sealEl) window.setTimeout(() => sealEl.classList.add('show'), chars.length * 200 + 140)
          }
          if (hintRef.current) hintRef.current.style.opacity = '0'
        }
        // 底部进度条（INIT + 聚形 + 显影）
        if (progressRef.current) {
          progressRef.current.style.width = `${(clamp01((tt - INIT_DUR) / (C + REVEAL_DUR + 0.6)) * 100).toFixed(1)}%`
        }
        if (dataTimeRef.current) dataTimeRef.current.textContent = `T+${tt.toFixed(2)}s`
        if (!finished && tt >= rend + HOLD) skip()
      }
      // ?raw 调试：跳过后处理直渲，定位 bloom/composer 管线问题
      if (new URLSearchParams(location.search).has('raw')) renderer.render(scene, camera)
      else composer.render()
    })

    return () => {
      disposed = true
      unLoop()
      ov?.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
      if (splash) splash.dispose()
      if (revealMat) {
        ;(revealMat.uniforms.uTex.value as THREE.Texture).dispose()
        revealMat.dispose()
      }
      composer.dispose()
      renderer.dispose()
    }
  }, [onDone])

  return (
    <div ref={overlayRef} className="splash-overlay">
      {/* 远景：天际线剪影（青色科技感） */}
      <div className="splash-skyline" />
      {/* 星点 */}
      <div className="splash-stars">
        {stars.map((s, i) => (
          <span
            key={i}
            className={`splash-star${s.gold ? ' splash-star-gold' : ''}`}
            style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size }}
          />
        ))}
      </div>
      {/* 透视网格（青色科技底） */}
      <div className="splash-grid" />
      {/* 光栅微纹理 */}
      <div className="splash-scanlines" />
      {/* 扫描亮线 */}
      <div className="splash-scanbar" />
      {/* INIT 旋转环（数据启动） */}
      <div ref={ringRef} className="splash-ring">
        <div className="splash-ring-inner" />
      </div>
      {/* 终端 boot 日志流（左上角） */}
      <div className="splash-boot">
        {bootLog.map((line, i) => (
          <span key={i} className="splash-boot-line" style={{ animationDelay: `${0.1 + i * 0.12}s` }}>{line}</span>
        ))}
      </div>
      {/* 雷达环扫描（右上角） */}
      <div className="splash-radar">
        <div className="splash-radar-rings" />
        <div className="splash-radar-sweep" />
        <div className="splash-radar-cross" />
        <div className="splash-radar-dot" />
        <span className="splash-radar-label">SCAN // CORE</span>
      </div>
      {/* 四角 HUD */}
      <div className="splash-hud">
        <span className="splash-hud-corner splash-hud-tl" />
        <span className="splash-hud-corner splash-hud-tr" />
        <span className="splash-hud-corner splash-hud-bl" />
        <span className="splash-hud-corner splash-hud-br" />
        <span className="splash-hud-label splash-hud-label-tl">XUANCE-01 // AI OPS</span>
        <span className="splash-hud-label splash-hud-label-tr">LAT 39.9N · LON 116.4E</span>
        <span className="splash-hud-label splash-hud-label-bl">SYS.INIT v2.4</span>
        <span className="splash-hud-data">
          <span ref={phaseRef}>SYSTEM BOOT</span> · <span ref={dataTimeRef}>T+0.00s</span> · PARTICLES {PARTICLE_TARGET.toLocaleString('en-US')}
        </span>
      </div>
      {/* 数据流（INIT 阶段横向流动的金色数据点） */}
      <div className="splash-streams">
        {streams.map((s, i) => (
          <span
            key={i}
            className={`splash-stream${s.gold ? ' splash-stream-gold' : ''}`}
            style={{
              top: `${s.top}%`,
              width: s.len,
              animationDuration: `${s.dur}s`,
              animationDelay: `${s.delay}s`,
            }}
          />
        ))}
      </div>
      <div className="splash-vignette" />
      <div className="splash-dust">
        {dust.map((d, i) => (
          <span
            key={i}
            className="splash-dust-dot"
            style={{
              left: `${d.left}%`,
              top: `${d.top}%`,
              width: d.size,
              height: d.size,
              animationDuration: `${d.dur}s`,
              animationDelay: `${d.delay}s`,
              ['--dx' as string]: `${d.dx}px`,
              ['--dy' as string]: `${d.dy}px`,
            }}
          />
        ))}
      </div>
      <canvas ref={canvasRef} className="splash-canvas" />
      <div ref={brandRef} className="splash-brand">
        <span className="splash-brand-name">
          {'玄策'.split('').map((ch, i) => (
            <span key={i} className="splash-brand-char">{ch}</span>
          ))}
        </span>
        <span className="splash-brand-sub">
          <span>XUANCE // AI OPS CENTER</span>
          <span className="splash-cursor" />
        </span>
        <span className="splash-seal"><Seal text="玄机" type="yin" shape="circle" size={42} seed={9} /></span>
      </div>
      <div ref={hintRef} className="splash-hint">{ready ? 'CLICK TO SKIP' : 'SYS.INIT // LOADING'}</div>
      <div className="splash-progress"><div ref={progressRef} className="splash-progress-fill" /></div>
      <style>{`
        .splash-overlay {
          position: fixed; inset: 0; z-index: 9999;
          background:
            radial-gradient(ellipse 60% 42% at 50% 40%, #2C3A57 0%, transparent 70%),
            radial-gradient(ellipse at 50% 100%, #22304C 0%, transparent 55%),
            linear-gradient(180deg, #1E2941 0%, #1B2337 55%, #161D2E 100%);
          overflow: hidden; user-select: none;
        }
        .splash-vignette {
          position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(ellipse at 50% 45%, transparent 50%, rgba(0,0,0,0.24) 100%);
        }
        .splash-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }

        /* ---- 远景天际线（青色剪影，背景层次远端） ---- */
        .splash-skyline {
          position: absolute; left: 0; right: 0; bottom: 0; height: 30%;
          pointer-events: none; opacity: 0.9;
          background:
            linear-gradient(178deg, transparent 52%, rgba(91,140,158,0.12) 55%, rgba(91,140,158,0.20) 100%),
            linear-gradient(184deg, transparent 70%, rgba(42,52,74,0.20) 73%, rgba(42,52,74,0.30) 100%);
        }
        /* 星点 */
        .splash-stars { position: absolute; inset: 0; pointer-events: none; }
        .splash-star {
          position: absolute; border-radius: 50%;
          background: rgba(91,140,158,0.75);
          animation: splashTwinkle 3.4s ease-in-out infinite;
        }
        .splash-star-gold { background: rgba(217,168,69,0.75); }
        @keyframes splashTwinkle {
          0%, 100% { opacity: 0.15; }
          50%      { opacity: 0.7; }
        }

        /* ---- 透视网格（中景） ---- */
        .splash-grid {
          position: absolute; left: -30%; right: -30%; top: -10%; bottom: 0;
          pointer-events: none;
          background:
            linear-gradient(rgba(91,140,158,0.20) 1px, transparent 1px),
            linear-gradient(90deg, rgba(91,140,158,0.20) 1px, transparent 1px);
          background-size: 52px 52px;
          transform: perspective(560px) rotateX(62deg);
          transform-origin: 50% 100%;
          -webkit-mask-image: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.75) 66%);
                  mask-image: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.75) 66%);
          animation: gridFlow 2.6s linear infinite;
        }
        @keyframes gridFlow {
          0%   { background-position: 0 0, 0 0; }
          100% { background-position: 0 52px, 0 52px; }
        }

        /* ---- 终端 boot 日志流（左上角，逐行打印） ---- */
        .splash-boot {
          position: absolute; left: 80px; top: 78px;
          display: flex; flex-direction: column; gap: 3px;
          pointer-events: none; z-index: 3;
        }
        .splash-boot-line {
          font-family: 'Source Code Pro', Consolas, monospace;
          font-size: 0.5625rem; letter-spacing: 0.1em;
          color: rgba(91,201,232,0.72);
          text-shadow: 0 0 8px rgba(91,201,232,0.35);
          opacity: 0;
          animation: bootLine 3.2s linear forwards;
        }
        @keyframes bootLine {
          0%   { opacity: 0; }
          8%   { opacity: 1; }
          82%  { opacity: 1; }
          100% { opacity: 0; }
        }

        /* ---- 雷达环扫描（右上角） ---- */
        .splash-radar {
          position: absolute; top: 66px; right: 74px;
          width: 110px; height: 110px;
          pointer-events: none; z-index: 3;
        }
        .splash-radar-rings {
          position: absolute; inset: 0;
          border: 1px solid rgba(91,201,232,0.35);
          border-radius: 50%;
        }
        .splash-radar-rings::before {
          content: ''; position: absolute; inset: 21px;
          border: 1px solid rgba(91,201,232,0.22);
          border-radius: 50%;
        }
        .splash-radar-rings::after {
          content: ''; position: absolute; inset: 43px;
          border: 1px solid rgba(91,201,232,0.18);
          border-radius: 50%;
        }
        .splash-radar-sweep {
          position: absolute; inset: 0;
          border-radius: 50%;
          background: conic-gradient(from 0deg, rgba(91,201,232,0.55) 0deg, rgba(91,201,232,0.16) 42deg, transparent 78deg);
          animation: radarSpin 2.4s linear infinite;
        }
        @keyframes radarSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .splash-radar-cross {
          position: absolute; inset: 0;
          background:
            linear-gradient(rgba(91,201,232,0.28) 1px, transparent 1px),
            linear-gradient(90deg, rgba(91,201,232,0.28) 1px, transparent 1px);
          background-position: center;
          background-size: 100% 1px, 1px 100%;
          background-repeat: no-repeat;
        }
        .splash-radar-dot {
          position: absolute; left: 50%; top: 50%;
          width: 5px; height: 5px; margin: -2.5px 0 0 -2.5px;
          border-radius: 50%;
          background: #D9A845;
          box-shadow: 0 0 10px rgba(217,168,69,0.9);
        }
        .splash-radar-label {
          position: absolute; left: 50%; top: 118px;
          transform: translateX(-50%);
          font-family: 'Source Code Pro', Consolas, monospace;
          font-size: 0.5625rem; letter-spacing: 0.2em;
          color: rgba(91,201,232,0.6);
          white-space: nowrap;
        }

        .splash-scanlines {
          position: absolute; inset: 0; pointer-events: none; opacity: 0.5;
          background: repeating-linear-gradient(180deg, rgba(255,255,255,0.022) 0 1px, transparent 1px 3px);
        }
        .splash-scanbar {
          position: absolute; left: 0; right: 0; height: 130px; pointer-events: none;
          background: linear-gradient(180deg, transparent, rgba(91,140,158,0.10), transparent);
          animation: splashScanbar 4.5s linear infinite;
        }
        @keyframes splashScanbar { 0% { top: -18%; } 100% { top: 105%; } }

        /* ---- INIT 旋转环 ---- */
        .splash-ring {
          position: absolute; left: 50%; top: 43%;
          width: 360px; height: 360px;
          transform: translate(-50%, -50%);
          pointer-events: none;
          border: 1px solid rgba(91,140,158,0.28);
          border-radius: 50%;
          animation: ringSpin 14s linear infinite;
          transition: opacity 0.9s ease;
        }
        .splash-ring::before {
          content: ''; position: absolute; top: -3px; left: 50%;
          width: 6px; height: 6px; border-radius: 50%;
          background: #D9A845; box-shadow: 0 0 14px rgba(217,168,69,0.95);
        }
        .splash-ring::after {
          content: ''; position: absolute; inset: 12px;
          border: 1px dashed rgba(217,168,69,0.22);
          border-radius: 50%;
          animation: ringSpin 9s linear infinite reverse;
        }
        .splash-ring-inner {
          position: absolute; inset: 56px;
          border: 1px solid rgba(91,140,158,0.2);
          border-radius: 50%;
        }
        @keyframes ringSpin { from { transform: translate(-50%, -50%) rotate(0deg); } to { transform: translate(-50%, -50%) rotate(360deg); } }

        /* ---- 四角 HUD ---- */
        .splash-hud { position: absolute; inset: 0; pointer-events: none; }
        .splash-hud-corner {
          position: absolute; width: 54px; height: 54px;
          border: 1px solid rgba(217,168,69,0.5);
          animation: hudPulse 2.2s ease-in-out infinite;
        }
        @keyframes hudPulse {
          0%, 100% { border-color: rgba(217,168,69,0.22); }
          50%      { border-color: rgba(217,168,69,0.62); }
        }
        .splash-hud-tl { top: 16px; left: 16px; border-right: none; border-bottom: none; }
        .splash-hud-tr { top: 16px; right: 16px; border-left: none; border-bottom: none; }
        .splash-hud-bl { bottom: 16px; left: 16px; border-right: none; border-top: none; }
        .splash-hud-br { bottom: 16px; right: 16px; border-left: none; border-top: none; }
        .splash-hud-label {
          position: absolute;
          font-family: 'Source Code Pro', Consolas, monospace;
          font-size: 0.5625rem; letter-spacing: 0.18em;
          color: rgba(91,140,158,0.85);
        }
        .splash-hud-label-tl { top: 22px; left: 80px; }
        .splash-hud-label-tr { top: 22px; right: 80px; }
        .splash-hud-label-bl { bottom: 22px; left: 80px; }
        .splash-hud-data {
          position: absolute; bottom: 22px; right: 80px;
          font-family: 'Source Code Pro', Consolas, monospace;
          font-size: 0.5625rem; letter-spacing: 0.14em;
          color: rgba(217,168,69,0.8);
        }

        /* ---- 数据流（INIT 启动动效） ---- */
        .splash-streams { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
        .splash-stream {
          position: absolute; right: 0; height: 1px;
          background: linear-gradient(270deg, rgba(91,140,158,0.7), transparent);
          animation: streamFlow linear infinite;
          opacity: 0;
        }
        .splash-stream-gold {
          background: linear-gradient(270deg, rgba(217,168,69,0.8), transparent);
          height: 2px;
        }
        @keyframes streamFlow {
          0%   { transform: translateX(0); opacity: 0; }
          15%  { opacity: 1; }
          100% { transform: translateX(60vw); opacity: 0; }
        }

        /* ---- 尘埃粒子 ---- */
        .splash-dust { position: absolute; inset: 0; pointer-events: none; }
        .splash-dust-dot {
          position: absolute; border-radius: 50%;
          background: rgba(217,168,69,0.85);
          animation: splashDrift ease-in-out infinite alternate;
        }
        @keyframes splashDrift {
          0%   { transform: translate(0, 0); opacity: 0.06; }
          100% { transform: translate(var(--dx, 8px), var(--dy, -14px)); opacity: 0.5; }
        }

        /* ---- 落款 ---- */
        .splash-brand {
          position: absolute; left: 0; right: 0; bottom: 13%;
          text-align: center; opacity: 0;
          transition: opacity 1.1s ease; pointer-events: none;
          z-index: 6;
        }
        .splash-brand-name {
          display: block;
          font-family: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'STSong', 'SimSun', serif;
          font-size: 2.5rem; font-weight: 900;
          letter-spacing: 0.28em; text-indent: 0.28em;
          background: linear-gradient(168deg, #E8CF8A 0%, #B98A2E 34%, #F2E3B3 50%, #A87B2A 72%, #C9A96E 100%);
          -webkit-background-clip: text;
                  background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 0 12px rgba(217,168,69,0.22)) drop-shadow(0 2px 2px rgba(0,0,0,0.5));
        }
        .splash-brand-char {
          display: inline-block; opacity: 0; transform: translateY(10px);
          transition: opacity 0.55s ease, transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .splash-brand-sub {
          display: block; margin-top: 14px;
          font-family: 'Source Code Pro', Consolas, monospace;
          font-size: 0.7rem; letter-spacing: 0.35em;
          color: rgba(91,140,158,0.9);
        }
        .splash-cursor {
          display: inline-block; width: 8px; height: 0.9em;
          background: #D9A845; margin-left: 5px; vertical-align: -2px;
          animation: splashBlink 1s steps(1) infinite;
        }
        @keyframes splashBlink { 0%, 60% { opacity: 1; } 61%, 100% { opacity: 0; } }
        .splash-seal {
          display: inline-flex; margin-top: 16px;
          opacity: 0; transform: scale(0.3) rotate(-8deg);
          transition: opacity 0.25s ease, transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .splash-seal.show { opacity: 1; transform: scale(1) rotate(0deg); }

        .splash-hint {
          position: absolute; left: 18px; bottom: 14px;
          font-family: 'Source Code Pro', Consolas, monospace;
          font-size: 0.5625rem; letter-spacing: 0.2em;
          color: rgba(217,168,69,0.55);
          pointer-events: none;
          animation: splashPulse 2.4s ease-in-out infinite;
        }
        @keyframes splashPulse {
          0%, 100% { opacity: 0.35; }
          50%      { opacity: 0.85; }
        }

        /* ---- 底部进度条 ---- */
        .splash-progress {
          position: absolute; left: 18px; right: 18px; bottom: 18px;
          height: 2px; pointer-events: none;
          background: rgba(217,168,69,0.15);
        }
        .splash-progress-fill {
          height: 100%; width: 0;
          background: linear-gradient(90deg, #5B8C9E, #D9A845);
          box-shadow: 0 0 8px rgba(217,168,69,0.55);
        }
      `}</style>
    </div>
  )
}
