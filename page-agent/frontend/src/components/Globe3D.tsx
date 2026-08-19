/*
 * 玄策 · 地域分布 3D 全球 —— 基于开源 three-globe（vasturiano/three-globe，MIT）
 *
 * 实时感：空闲时地球自动往右旋转 + 城市脉冲环 + 流动弧线
 * 交互：抓取式拖拽 —— 往右拖地球往右转、往下拖前面往下转（拖拽期间暂停自动旋转，松开立即恢复）
 * 真实数据：左上角统计覆盖层每 60s 轮询真实库表（/api/dashboard/metrics + /api/community/feedback/stats）
 * 诚实标注：城市点位为运营枢纽示意（真实坐标），省份底图加载自阿里云 DataV GeoJSON（国内可达）
 * 健壮性：WebGL 不可用或初始化失败时降级为提示卡片，绝不导致整页白屏
 */
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import ThreeGlobe from 'three-globe'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { disposeObject, frameLoop } from '../lib/threeUtils'

interface Hub { name: string; lat: number; lng: number }
interface GlobeStats { followers: number; feedback: number; platforms: Record<string, number> }

// 运营枢纽城市（真实坐标 · 示意点位）
const HUBS: Hub[] = [
  { name: '北京', lat: 39.90, lng: 116.40 },
  { name: '上海', lat: 31.23, lng: 121.47 },
  { name: '广州', lat: 23.13, lng: 113.26 },
  { name: '深圳', lat: 22.54, lng: 114.06 },
  { name: '杭州', lat: 30.27, lng: 120.16 },
  { name: '成都', lat: 30.57, lng: 104.07 },
  { name: '武汉', lat: 30.59, lng: 114.31 },
  { name: '西安', lat: 34.34, lng: 108.94 },
  { name: '重庆', lat: 29.56, lng: 106.55 },
  { name: '南京', lat: 32.06, lng: 118.80 },
  { name: '长沙', lat: 28.23, lng: 112.94 },
  { name: '郑州', lat: 34.75, lng: 113.63 },
  { name: '青岛', lat: 36.07, lng: 120.38 },
  { name: '厦门', lat: 24.48, lng: 118.09 },
  { name: '天津', lat: 39.13, lng: 117.20 },
]

// 枢纽间流动弧线（示意：运营联动/内容流转方向）
const ARCS: [string, string][] = [
  ['北京', '上海'], ['上海', '广州'], ['北京', '深圳'], ['上海', '成都'],
  ['杭州', '广州'], ['北京', '成都'], ['上海', '武汉'], ['西安', '上海'],
  ['成都', '深圳'], ['武汉', '杭州'], ['北京', '西安'], ['杭州', '北京'],
]

const hub = (name: string): Hub => HUBS.find(h => h.name === name)!

const CHINA_GEO_URL = 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json'
const STATS_POLL_MS = 60_000

