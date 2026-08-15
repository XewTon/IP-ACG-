/*
 * 玄策 · 3D 陈列室 demo ② 立绘浮雕
 * 亮度对比图 → displacementMap 位移贴图 → 石膏浮雕；旋转定向光扫过轮廓
 */
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { buildReliefCanvas } from '../../lib/pointcloud'
import { makeRenderer, bindResize, frameLoop, disposeObject } from '../../lib/threeUtils'

const IMG = '/tianxingjiuge.jpg'

export default function ReliefDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stat, setStat] = useState('生成亮度图…')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = makeRenderer(canvas)
    const scene = new THREE.Scene()
    const aspect = 0.44
    const halfH = 1.15
    const camera = new THREE.OrthographicCamera(-halfH * aspect, halfH * aspect, halfH, -halfH, 0.1, 20)
    camera.position.set(0, 0, 5)
    camera.lookAt(0, 0, 0)

    const mat = new THREE.MeshStandardMaterial({
      color: 0xefe9db,
      displacementMap: null,
      displacementScale: 0.9,
      roughness: 0.75,
      metalness: 0,
    })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2 * aspect, 2, 220, 440), mat)
    scene.add(mesh)
    const ambient = new THREE.AmbientLight(0xfff6e8, 0.55)
    scene.add(ambient)
    const front = new THREE.DirectionalLight(0xffffff, 0.7)
    front.position.set(2.2, 0.8, 3.2)
    scene.add(front)
    const sweep = new THREE.DirectionalLight(0xffe0ae, 1.9)
    sweep.target.position.set(0, 0, 0)
    scene.add(sweep)
    scene.add(sweep.target)
    const fill = new THREE.DirectionalLight(0x9fb8c8, 0.5)
    fill.position.set(2, -1.2, 3)
    scene.add(fill)

    buildReliefCanvas(IMG, 640)
      .then((c) => {
        const tex = new THREE.CanvasTexture(c)
        tex.needsUpdate = true
        mat.displacementMap = tex
        mat.needsUpdate = true
        setStat('浮雕 640×' + c.width + ' · 百分位拉伸 · 位移 0.9 · 旋转定向光')
      })
      .catch((e) => setStat('生成失败: ' + (e as Error).message))

    const onResize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight
      renderer.setSize(w, h, false)
      const a = (w / h) * (halfH / halfH)
      camera.left = -halfH * aspect * a
      camera.right = halfH * aspect * a
      camera.top = halfH
      camera.bottom = -halfH
      camera.updateProjectionMatrix()
    }
    const unResize = bindResize(canvas, onResize)
    const unLoop = frameLoop((now) => {
      const t = now / 1000
      sweep.position.set(2.8 * Math.cos(t * 0.45), 1.8 * Math.sin(t * 0.55) + 0.4, 3)
      renderer.render(scene, camera)
    })

    return () => {
      unLoop()
      unResize()
      disposeObject(mesh)
      renderer.dispose()
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
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        <span style={{ position: 'absolute', right: 12, top: 10, fontSize: '0.625rem', color: '#6B6258' }}>
          {stat}
        </span>
      </div>
      <p style={{ fontSize: '0.625rem', color: '#6B6258', margin: '10px 2px 0' }}>
        素材：同一立绘 · 亮度对比度映射（与点云同源）→ displacementMap · 暖金旋转定向光 + 石青补光，光随轮廓起伏
      </p>
    </div>
  )
}
