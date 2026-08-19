/*
 * 玄策 · 页面雨幕 —— codrops/RainEffect 稀疏雨滴氛围层
 * 雨滴从开机动画挪到页面背景：固定全屏、pointer-events 穿透、z-index 低于内容层，
 * 雨滴折射"宣纸底"纹理，在浅色页面背景上呈细密水滴质感，不干扰阅读。
 * 软渲染（SwiftShader 等）自动跳过（双 WebGL 开销大）。
 */
import { useEffect, useRef } from 'react'
import { createRainEffect, type RainEffect } from '../lib/rainEffect'

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

/* 折射源：宣纸底 + 淡蓝水感细网格（雨滴在浅色页面上可见但不刺眼） */
function makePaperTexture(): HTMLCanvasElement {
  const W = 512
  const H = 288
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#F1ECDD')
  g.addColorStop(1, '#E8E2D0')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(120,140,165,0.10)'
  ctx.lineWidth = 1
  for (let x = 0; x < W; x += 26) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
  }
  for (let y = 0; y < H; y += 26) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }
  return c
}

export default function PageRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || SOFT_RENDERER) return
    let fx: RainEffect | null = null
    const paper = makePaperTexture()
    fx = createRainEffect(canvas, paper, {
      brightness: 1.05,
      alphaMultiply: 6,
      alphaSubtract: 3,
      minRefraction: 60,
      maxRefraction: 200,
      resolutionScale: 0.55,
      // 稀疏雨量（氛围而非效果）
      minR: 16, maxR: 44,
      rainChance: 0.08,
      rainLimit: 2,
      dropletsRate: 6,
      dropletsSize: [3, 5],
      trailRate: 0.6,
      trailScaleRange: [0.2, 0.35],
    })
    if (fx) fx.setIntensity(0.42)

    const onResize = () => fx?.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      fx?.dispose()
    }
  }, [])

  return <canvas ref={canvasRef} className="page-rain" aria-hidden />
}