/** 挂载 three.js 场景；WebGL 不可用或初始化失败时抛错，由组件捕获降级 */
function mountGlobe(el: HTMLDivElement, height: number): () => void {
  // WebGL 可用性检测（与启动动画同策略）
  const probe = document.createElement('canvas')
  const gl = probe.getContext('webgl2') || probe.getContext('webgl')
  if (!gl) throw new Error('当前浏览器不支持 WebGL，无法渲染 3D 地球')

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(el.clientWidth || 800, el.clientHeight || height, false)
  renderer.setClearColor(0x10161f, 1)
  el.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(45, (el.clientWidth || 800) / (el.clientHeight || height), 1, 2400)

  // 星空背景（本地贴图，避免外网依赖）
  const skyTex = new THREE.TextureLoader().load('/globe/night-sky.png')
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1400, 32, 32),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false }),
  )
  scene.add(sky)

  scene.add(new THREE.AmbientLight(0xcccccc, 0.55))
  const sun = new THREE.DirectionalLight(0xffffff, 1.1)
  sun.position.set(400, 200, 600)
  scene.add(sun)

  // 地球（three-globe）
  const globe = new ThreeGlobe()
    .globeImageUrl('/globe/earth-blue-marble.jpg')
    .bumpImageUrl('/globe/earth-topology.png')
    .showAtmosphere(true)
    .atmosphereColor('#5B8C9E')
    .atmosphereAltitude(0.16)
    .showGraticules(true)
    .pointsData(HUBS)
    .pointLat('lat')
    .pointLng('lng')
    .pointColor(() => '#DA1E2B')
    .pointAltitude(0.028)
    .pointRadius(0.55)
    .pointResolution(10)
    .ringsData(HUBS)
    .ringLat('lat')
    .ringLng('lng')
    .ringColor(() => (t: number) => `rgba(218,30,43,${(1 - t).toFixed(3)})`)
    .ringMaxRadius(5)
    .ringPropagationSpeed(1.6)
    .ringRepeatPeriod(900)
    .arcsData(ARCS.map(([a, b]) => ({
      startLat: hub(a).lat, startLng: hub(a).lng,
      endLat: hub(b).lat, endLng: hub(b).lng,
    })))
    .arcStartLat('startLat')
    .arcStartLng('startLng')
    .arcEndLat('endLat')
    .arcEndLng('endLng')
    .arcColor(() => 'rgba(201,169,110,0.9)')
    .arcAltitudeAutoScale(0.5)
    .arcDashLength(0.4)
    .arcDashGap(2.2)
    .arcDashAnimateTime(1600)
  scene.add(globe)

  // 中国省界底图（阿里云 DataV GeoJSON，国内可达；失败不影响地球主体）
  fetch(CHINA_GEO_URL)
    .then(r => r.json())
    .then((g) => {
      if (g?.features?.length) {
        globe
          .hexPolygonsData(g.features)
          .hexPolygonResolution(4)
          .hexPolygonMargin(0.6)
          .hexPolygonAltitude(0.006)
          .hexPolygonColor(() => 'rgba(107,98,88,0.55)')
      }
    })
    .catch(() => { /* 忽略 */ })

  // 相机对准中国（与 three-globe 同一套 经纬→三维 换算）
  const phi = (90 - 32) * Math.PI / 180
  const theta = (90 - 108) * Math.PI / 180
  const DIST = 260
  camera.position.set(
    DIST * Math.sin(phi) * Math.cos(theta),
    DIST * Math.cos(phi),
    DIST * Math.sin(phi) * Math.sin(theta),
  )
  camera.lookAt(0, 0, 0)

  const controls = new OrbitControls(camera, renderer.domElement)
  // 抓取式拖拽：禁用相机环绕旋转，改由指针增量直接转动地球网格（往右拖 → 地球往右转）
  controls.enableRotate = false
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.minDistance = 150
  controls.maxDistance = 620
  controls.enablePan = false

  // —— 抓取式拖拽（拖拽期间暂停自动旋转，松开立即恢复）——
  let dragging = false
  let lastX = 0
  let lastY = 0
  const onPointerDown = (e: PointerEvent) => {
    dragging = true
    lastX = e.clientX
    lastY = e.clientY
    try { renderer.domElement.setPointerCapture(e.pointerId) } catch { /* ignore */ }
  }
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging) return
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY
    globe.rotation.y += dx * 0.005
    globe.rotation.x = THREE.MathUtils.clamp(globe.rotation.x + dy * 0.005, -1.3, 1.3)
  }
  const onPointerUp = () => { dragging = false }
  renderer.domElement.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)

  // —— 空闲时自动旋转（往右）——
  const AUTO_SPEED = 0.00005 // rad/ms ≈ 2.9°/s，正值 = 表面往右移动
  let lastNow = 0
  const stop = frameLoop((now) => {
    if (!dragging) {
      const dt = lastNow ? now - lastNow : 16
      globe.rotation.y += AUTO_SPEED * dt
    }
    lastNow = now
    controls.update()
    renderer.render(scene, camera)
  })
  const onResize = () => {
    const w = el.clientWidth, h = el.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  window.addEventListener('resize', onResize)

  return () => {
    stop()
    window.removeEventListener('resize', onResize)
    renderer.domElement.removeEventListener('pointerdown', onPointerDown)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
    controls.dispose()
    scene.remove(globe)
    scene.remove(sky)
    disposeObject(scene)
    sky.geometry.dispose()
    ;(sky.material as THREE.Material).dispose()
    skyTex.dispose()
    renderer.dispose()
    if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement)
  }
}

