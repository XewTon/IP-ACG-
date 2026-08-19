/*
 * 玄策 · 3D 画廊 —— three.js 交互式陈列（多行自适应）
 * 交互范式借鉴 GitHub: cynthiachiu/3D-Art-Gallery（悬停缩放、鼠标视差、聚光照明、柔和辉光）
 * 实现采用与 Showcase / PointCloudDemo 一致的 imperative three.js 栈：
 *   项目 React 为 18.3，而 @react-three/fiber@9 / drei@10 peer 依赖要求 React 19，
 *   直接引入 R3F 会在运行时崩溃，故不采用（依赖版本留待整体升级 React 19 时再启用）。
 * 布局：条目 >8 自动排两行，单幅宽度按行内列数自适应，保证整行总宽适配相机视野。
 */
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { makeRenderer, frameLoop, disposeObject } from '../../lib/threeUtils'
import { makeSoftSprite } from '../../lib/softSprite'
import type { IPAsset } from '../../data/assets'

const MAX_H = 2.7 // 单幅最大高度
const ROW_GAP = 0.5 // 行间距
const COLS_MAX = 8 // 每行最多列数

interface FrameState {
  group: THREE.Group
  plane: THREE.Mesh
  frameMat: THREE.MeshStandardMaterial
  glow: THREE.Sprite
  baseX: number
  baseY: number
}

function clamp(v: number, a: number, b: number) {
  return Math.min(b, Math.max(a, v))
}

export default function GalleryCanvas({
  assets, selectedId, onSelect,
}: {
  assets: IPAsset[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const selectedRef = useRef<string | null>(selectedId)
  const onSelectRef = useRef(onSelect)
  useEffect(() => { selectedRef.current = selectedId }, [selectedId])
  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = makeRenderer(canvas)
    } catch {
      return
    }
    renderer.setClearColor(0x0e0d0c, 1)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60)
    camera.position.set(0, 0, 6.6)
    camera.lookAt(0, 0, 0)

    /* 打光：暖金主光 + 石青补光 + 金色点缀（与专业展柜同款） */
    const ambient = new THREE.AmbientLight(0xc4b295, 0.6)
    scene.add(ambient)
    const key = new THREE.DirectionalLight(0xffd9a0, 1.6)
    key.position.set(3.6, 5, 4.6)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0x9fb8c8, 0.7)
    fill.position.set(-4.2, 1.2, 3)
    scene.add(fill)
    const point = new THREE.PointLight(0xd9a845, 0.4, 8)
    point.position.set(0, -2.4, 2.2)
    scene.add(point)

    const rig = new THREE.Group()
    scene.add(rig)
    const glowTex = makeSoftSprite()
    const loader = new THREE.TextureLoader()
    const frames: FrameState[] = []

    /* 多行自适应布局 */
    const rows = assets.length > COLS_MAX ? 2 : 1
    const perRow = Math.ceil(assets.length / rows)
    const maxW = clamp((8.6 / perRow - 0.5) / 0.72, 0.7, 2.0)

    assets.forEach((a, i) => {
      let w = maxW
      let h = w / Math.max(a.aspect, 0.2)
      if (h > MAX_H) {
        h = MAX_H
        w = h * Math.max(a.aspect, 0.2)
      }
      const col = i % perRow
      const row = Math.floor(i / perRow)
      const x = (col - (perRow - 1) / 2) * (maxW * 0.72 + 0.5)
      const y = rows === 2 ? (row === 0 ? ROW_GAP / 2 + 0.3 : -(ROW_GAP / 2 + 0.3)) : 0

      const g = new THREE.Group()
      g.position.set(x, y, 0)

      /* 画框（悬停/选中点亮为金框） */
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x241d16, metalness: 0.85, roughness: 0.42, emissive: 0x000000 })
      const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, h + 0.1, 0.045), frameMat)
      frame.position.z = -0.03
      g.add(frame)

      /* 画面（纹理异步加载，加载完成前为纯色板） */
      const imageMat = new THREE.MeshBasicMaterial({ color: 0x3a332b, transparent: true })
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), imageMat)
      plane.position.z = 0.01
      g.add(plane)
      loader.load(a.src, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
        imageMat.map = tex
        imageMat.needsUpdate = true
      })

      /* 底部辉光（平时石青微光，点亮转金色） */
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: 0x5b8c9e, transparent: true, opacity: 0.14,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }))
      glow.scale.set(w * 0.72, 0.5, 1)
      glow.position.set(0, -h / 2 - 0.14, -0.12)
      g.add(glow)

      rig.add(g)
      frames.push({ group: g, plane, frameMat, glow, baseX: x, baseY: y })
    })

    /* 交互：raycast 选帧 + hover 高亮 */
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let hovered = -1
    const pick = (e: PointerEvent): number => {
      const r = canvas.getBoundingClientRect()
      pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1
      pointer.y = -(((e.clientY - r.top) / r.height) * 2 - 1)
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(frames.map((f) => f.plane), false)
      return hits.length ? frames.findIndex((f) => f.plane === hits[0].object) : -1
    }
    const onMove = (e: PointerEvent) => {
      hovered = pick(e)
      canvas.style.cursor = hovered >= 0 ? 'pointer' : 'default'
    }
    const onClick = (e: PointerEvent) => {
      const idx = pick(e)
      if (idx >= 0) onSelectRef.current(assets[idx].id)
    }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerdown', onClick)

    const onResize = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    onResize()
    window.addEventListener('resize', onResize)

    let last = performance.now()
    const unLoop = frameLoop(() => {
      const now = performance.now()
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const t = now / 1000
      const selId = selectedRef.current

      /* 鼠标视差（平滑跟随） */
      const k = 1 - Math.pow(0.0018, dt) // 帧率无关的平滑系数
      rig.rotation.y += (pointer.x * 0.07 - rig.rotation.y) * k
      rig.rotation.x += (pointer.y * 0.045 - rig.rotation.x) * k
      rig.position.x += (pointer.x * 0.3 - rig.position.x) * k
      rig.position.y += (pointer.y * 0.12 - rig.position.y) * k

      frames.forEach((f, i) => {
        const sel = assets[i].id === selId
        const lit = sel || i === hovered
        f.group.position.y = f.baseY + Math.sin(t * 0.9 + i * 1.37) * 0.05 + (sel ? 0.14 : 0)
        f.group.position.z = sel ? 0.4 : 0
        f.group.rotation.y = Math.sin(t * 0.5 + i * 0.83) * 0.035 + (i === hovered ? 0.05 : 0)
        f.frameMat.emissive.setHex(lit ? 0x5a3f12 : 0x000000)
        f.frameMat.emissiveIntensity = lit ? 1.1 : 0
        f.frameMat.color.setHex(lit ? 0xc9a96e : 0x241d16)
        f.glow.material.color.setHex(lit ? 0xd9a845 : 0x5b8c9e)
        f.glow.material.opacity = lit ? 0.4 : 0.14
      })

      renderer.render(scene, camera)
    })

    return () => {
      unLoop()
      window.removeEventListener('resize', onResize)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerdown', onClick)
      frames.forEach((f) => disposeObject(f.group))
      glowTex.dispose()
      renderer.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets])

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', zIndex: 1 }} />
}
