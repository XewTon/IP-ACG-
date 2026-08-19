/*
 * 玄策 · 开启动画 ——「水墨雨幕 × 3D 浮雕抠像」
 * 视觉：
 *   1) three.js 3D 浮雕 —— 立绘 flood-fill 抠底（透明剪影）作为贴图，
 *      亮度 → 位移贴图（buildReliefCanvas）让亮部几何鼓出，
 *      自动摇摆 + 鼠标视差强反馈 + 旋转扫光 → 转动时侧面/深度清晰可见（真 3D 感）
 *   2) codrops/RainEffect（https://github.com/codrops/RainEffect）稀疏雨幕 —— 落在 3D 立绘前方，
 *      小水珠持续淡出防堆积（避免密集恐惧）
 * 时间轴（约 4.2s）：
 *   0.0-0.8s   3D 浮雕立绘淡入
 *   0.15-2.0s  雨滴逐步开始 → 稀疏细雨
 *   1.7-2.5s   落款「玄策」浮现
 *   3.8s       淡出结束
 * 交互：点击 / 空格 / ESC 跳过；?nosplash 跳过；prefers-reduced-motion 自动跳过
 */
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { makeRenderer, frameLoop, disposeObject } from '../lib/threeUtils'
import { buildSplashCloud, buildReliefCanvas } from '../lib/pointcloud'
import { makeSoftSprite } from '../lib/softSprite'
import { createRainEffect, type RainEffect as RainFx } from '../lib/rainEffect'
import Seal from './Seal'

const IMG = '/splash_figure.webp'
const DURATION = 3.8

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
const SOFT_RENDERER = detectSoftRenderer()
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/* 雨幕折射前景：深蓝水墨底 + 立绘主体（雨滴在暗处也有折射内容） */
function makeRainSource(img: HTMLImageElement): HTMLCanvasElement {
  const W = 512
  const H = 288
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#141D30')
  g.addColorStop(0.6, '#0F1626')
  g.addColorStop(1, '#0A0F1B')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  const rg = ctx.createRadialGradient(W * 0.5, H * 0.4, 10, W * 0.5, H * 0.4, H * 0.6)
  rg.addColorStop(0, 'rgba(140,170,200,0.12)')
  rg.addColorStop(1, 'rgba(140,170,200,0)')
  ctx.fillStyle = rg
  ctx.fillRect(0, 0, W, H)
  const scale = Math.max(W / img.width, H / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh)
  return c
}

