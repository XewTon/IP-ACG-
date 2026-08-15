/*
 * 玄策 · 3D 陈列室 demo ③ 天象场景
 * 复用 weather.ts 状态机：自动循环 晴→雨→雪→雾…，雨线/雪点/雾密度联动
 */
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { WeatherSystem, Weather } from '../../components/weather'
import { makeRenderer, bindResize, frameLoop } from '../../lib/threeUtils'

const W_NAME: Record<Weather, string> = {
  sunny: '晴',
  cloudy: '多云',
  rain: '雨',
  storm: '雷暴',
  snow: '雪',
  fog: '雾',
}
const RAIN_N = 500
const SNOW_N = 600
const SKY = 0x1b2130

export default function WeatherDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [label, setLabel] = useState('晴')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rand = (a: number, b: number) => Math.random() * (b - a) + a
    const renderer = makeRenderer(canvas, true)
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(SKY)
    const fog = new THREE.FogExp2(SKY, 0.018)
    scene.fog = fog

    // 常驻：星野
    const starGeo = new THREE.BufferGeometry()
    const starPos = new Float32Array(500 * 3)
    const starCol = new Float32Array(500 * 3)
    for (let i = 0; i < 500; i++) {
      starPos[i * 3] = rand(-10, 10)
      starPos[i * 3 + 1] = rand(1.5, 6)
      starPos[i * 3 + 2] = rand(-8, -2)
      const gold = Math.random() < 0.25
      starCol[i * 3] = gold ? 0.85 : 0.9
      starCol[i * 3 + 1] = gold ? 0.66 : 0.9
      starCol[i * 3 + 2] = gold ? 0.27 : 0.93
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3))
    const starMat = new THREE.PointsMaterial({
      size: 0.045,
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })
    scene.add(new THREE.Points(starGeo, starMat))

    // 常驻：月 + 辉晕
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 32, 16),
      new THREE.MeshBasicMaterial({ color: 0xd8c9a2 })
    )
    moon.position.set(2.9, 2.5, -6)
    scene.add(moon)
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 24, 12),
      new THREE.MeshBasicMaterial({
        color: 0xd8c9a2,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.BackSide,
      })
    )
    halo.position.copy(moon.position)
    scene.add(halo)

    // 常驻：水墨远山剪影
    const inkMountains: THREE.Mesh[] = []
    ;[
      { x: -2.6, z: -4.4, r: 2.4, h: 2.0 },
      { x: 1.9, z: -4.8, r: 3.2, h: 2.7 },
      { x: 0.4, z: -3.9, r: 1.5, h: 1.1 },
    ].forEach((m) => {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(m.r, m.h, 6),
        new THREE.MeshBasicMaterial({ color: 0x10151d })
      )
      cone.position.set(m.x, m.h / 2 - 0.9, m.z)
      scene.add(cone)
      inkMountains.push(cone)
    })

    // 常驻：天行金尘
    const dustGeo = new THREE.BufferGeometry()
    const dustPos = new Float32Array(130 * 3)
    for (let i = 0; i < 130; i++) {
      dustPos[i * 3] = rand(-5, 5)
      dustPos[i * 3 + 1] = rand(-3.5, 2.5)
      dustPos[i * 3 + 2] = rand(-3, 1.5)
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
    const dustMat = new THREE.PointsMaterial({
      color: 0xd9a845,
      size: 0.05,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })
    const dust = new THREE.Points(dustGeo, dustMat)
    scene.add(dust)
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 60)
    camera.position.set(0, 1.6, 5.2)
    camera.lookAt(0, 0, 0)
    const controls = new OrbitControls(camera, canvas)
    controls.enableDamping = true
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.5
    controls.target.set(0, 0.6, 0)

    // 雨：线段阵列
    const rgeo = new THREE.BufferGeometry()
    const rPos = new Float32Array(RAIN_N * 6)
    const rLen = new Float32Array(RAIN_N)
    for (let i = 0; i < RAIN_N; i++) {
      const x = rand(-6, 6), y = rand(-7, 8), z = rand(-5, 4)
      const len = rand(0.5, 1.1)
      rPos[i * 6] = x; rPos[i * 6 + 1] = y; rPos[i * 6 + 2] = z
      rPos[i * 6 + 3] = x - 0.05; rPos[i * 6 + 4] = y + len; rPos[i * 6 + 5] = z
      rLen[i] = len
    }
    rgeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3))
    const rmat = new THREE.LineBasicMaterial({
      color: 0x5b8c9e,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const rain = new THREE.LineSegments(rgeo, rmat)
    scene.add(rain)

    // 雪：点阵列
    const sgeo = new THREE.BufferGeometry()
    const sPos = new Float32Array(SNOW_N * 3)
    const sPh = new Float32Array(SNOW_N)
    for (let i = 0; i < SNOW_N; i++) {
      sPos[i * 3] = rand(-7, 7); sPos[i * 3 + 1] = rand(-7, 8); sPos[i * 3 + 2] = rand(-5, 4)
      sPh[i] = rand(0, Math.PI * 2)
    }
    sgeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3))
    const smat = new THREE.PointsMaterial({
      color: 0xdfe6ee,
      size: 0.085,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      sizeAttenuation: true,
    })
    const snow = new THREE.Points(sgeo, smat)
    scene.add(snow)

    const weatherSys = new WeatherSystem('sunny', (w) => setLabel(W_NAME[w]), { min: 6000, max: 15000 })

    const onResize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    const unResize = bindResize(canvas, onResize)
    const unLoop = frameLoop((now) => {
      const dt = 1 / 60
      const w = weatherSys.update(Date.now())
      const isRain = w.current === 'rain' || w.current === 'storm'
      const isSnow = w.current === 'snow'
      const boost = w.current === 'storm' ? 1.25 : 1

      rain.visible = isRain
      rmat.opacity = isRain ? 0.18 + 0.34 * w.intensity * boost : 0
      if (isRain) {
        const sp = (0.22 + 0.4 * w.intensity * boost) * dt
        for (let i = 0; i < RAIN_N; i++) {
          const j = i * 6
          rPos[j + 1] -= sp
          rPos[j + 4] -= sp
          if (rPos[j + 1] < -7) {
            rPos[j + 1] = rand(7, 8.5)
            rPos[j + 4] = rPos[j + 1] + rLen[i]
            rPos[j] = rand(-6, 6)
            rPos[j + 3] = rPos[j] - 0.05
            rPos[j + 2] = rand(-5, 4); rPos[j + 5] = rPos[j + 2]
          }
        }
        rgeo.attributes.position.needsUpdate = true
      }

      snow.visible = isSnow
      smat.opacity = isSnow ? 0.3 + 0.4 * w.intensity : 0
      if (isSnow) {
        const fall = (0.05 + 0.09 * w.intensity) * dt
        for (let i = 0; i < SNOW_N; i++) {
          const j = i * 3
          sPos[j] += Math.sin(now / 1400 + sPh[i]) * 0.12 * dt
          sPos[j + 1] -= fall
          if (sPos[j + 1] < -7) {
            sPos[j + 1] = rand(7, 8.5)
            sPos[j] = rand(-7, 7)
          }
        }
        sgeo.attributes.position.needsUpdate = true
      }

      fog.density = w.current === 'fog' ? 0.05 + 0.035 * w.intensity : w.current === 'cloudy' || isSnow ? 0.03 + 0.015 * w.intensity : 0.012

      // 金尘缓慢漂移
      const dArr = dustGeo.attributes.position.array as Float32Array
      for (let i = 0; i < 130; i++) {
        const j = i * 3
        dArr[j] += Math.sin(now / 3000 + i) * 0.004 * dt
        dArr[j + 1] += Math.sin(now / 5000 + i * 1.7) * 0.003 * dt + 0.004 * dt
        if (dArr[j + 1] > 2.5) dArr[j + 1] = -3.5
      }
      dustGeo.attributes.position.needsUpdate = true
      dustMat.opacity = 0.14 + 0.12 * Math.sin(now / 1800)

      controls.update()
      renderer.render(scene, camera)
    })

    return () => {
      unLoop()
      unResize()
      controls.dispose()
      rgeo.dispose(); rmat.dispose()
      sgeo.dispose(); smat.dispose()
      starGeo.dispose(); starMat.dispose()
      dustGeo.dispose(); dustMat.dispose()
      moon.geometry.dispose(); (moon.material as THREE.Material).dispose()
      halo.geometry.dispose(); (halo.material as THREE.Material).dispose()
      inkMountains.forEach((m) => { m.geometry.dispose(); (m.material as THREE.Material).dispose() })
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
          background: '#1b2130',
          border: '1px solid #E4DCC8',
          overflow: 'hidden',
        }}
      >
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab' }} />
        <span
          style={{
            position: 'absolute',
            right: 12,
            top: 10,
            fontSize: '0.6875rem',
            color: '#dfe6ee',
            background: 'rgba(0,0,0,0.28)',
            padding: '3px 10px',
            borderRadius: 999,
          }}
        >
          当前天气：{label} · 自动循环（30s–2min）
        </span>
      </div>
      <p style={{ fontSize: '0.625rem', color: '#6B6258', margin: '10px 2px 0' }}>
        素材：weather.ts 状态机（晴/多云/雨/雷暴/雪/雾，easeInOutCubic 平滑过渡）· 雨线 LineSegments / 雪 Points / FogExp2 雾密度联动
      </p>
    </div>
  )
}
