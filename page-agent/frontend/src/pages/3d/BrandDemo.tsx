/*
 * 玄策 · 3D 陈列室 demo ④ 品牌展示
 * 官网 logo（黑底红字，运行时 chroma-key 抠底）+ 天行九歌 logo 旋转贴片
 * 玄机红/天行金/石青材质球 · 卫庄新造型壁纸做场景背景
 */
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { buildLogoCanvas } from '../../lib/pointcloud'
import { makeRenderer, bindResize, frameLoop, disposeObject } from '../../lib/threeUtils'

const LOGO_XJ = '/xj_logo.png'
const LOGO_TX = '/txjg_logo.png'
const BG = '/wz.jpg'

export default function BrandDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stat, setStat] = useState('抠底中…')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = makeRenderer(canvas, true)
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50)
    camera.position.set(0, 0, 5)

    new THREE.TextureLoader().load(BG, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      scene.background = tex
    })

    const group = new THREE.Group()
    scene.add(group)
    const ambient = new THREE.AmbientLight(0xffffff, 0.55)
    scene.add(ambient)
    const key = new THREE.DirectionalLight(0xffffff, 1.4)
    key.position.set(2.5, 3, 4)
    scene.add(key)
    const gold = new THREE.PointLight(0xd9a845, 1.6, 9)
    gold.position.set(0, -1.6, 2.6)
    scene.add(gold)

    const spheres = [
      { x: -1.45, color: 0xda1e2b, label: '玄机红' },
      { x: 0, color: 0xd9a845, label: '天行金' },
      { x: 1.45, color: 0x5b8c9e, label: '石青' },
    ].map((s) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 48, 32),
        new THREE.MeshStandardMaterial({ color: s.color, metalness: 0.42, roughness: 0.2 })
      )
      m.position.set(s.x, -1.75, 0)
      scene.add(m)
      return { mesh: m, label: s.label }
    })

    const logos: THREE.Mesh[] = []
    let failed = 0
    const build = (src: string, x: number) =>
      buildLogoCanvas(src, 400)
        .then((c) => {
          const a = c.width / c.height
          const tex = new THREE.CanvasTexture(c)
          tex.colorSpace = THREE.SRGBColorSpace
          tex.needsUpdate = true
          const m = new THREE.Mesh(
            new THREE.PlaneGeometry(1.55, 1.55 / a),
            new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
          )
          m.position.set(x, 1.05, 0.1)
          group.add(m)
          logos.push(m)
        })
        .catch(() => failed++)
    Promise.all([build(LOGO_XJ, -0.95), build(LOGO_TX, 0.95)]).then(() => {
      if (failed === 2) setStat('logo 加载失败')
      else setStat('抠底完成 · 黑底 chroma-key (r+g+b<225) · 壁纸背景')
    })

    const onResize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    const unResize = bindResize(canvas, onResize)
    const unLoop = frameLoop((now) => {
      const t = now / 1000
      group.rotation.y = Math.sin(t * 0.4) * 0.32
      group.position.y = Math.sin(t * 0.7) * 0.06
      gold.intensity = 1.4 + Math.sin(t * 1.3) * 0.4
      renderer.render(scene, camera)
    })

    return () => {
      unLoop()
      unResize()
      group.traverse((o) => disposeObject(o))
      spheres.forEach((s) => disposeObject(s.mesh))
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
          background: '#141a26',
          border: '1px solid #E4DCC8',
          overflow: 'hidden',
        }}
      >
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        <span style={{ position: 'absolute', right: 12, top: 10, fontSize: '0.625rem', color: '#dfe6ee' }}>
          {stat}
        </span>
      </div>
      <p style={{ fontSize: '0.625rem', color: '#6B6258', margin: '10px 2px 0' }}>
        素材：xj_logo.png（黑底 chroma-key 抠底）/ txjg_logo.png（透明底直用）/ wz.jpg 壁纸背景 · 三材质球（玄机红·天行金·石青）呼吸点光
      </p>
    </div>
  )
}