export default function Splash({ onDone }: { onDone: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const figureCanvasRef = useRef<HTMLCanvasElement>(null)
  const rainCanvasRef = useRef<HTMLCanvasElement>(null)
  const rainFxRef = useRef<RainFx | null>(null)
  const threeRef = useRef<{ dispose: () => void } | null>(null)
  const brandRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onDone()
      return
    }
    const overlay = overlayRef.current
    const figureCanvas = figureCanvasRef.current
    const rainCanvas = rainCanvasRef.current
    let disposed = false

    const finish = () => {
      if (doneRef.current) return
      doneRef.current = true
      onDone()
    }
    const skip = () => {
      if (doneRef.current) return
      if (overlay) {
        overlay.style.transition = 'opacity 0.35s ease'
        overlay.style.opacity = '0'
      }
      window.setTimeout(finish, 380)
    }
    const onPointer = () => skip()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ') skip()
    }
    overlay?.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)

    /* ============ 3D 浮雕抠像（three.js：位移几何 + 旋转扫光 + 鼠标视差） ============ */
    const pointer = { x: 0, y: 0 }
    if (figureCanvas) {
      const onPointerMove = (e: PointerEvent) => {
        pointer.x = (e.clientX / window.innerWidth) * 2 - 1
        pointer.y = (e.clientY / window.innerHeight) * 2 - 1
      }
      window.addEventListener('pointermove', onPointerMove)

      buildSplashCloud(IMG, 3000)
        .then(async (pc) => {
          if (disposed || !figureCanvas || !pc.foreground) return
          const relief = await buildReliefCanvas(IMG, 512).catch(() => null)
          if (disposed) return
          try {
            const renderer = makeRenderer(figureCanvas)
            const scene = new THREE.Scene()
            const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 20)
            camera.position.set(0, 0.14, 3.45)
            camera.lookAt(0, 0.04, 0)

            /* 打光：暖金主光 + 石青补光 + 环绕扫光（扫光划过浮雕 → 立体感随光影显现） */
            const ambient = new THREE.AmbientLight(0xc4b295, 0.5)
            scene.add(ambient)
            const key = new THREE.DirectionalLight(0xffe2c0, 1.45)
            key.position.set(2.6, 3.6, 4)
            scene.add(key)
            const fill = new THREE.DirectionalLight(0x9fb8c8, 0.65)
            fill.position.set(-3.6, -0.6, 2.6)
            scene.add(fill)
            const sweep = new THREE.DirectionalLight(0xffd9a0, 1.1)
            scene.add(sweep)

            const group = new THREE.Group()
            scene.add(group)

            /* 主体：抠像立绘贴图 + 亮度位移 → 真 3D 浮雕 */
            const tex = new THREE.CanvasTexture(pc.foreground)
            tex.colorSpace = THREE.SRGBColorSpace
            tex.anisotropy = 8
            const mat = new THREE.MeshStandardMaterial({
              map: tex,
              transparent: true,
              depthWrite: false,
              side: THREE.DoubleSide,
              roughness: 0.82,
              metalness: 0,
            })
            if (relief) {
              const rtex = new THREE.CanvasTexture(relief)
              rtex.anisotropy = 4
              mat.displacementMap = rtex
              mat.displacementScale = 0.42 // 亮部鼓出 0.42 单位（平面高 2）—— 立体幅度明显
            }
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(pc.aspect * 2, 2, 140, 280), mat)
            group.add(mesh)

            /* 稀疏浮尘（氛围点缀，密度极低，避免密集感） */
            const dustSprite = makeSoftSprite()
            const dustGeo = new THREE.BufferGeometry()
            const dustN = 36
            const dpos = new Float32Array(dustN * 3)
            for (let i = 0; i < dustN; i++) {
              dpos[i * 3] = (Math.random() - 0.5) * (pc.aspect * 2 + 1.4)
              dpos[i * 3 + 1] = (Math.random() - 0.5) * 2.4
              dpos[i * 3 + 2] = (Math.random() - 0.5) * 1.2
            }
            dustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3))
            const dustMat = new THREE.PointsMaterial({
              map: dustSprite,
              color: 0x9fc4d8,
              size: 0.05,
              transparent: true,
              opacity: 0.35,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
              sizeAttenuation: true,
            })
            const dust = new THREE.Points(dustGeo, dustMat)
            scene.add(dust)

            const onResize = () => {
              const cw = figureCanvas.clientWidth
              const ch = figureCanvas.clientHeight
              if (!cw || !ch) return
              renderer.setSize(cw, ch, false)
              camera.aspect = cw / ch
              camera.updateProjectionMatrix()
            }
            onResize()
            window.addEventListener('resize', onResize)

            let last = performance.now()
            const unLoop = frameLoop((now) => {
              const dt = Math.min(0.05, (now - last) / 1000)
              last = now
              const t = now / 1000
              // 自动摇摆 + 鼠标视差（强反馈：转动幅度大，侧脸/轮廓深度清晰可见）
              const k = 1 - Math.pow(0.0025, dt)
              group.rotation.y += (Math.sin(t * 0.45) * 0.3 + pointer.x * 0.38 - group.rotation.y) * k
              group.rotation.x += (-pointer.y * 0.24 - group.rotation.x) * k
              group.position.y = Math.sin(t * 0.5) * 0.03
              // 扫光环绕（划过浮雕 → 光影移动强化立体）
              sweep.position.set(Math.sin(t * 0.55) * 3.6, 0.8, 1.6 + Math.cos(t * 0.55) * 2.2)
              // 浮尘缓旋
              dust.rotation.y = t * 0.02
              renderer.render(scene, camera)
            })

            threeRef.current = {
              dispose: () => {
                unLoop()
                window.removeEventListener('resize', onResize)
                window.removeEventListener('pointermove', onPointerMove)
                group.traverse((o) => disposeObject(o))
                dustGeo.dispose()
                dustMat.dispose()
                dustSprite.dispose()
                tex.dispose()
                if (mat.displacementMap) mat.displacementMap.dispose()
                renderer.dispose()
              },
            }
          } catch (err) {
            console.error('[splash] 3D relief init failed:', err)
          }
        })
        .catch(() => { /* 抠图失败：仅雨幕 + 文字 */ })
    }

    /* ============ 稀疏雨幕（codrops/RainEffect） ============ */
    if (rainCanvas && !SOFT_RENDERER) {
      const img = new Image()
      img.onload = () => {
        if (disposed || !rainCanvas) return
        const fg = makeRainSource(img)
        const fx = createRainEffect(rainCanvas, fg, {
          background: img,
          textureRatio: img.width / img.height,
          brightness: 1.35,
          alphaMultiply: 8,
          alphaSubtract: 4,
          minRefraction: 80,
          maxRefraction: 280,
          resolutionScale: 0.8,
          // 稀疏雨量（避免密集恐惧）
          minR: 18, maxR: 52,
          rainChance: 0.1,
          rainLimit: 2,
          dropletsRate: 8,
          dropletsSize: [3.5, 6],
          trailRate: 0.8,
          trailScaleRange: [0.2, 0.35],
        })
        if (fx) {
          rainFxRef.current = fx
          fx.setIntensity(0)
        }
      }
      img.onerror = () => { /* 素材缺失：跳过雨幕 */ }
      img.src = IMG
    }

    /* ============ 时间轴 ============ */
    const t0 = performance.now()
    let last = t0
    const tick = (now: number) => {
      if (disposed) return
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const tt = (now - t0) / 1000

      // 3D 浮雕立绘淡入
      if (figureCanvas) {
        figureCanvas.style.opacity = String(clamp01((tt - 0.1) / 0.7))
      }
      // 雨滴逐步开始：0.15s 第一滴 → 2.0s 稀疏细雨（画布透明度随强度淡入）
      const fx = rainFxRef.current
      if (fx) {
        const ramp = clamp01((tt - 0.15) / 0.5) * (0.3 + 0.7 * clamp01((tt - 0.7) / 1.4))
        fx.setIntensity(ramp)
      }
      // 落款浮现
      if (brandRef.current) {
        const k = clamp01((tt - 1.7) / 0.8)
        brandRef.current.style.opacity = String(k)
        brandRef.current.style.transform = `translateY(${(1 - k) * 14}px)`
      }
      // 底部进度条
      if (progressRef.current) {
        progressRef.current.style.width = `${clamp01(tt / DURATION) * 100}%`
      }

      if (tt >= DURATION) skip()
      else requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)

    return () => {
      disposed = true
      overlay?.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
      threeRef.current?.dispose()
      threeRef.current = null
      rainFxRef.current?.dispose()
      rainFxRef.current = null
    }
  }, [onDone])

  return (
    <div ref={overlayRef} className="rain-splash">
      {/* 水墨深蓝底 */}
      <div className="rain-splash-bg" />
      {/* 3D 浮雕抠像立绘（three.js：位移几何 + 旋转 + 扫光） */}
      <canvas ref={figureCanvasRef} className="rain-splash-figure" />
      {/* 稀疏雨幕（雨滴落在 3D 立绘前方） */}
      <canvas ref={rainCanvasRef} className="rain-splash-canvas" />

      {/* 落款 */}
      <div ref={brandRef} className="rain-splash-brand">
        <div className="rain-splash-title">玄 策</div>
        <div className="rain-splash-sub">国 漫 IP 智 能 运 营 中 心</div>
        <div className="rain-splash-seal"><Seal text="玄机" type="yin" shape="circle" size={40} seed={9} /></div>
      </div>

      <div className="rain-splash-hint">CLICK TO SKIP</div>
      <div className="rain-splash-progress"><div ref={progressRef} className="rain-splash-progress-fill" /></div>

      <style>{`
        .rain-splash {
          position: fixed; inset: 0; z-index: 9999;
          background: #0A0F1B;
          overflow: hidden; user-select: none; cursor: pointer;
        }
        .rain-splash-bg {
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 70% 55% at 50% 42%, rgba(30,42,66,0.5) 0%, transparent 70%),
            radial-gradient(ellipse at 50% 110%, rgba(20,28,46,0.6) 0%, transparent 60%),
            linear-gradient(180deg, #0C1220 0%, #0A0F1B 60%, #080C14 100%);
        }
        .rain-splash-figure {
          position: absolute; inset: 0; width: 100%; height: 100%;
          display: block; pointer-events: none; z-index: 2; opacity: 0;
        }
        .rain-splash-canvas {
          position: absolute; inset: 0; width: 100%; height: 100%;
          display: block; pointer-events: none; z-index: 4; opacity: 0;
        }

        /* ---- 落款（水墨风格） ---- */
        .rain-splash-brand {
          position: absolute; left: 0; right: 0; bottom: 12%;
          text-align: center; opacity: 0;
          transition: opacity 0.6s ease; pointer-events: none; z-index: 6;
        }
        .rain-splash-title {
          font-family: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'STSong', 'SimSun', serif;
          font-size: 2.6rem; font-weight: 900;
          letter-spacing: 0.3em; text-indent: 0.3em;
          color: #E8E0CF;
          text-shadow: 0 0 26px rgba(140,170,200,0.22), 0 2px 3px rgba(0,0,0,0.55);
        }
        .rain-splash-sub {
          margin-top: 12px;
          font-family: 'Noto Sans SC', sans-serif;
          font-size: 0.6875rem; letter-spacing: 0.32em;
          color: rgba(200,215,235,0.55);
        }
        .rain-splash-seal { margin-top: 16px; }

        .rain-splash-hint {
          position: absolute; left: 18px; bottom: 14px;
          font-family: 'Source Code Pro', Consolas, monospace;
          font-size: 0.5625rem; letter-spacing: 0.2em;
          color: rgba(200,215,235,0.35);
          pointer-events: none;
          animation: rsPulse 2.4s ease-in-out infinite;
        }
        @keyframes rsPulse {
          0%, 100% { opacity: 0.3; }
          50%      { opacity: 0.75; }
        }

        .rain-splash-progress {
          position: absolute; left: 18px; right: 18px; bottom: 18px;
          height: 2px; pointer-events: none;
          background: rgba(140,170,200,0.12);
        }
        .rain-splash-progress-fill {
          height: 100%; width: 0;
          background: linear-gradient(90deg, #5B8C9E, #D9A845);
          box-shadow: 0 0 8px rgba(140,170,200,0.35);
        }
      `}</style>
    </div>
  )
}
