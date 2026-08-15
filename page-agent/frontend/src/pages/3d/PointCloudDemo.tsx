/*
 * 玄策 · 3D 陈列室 demo ① 卫庄墨影点云
 * 立绘 → 采样管线（亮度/饱和/边缘/间隙填补）→ BufferGeometry
 * z=亮度深度（亮部朝镜头），朱砂/天行金高光点缀 + 加法辉光；轨道旋转 + 视差
 */
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { buildPointCloud, PointCloud } from '../../lib/pointcloud'
import { makeRenderer, bindResize, frameLoop, disposeObject } from '../../lib/threeUtils'

const IMG = '/tianxingjiuge.jpg'

export default function PointCloudDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stat, setStat] = useState('采样中…')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = makeRenderer(canvas)
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50)
    camera.position.set(0, 0, 3.4)
    const controls = new OrbitControls(camera, canvas)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.45
    controls.minDistance = 1.6
    controls.maxDistance = 7
    controls.target.set(0, 0, 0.7)

    const group = new THREE.Group()
    scene.add(group)
    let points: THREE.Points | null = null
    let glow: THREE.Points | null = null
    const pointer = { x: 0, y: 0 }
    const onPointer = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1
      pointer.y = -(((e.clientY - r.top) / r.height) * 2 - 1)
    }
    canvas.addEventListener('pointermove', onPointer)

    buildPointCloud(IMG, 60000)
      .then((pc: PointCloud) => {
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(pc.positions, 3))
        geo.setAttribute('color', new THREE.BufferAttribute(pc.colors, 3))
        const mat = new THREE.PointsMaterial({
          size: 0.021,
          vertexColors: true,
          transparent: true,
          opacity: 0.94,
          depthWrite: false,
          sizeAttenuation: true,
        })
        points = new THREE.Points(geo, mat)
        group.add(points)
        // 高光辉光层：红/金顶点 → 加法混合大点
        const gpos: number[] = []
        for (let i = 0; i < pc.counts.total; i++) {
          const c = i * 3
          if (pc.colors[c] > 0.8) gpos.push(pc.positions[c], pc.positions[c + 1], pc.positions[c + 2])
        }
        if (gpos.length > 0) {
          const ggeo = new THREE.BufferGeometry()
          ggeo.setAttribute('position', new THREE.Float32BufferAttribute(gpos, 3))
          const gmat = new THREE.PointsMaterial({
            size: 0.05,
            color: new THREE.Color(PALETTE_GOLD),
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
          glow = new THREE.Points(ggeo, gmat)
          group.add(glow)
        }
        setStat(`粒子 ${pc.counts.total.toLocaleString()} · 墨 ${pc.counts.ink.toLocaleString()} · 朱砂 ${pc.counts.red} · 天行金 ${pc.counts.gold}`)
      })
      .catch((e) => setStat('采样失败: ' + (e as Error).message))

    const onResize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    const unResize = bindResize(canvas, onResize)
    const unLoop = frameLoop(() => {
      controls.update()
      group.rotation.y = pointer.x * 0.18
      group.rotation.x = -pointer.y * 0.1
      if (points) points.rotation.y -= 0.0015
      if (glow) glow.rotation.y += 0.0015
      renderer.render(scene, camera)
    })

    return () => {
      unLoop()
      unResize()
      controls.dispose()
      if (points) disposeObject(points)
      if (glow) disposeObject(glow)
      renderer.dispose()
      canvas.removeEventListener('pointermove', onPointer)
    }
  }, [])

  return (
    <div>
      <div
        style={{
          position: 'relative',
          height: 500,
          borderRadius: 12,
          background: 'linear-gradient(180deg,#FFFDF6,#F3EDDD)',
          border: '1px solid #E4DCC8',
          overflow: 'hidden',
        }}
      >
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab' }} />
        <span style={{ position: 'absolute', right: 12, top: 10, fontSize: '0.625rem', color: '#6B6258' }}>
          {stat}
        </span>
        <span style={{ position: 'absolute', left: 12, bottom: 10, fontSize: '0.5625rem', color: '#8a8578' }}>
          拖拽旋转 · 滚轮缩放 · 鼠标移动视差
        </span>
      </div>
      <p style={{ fontSize: '0.625rem', color: '#6B6258', margin: '10px 2px 0' }}>
        素材：tianxingjiuge.jpg（四周年立绘）· 采样管线（亮度/饱和/边缘/间隙填补）· z = 亮度深度 · 朱砂 4.5% / 天行金 1.5% 点缀 + 加法辉光
      </p>
    </div>
  )
}

const PALETTE_GOLD = 0xd9a845
