/*
 * 玄策 · 3D 陈列馆 —— 玄机素材展柜
 * 状态机（借鉴 complete-shelf）：展架浏览 → 点击拉出 → 轨道检视 → 返回展架
 * 打光（借鉴 aurum）：暖金主光 + 冷蓝补光 + 白 rim + 浮雕扫光 + 接触阴影
 * 展示方式：原图 / 墨影点云（亮度为深度）/ 立绘浮雕（位移贴图）
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { makeRenderer, frameLoop, disposeObject } from '../../lib/threeUtils'
import { buildPointCloud, buildReliefCanvas } from '../../lib/pointcloud'
import { makeSoftSprite } from '../../lib/softSprite'
import { dark, type } from '../../lib/theme'
import Seal from '../../components/Seal'
import InkWashBackground from '../../components/InkWashBackground'
import { TYPE_LABEL, type IPAsset } from '../../data/assets'

type ShowMode = 'image' | 'cloud' | 'relief'
const MODES: { k: ShowMode; l: string }[] = [
  { k: 'image', l: '原图' },
  { k: 'cloud', l: '墨影点云' },
  { k: 'relief', l: '立绘浮雕' },
]

const SHELF_Y = 0.62
const FRAME_H = 1.5
const FRAME_GAP = 1.9
const BASE_Y = SHELF_Y + FRAME_H / 2 + 0.06
const CAM_SHELF = new THREE.Vector3(0, 0.35, 7.2)
const CAM_DETAIL = new THREE.Vector3(0, 0, 3.6)
const LOOK = new THREE.Vector3(0, 0.55, 0)
const TWEEN_MS = 850

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

interface FrameRef {
  group: THREE.Group
  plane: THREE.Mesh
  glow: THREE.Sprite
  frameMat: THREE.MeshStandardMaterial
}

function makeWoodTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 16
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#3A2E20'
  ctx.fillRect(0, 0, 64, 16)
  for (let i = 0; i < 6; i++) {
    ctx.strokeStyle = `rgba(20,14,8,${0.15 + Math.random() * 0.2})`
    ctx.beginPath()
    ctx.moveTo(0, Math.random() * 16)
    ctx.bezierCurveTo(20, Math.random() * 16, 44, Math.random() * 16, 64, Math.random() * 16)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

export default function Showcase({ assets }: { assets: IPAsset[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const [active, setActive] = useState(0)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [mode, setMode] = useState<ShowMode>('image')
  const [stat, setStat] = useState('加载陈列…')

  const detailIdRef = useRef<string | null>(null)
  const modeRef = useRef<ShowMode>('image')
  useEffect(() => { detailIdRef.current = detailId }, [detailId])
  useEffect(() => { modeRef.current = mode }, [mode])

  const framesRef = useRef<FrameRef[]>([])
  const detailRef = useRef<{ group: THREE.Group; mesh: THREE.Object3D | null }>({ group: null!, mesh: null })
  const cameraRef = useRef<THREE.PerspectiveCamera>(null!)
  const controlsRef = useRef<OrbitControls>(null!)
  const tweenRef = useRef<{ t0: number; from: THREE.Vector3; to: THREE.Vector3 } | null>(null)
  const syncRef = useRef<(id: string | null) => void>(() => {})

  const textures = useMemo(() => new Map<string, THREE.Texture>(), [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = makeRenderer(canvas)
    } catch {
      setStat('WebGL 不可用')
      return
    }
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 60)
    camera.position.copy(CAM_SHELF)
    camera.lookAt(LOOK)
    cameraRef.current = camera

    const controls = new OrbitControls(camera, canvas)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = false
    controls.enableZoom = false
    controls.enableRotate = false
    controls.minDistance = 2.2
    controls.maxDistance = 5
    controls.target.copy(LOOK)
    controlsRef.current = controls

    /* ---- 灯光 ---- */
    const ambient = new THREE.AmbientLight(0x2a2420, 0.9)
    scene.add(ambient)
    const key = new THREE.DirectionalLight(0xffd9a0, 2.2)
    key.position.set(3.2, 5, 4)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0x9fb8c8, 0.9)
    fill.position.set(-3.5, 0.6, 3)
    scene.add(fill)
    const rim = new THREE.DirectionalLight(0xffffff, 0.5)
    rim.position.set(0, 2, -6)
    scene.add(rim)
    const sweep = new THREE.DirectionalLight(0xffe0ae, 0)
    sweep.target.position.set(0, 0.55, 0)
    scene.add(sweep)
    scene.add(sweep.target)

    /* ---- 展架：背板 + 台面 + 底座 ---- */
    const wood = makeWoodTexture()
    const shelfGroup = new THREE.Group()
    const totalW = Math.max(4, assets.length * FRAME_GAP - 0.4)
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1b1612, roughness: 0.92, metalness: 0 })
    const woodMat = new THREE.MeshStandardMaterial({ map: wood, color: 0x8a7a5a, roughness: 0.7, metalness: 0.12 })
    const back = new THREE.Mesh(new THREE.BoxGeometry(totalW + 2.4, 3.4, 0.16), darkMat)
    back.position.set(0, SHELF_Y + 1.5, -0.6)
    shelfGroup.add(back)
    const top = new THREE.Mesh(new THREE.BoxGeometry(totalW + 2.4, 0.1, 0.9), woodMat)
    top.position.set(0, SHELF_Y + 3.35, -0.35)
    shelfGroup.add(top)
    const base = new THREE.Mesh(new THREE.BoxGeometry(totalW + 2.4, 0.14, 0.9), woodMat)
    base.position.set(0, SHELF_Y - 0.07, -0.35)
    shelfGroup.add(base)
    const floor = new THREE.Mesh(new THREE.BoxGeometry(totalW + 2.4, 0.05, 1.6), darkMat)
    floor.position.set(0, SHELF_Y - 0.14, -0.2)
    shelfGroup.add(floor)
    scene.add(shelfGroup)

    /* ---- 展位：金框 + 图片 + 辉光 ---- */
    const glowTex = makeSoftSprite()
    framesRef.current = assets.map((a, i) => {
      const w = FRAME_H * a.aspect
      const g = new THREE.Group()
      const fw = w + 0.09
      const fh = FRAME_H + 0.09
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2119, roughness: 0.55, metalness: 0.85, emissive: 0x000000 })
      const bar = (bw: number, bh: number, x: number, y: number) => {
        const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.05), frameMat)
        b.position.set(x, y, 0)
        g.add(b)
      }
      bar(fw, 0.06, 0, fh / 2)
      bar(fw, 0.06, 0, -fh / 2)
      bar(0.06, fh, fw / 2, 0)
      bar(0.06, fh, -fw / 2, 0)
      const imageMat = new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.96 })
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, FRAME_H), imageMat)
      plane.position.z = -0.02
      g.add(plane)
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xd9a845, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }))
      glow.scale.set(w * 1.35, FRAME_H * 1.35, 1)
      g.add(glow)
      g.position.set((i - (assets.length - 1) / 2) * FRAME_GAP, BASE_Y, 0)
      scene.add(g)
      return { group: g, plane, glow, frameMat }
    })

    const detailGroup = new THREE.Group()
    scene.add(detailGroup)
    detailRef.current = { group: detailGroup, mesh: null }

    /* ---- 纹理加载 ---- */
    const loader = new THREE.TextureLoader()
    Promise.all(
      assets.map((a) =>
        loader.loadAsync(a.src).then((tex) => {
          tex.colorSpace = THREE.SRGBColorSpace
          tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
          textures.set(a.id, tex)
        })
      )
    )
      .then(() => setReady(true))
      .catch((e) => setStat('素材加载失败: ' + String((e as Error).message)))

    /* ---- 详情态构建（原图 / 点云 / 浮雕） ---- */
    const buildDetail = (asset: IPAsset) => {
      const d = detailRef.current
      if (d.mesh) {
        d.group.remove(d.mesh)
        disposeObject(d.mesh)
        d.mesh = null
      }
      const w = FRAME_H * asset.aspect
      if (modeRef.current === 'image') {
        const mat = new THREE.MeshBasicMaterial({ map: textures.get(asset.id), color: 0xffffff, transparent: true })
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, FRAME_H), mat)
        d.group.add(mesh)
        d.mesh = mesh
        setStat('原图 · 拖拽旋转 · 滚轮缩放')
      } else if (modeRef.current === 'cloud') {
        setStat('采样中…')
        buildPointCloud(asset.src, 36000)
          .then((pc) => {
            if (detailIdRef.current !== asset.id) return
            const geo = new THREE.BufferGeometry()
            geo.setAttribute('position', new THREE.BufferAttribute(pc.positions, 3))
            geo.setAttribute('color', new THREE.BufferAttribute(pc.colors, 3))
            const mat = new THREE.PointsMaterial({ size: 0.02, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, sizeAttenuation: true })
            const pts = new THREE.Points(geo, mat)
            const s = 1 / Math.max(pc.aspect, 0.01)
            pts.scale.set(s * Math.min(1.5, asset.aspect), s, 1)
            d.group.add(pts)
            d.mesh = pts
            setStat('墨影点云 · 亮度为深度')
          })
          .catch(() => setStat('点云生成失败'))
      } else {
        setStat('生成浮雕…')
        buildReliefCanvas(asset.src, 512)
          .then((c) => {
            if (detailIdRef.current !== asset.id) return
            const map = new THREE.CanvasTexture(c)
            map.needsUpdate = true
            const mat = new THREE.MeshStandardMaterial({ color: 0xefe9db, displacementMap: map, displacementScale: 0.9, roughness: 0.78, metalness: 0 })
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, FRAME_H, 160, 320), mat)
            d.group.add(mesh)
            d.mesh = mesh
            setStat('立绘浮雕 · 旋转扫光')
          })
          .catch(() => setStat('浮雕生成失败'))
      }
    }

    /* ---- 详情开关：相机缓动 + 展位显隐 ---- */
    syncRef.current = (id: string | null) => {
      const target = id ? assets.find((a) => a.id === id) : null
      const idx = id ? assets.findIndex((a) => a.id === id) : -1
      if (id && target) buildDetail(target)
      framesRef.current.forEach((f, i) => {
        f.group.visible = !id || i === idx
      })
      const cam = cameraRef.current
      tweenRef.current = { t0: performance.now(), from: cam.position.clone(), to: (id ? CAM_DETAIL : CAM_SHELF).clone() }
      controlsRef.current.enableRotate = !!id
      controlsRef.current.enableZoom = !!id
      sweep.intensity = id && modeRef.current === 'relief' ? 1.6 : 0
    }

    /* ---- 交互 ---- */
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let hovered = -1
    const pick = (e: PointerEvent): number => {
      const r = canvas.getBoundingClientRect()
      pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1
      pointer.y = -(((e.clientY - r.top) / r.height) * 2 - 1)
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(framesRef.current.map((f) => f.plane), false)
      return hits.length > 0 ? framesRef.current.findIndex((f) => f.plane === hits[0].object) : -1
    }
    const onMove = (e: PointerEvent) => {
      if (detailIdRef.current) return
      hovered = pick(e)
    }
    const onClick = (e: PointerEvent) => {
      if (detailIdRef.current) return
      const idx = pick(e)
      if (idx >= 0) setDetailId(assets[idx].id)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setDetailId(null); return }
      if (detailIdRef.current) return
      if (e.key === 'ArrowRight') setActive((a) => (a + 1) % assets.length)
      if (e.key === 'ArrowLeft') setActive((a) => (a - 1 + assets.length) % assets.length)
    }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerdown', onClick)
    window.addEventListener('keydown', onKey)

    /* ---- 主循环 ---- */
    let last = performance.now()
    const unLoop = frameLoop(() => {
      const now = performance.now()
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const t = now / 1000

      framesRef.current.forEach((f, i) => {
        const sel = i === active && !detailIdRef.current
        const hot = i === hovered && !detailIdRef.current
        const light = sel || hot
        f.group.position.y = BASE_Y + Math.sin(t * 1.1 + i * 1.7) * 0.012
        f.frameMat.emissive.setHex(light ? 0x3a2c10 : 0x000000)
        f.frameMat.emissiveIntensity = light ? 0.9 : 0
        f.glow.material.opacity = light ? 0.2 : 0
      })

      const tween = tweenRef.current
      if (tween) {
        const k = easeInOutCubic(clamp01((now - tween.t0) / TWEEN_MS))
        camera.position.lerpVectors(tween.from, tween.to, k)
        camera.lookAt(LOOK)
        if (k >= 1) tweenRef.current = null
      }

      const d = detailRef.current
      if (detailIdRef.current && d.mesh) {
        sweep.position.x = Math.sin(t * 0.7) * 4
        sweep.position.z = 2.5 + Math.cos(t * 0.7) * 2
        if (d.mesh instanceof THREE.Points) d.mesh.rotation.y = Math.sin(t * 0.25) * 0.18
      }

      controls.update()
      renderer.render(scene, camera)
    })

    return () => {
      unLoop()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerdown', onClick)
      window.removeEventListener('keydown', onKey)
      framesRef.current.forEach((f) => f.group.traverse((o) => disposeObject(o)))
      if (detailRef.current.mesh) disposeObject(detailRef.current.mesh)
      shelfGroup.traverse((o) => disposeObject(o))
      glowTex.dispose()
      wood.dispose()
      renderer.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets])

  /* React 侧状态 → three 侧联动 */
  useEffect(() => {
    if (!detailId) setMode('image')
    if (detailId) setActive(Math.max(0, assets.findIndex((a) => a.id === detailId)))
    syncRef.current(detailId)
  }, [detailId, assets])
  useEffect(() => {
    if (!detailId) return
    syncRef.current(detailId)
  }, [mode, detailId])

  const detailAsset = detailId ? assets.find((a) => a.id === detailId) ?? null : null

  return (
    <div style={{ position: 'relative', height: 560, borderRadius: 14, overflow: 'hidden', background: '#0E0D0C', border: '1px solid #E4DCC8' }}>
      <InkWashBackground variant="dark" position="right" opacity={0.8} />
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', zIndex: 1 }} />
      {!ready && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', color: dark.muted, fontSize: '0.75rem', letterSpacing: '0.2em' }}>
          {stat}
        </div>
      )}

      {detailAsset && (
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 250, zIndex: 3, padding: '26px 22px', background: 'linear-gradient(90deg, rgba(10,9,8,0.88) 0%, rgba(10,9,8,0.55) 70%, transparent 100%)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <Seal text={detailAsset.work.replace(/[·\s]/g, '').slice(0, 4)} type="yang" shape="square" size={40} seed={detailAsset.id.length * 7 + 11} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: type.serif, fontSize: '1rem', fontWeight: 700, color: dark.ink, letterSpacing: '0.06em' }}>{detailAsset.name}</div>
              <div style={{ fontSize: '0.625rem', color: dark.accent, marginTop: 6 }}>{detailAsset.work} · {TYPE_LABEL[detailAsset.type]}</div>
            </div>
          </div>
          <p style={{ fontSize: '0.6875rem', color: dark.muted, lineHeight: 1.8, margin: '18px 0 10px' }}>{detailAsset.note}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
            {detailAsset.tags.map((tg) => (
              <span key={tg} style={{ fontSize: '0.5625rem', color: dark.accent, border: `1px solid ${dark.line}`, padding: '2px 8px', borderRadius: 3 }}>{tg}</span>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>
            {MODES.map((m) => (
              <button key={m.k} onClick={() => setMode(m.k)}
                style={{ textAlign: 'left', background: mode === m.k ? 'rgba(212,160,74,0.14)' : 'transparent', border: `1px solid ${mode === m.k ? 'rgba(212,160,74,0.5)' : dark.line}`, color: mode === m.k ? dark.accent : dark.muted, padding: '7px 12px', fontSize: '0.6875rem', cursor: 'pointer', fontFamily: type.sans, letterSpacing: '0.1em' }}>
                {m.l}
              </button>
            ))}
          </div>
          <button onClick={() => setDetailId(null)}
            style={{ marginTop: 14, textAlign: 'center', background: 'transparent', border: `1px solid ${dark.line}`, color: dark.ink, padding: '8px 12px', fontSize: '0.6875rem', cursor: 'pointer', fontFamily: type.sans, letterSpacing: '0.2em' }}>
            返回展架
          </button>
        </div>
      )}

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 2, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(0deg, rgba(10,9,8,0.8) 0%, transparent 100%)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {assets.map((a, i) => (
            <button key={a.id} onClick={() => setActive(i)} title={a.name}
              style={{ width: 26, height: 26, borderRadius: '50%', border: `1px solid ${i === active && !detailId ? dark.accent : dark.line}`, background: i === active && !detailId ? 'rgba(212,160,74,0.2)' : 'transparent', color: i === active && !detailId ? dark.accent : dark.muted, fontSize: '0.5625rem', cursor: 'pointer', fontFamily: type.serif }}>
              {i + 1}
            </button>
          ))}
        </div>
        <span style={{ fontSize: '0.5625rem', color: dark.muted, letterSpacing: '0.14em' }}>{detailId ? '拖拽旋转 · 滚轮缩放 · ESC 返回' : '← → 切换 · 点击展品进入 · 悬停高亮'}</span>
      </div>
    </div>
  )
}