export default function Globe3D({ height = 430 }: { height?: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [stats, setStats] = useState<GlobeStats | null>(null)
  const [statsErr, setStatsErr] = useState(false)
  const [globeErr, setGlobeErr] = useState('')

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let cleanup: (() => void) | undefined
    try {
      cleanup = mountGlobe(el, height)
    } catch (e) {
      setGlobeErr(e instanceof Error ? e.message : String(e))
    }
    return () => { cleanup?.() }
  }, [height])

  // 真实统计轮询（每 60s）
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const [m, s] = await Promise.all([
          fetch('/api/dashboard/metrics').then(r => r.json()),
          fetch('/api/community/feedback/stats').then(r => r.json()),
        ])
        if (!alive) return
        setStats({
          followers: m?.user?.totalFollowers?.value ?? 0,
          feedback: s?.total ?? 0,
          platforms: s?.platform ?? {},
        })
        setStatsErr(false)
      } catch {
        if (alive) setStatsErr(true)
      }
    }
    load()
    const timer = window.setInterval(load, STATS_POLL_MS)
    return () => { alive = false; window.clearInterval(timer) }
  }, [])

  const topPlatforms = stats ? Object.entries(stats.platforms).sort((a, b) => b[1] - a[1]).slice(0, 3) : []

  return (
    <div className="xj-panel" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <h3 style={{ fontSize: '0.75rem', color: '#DA1E2B', margin: 0, fontFamily: '"Noto Serif SC", serif' }}>地域分布 · 3D 全球</h3>
        {!globeErr && <span style={{ fontSize: '0.5625rem', color: '#5b8c9e', letterSpacing: '0.1em' }}>● 实时</span>}
      </div>

      {globeErr ? (
        <div style={{ height, borderRadius: 8, background: '#10161f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6875rem', color: '#8a8578', textAlign: 'center', padding: '0 24px', lineHeight: 1.8 }}>
          {globeErr}。本页其他数据不受影响，可在支持 WebGL 的浏览器中查看 3D 地球。
        </div>
      ) : (
        <div ref={containerRef} style={{ height, borderRadius: 8, overflow: 'hidden', position: 'relative', background: '#10161f' }}>
          {/* 统计覆盖层（真实库表） */}
          <div style={{ position: 'absolute', left: 12, top: 12, zIndex: 2, background: 'rgba(16,22,31,0.78)', border: '1px solid rgba(201,169,110,0.25)', borderRadius: 6, padding: '8px 12px', fontSize: '0.625rem', color: '#e8e2d3', lineHeight: 1.8, pointerEvents: 'none', fontFamily: '"Noto Sans SC",sans-serif' }}>
            {statsErr ? '后端未连接，统计数据暂不可用' : !stats ? '加载统计数据…' : (
              <>
                <div>全网粉丝 <b style={{ color: '#C9A96E' }}>{stats.followers.toLocaleString()}</b></div>
                <div>社区反馈 <b style={{ color: '#C9A96E' }}>{stats.feedback.toLocaleString()}</b> 条</div>
                <div>{topPlatforms.map(([k, v], i) => (
                  <span key={k}>{i > 0 && ' · '}{k} {v.toLocaleString()}</span>
                ))}</div>
              </>
            )}
          </div>
        </div>
      )}

      <p style={{ fontSize: '0.5625rem', color: '#6B6258', margin: '10px 0 0', lineHeight: 1.7 }}>
        地球基于开源 three-globe（MIT）构建 · 城市点位为运营枢纽示意（真实坐标），省份底图加载自阿里云 DataV GeoJSON ·
        统计覆盖层数据来自真实库表，每 60s 自动刷新；接入真实地域采集（如 IP 属地）后可替换点位数据
      </p>
    </div>
  )
}
