/*
 * 玄策 · three.js 通用挂载工具（渲染器 / 缩放 / 帧循环 / 销毁）
 */
import * as THREE from 'three'

export function makeRenderer(canvas: HTMLCanvasElement, opaque = false): THREE.WebGLRenderer {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: !opaque })
  r.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  r.setSize(canvas.clientWidth, canvas.clientHeight, false)
  if (opaque) r.setClearColor(0x141a26, 1)
  else r.setClearColor(0x000000, 0)
  return r
}

export function bindResize(canvas: HTMLCanvasElement, cb: () => void): () => void {
  const on = () => {
    if (canvas.clientWidth > 0 && canvas.clientHeight > 0) cb()
  }
  window.addEventListener('resize', on)
  return () => window.removeEventListener('resize', on)
}

export function frameLoop(fn: (now: number) => void): () => void {
  let id = 0
  let stopped = false
  const f = (n: number) => {
    if (stopped) return
    try {
      fn(n)
    } catch (err) {
      console.error('[frameLoop] frame error, stopping loop:', err)
      stopped = true
      return
    }
    id = requestAnimationFrame(f)
  }
  id = requestAnimationFrame(f)
  return () => {
    stopped = true
    cancelAnimationFrame(id)
  }
}

export function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.geometry) m.geometry.dispose()
    const mat = m.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) mat.forEach((mm) => mm.dispose())
    else if (mat) mat.dispose()
  })
}
