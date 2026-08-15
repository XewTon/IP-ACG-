/*
 * 玄策 · 朱砂印章组件 —— 借鉴 valaxy-theme-shuimo 印章算法（简化版）
 * 阴/阳章 · 方/圆/椭圆 · 噪声毛边（feTurbulence + feDisplacementMap）· 固定 seed 可复现
 * 文本用逗号分列（如「受命,于天,既寿,永昌」），右起竖排，每列最多二字。
 * 仅作装饰（InkPaper 规范：印章不承担交互），交互需求请用按钮。
 */
import { useId, useMemo } from 'react'

export type SealType = 'yang' | 'yin' // 阳文：红底白字；阴文：白底红字
export type SealShape = 'square' | 'circle' | 'ellipse'

interface SealProps {
  /** 印章文字，逗号分隔为列，如 '玄策' / '受命,于天,既寿,永昌' */
  text: string
  type?: SealType
  shape?: SealShape
  /** 输出尺寸（px） */
  size?: number
  /** 随机种子，固定后可稳定复现同一枚印章 */
  seed?: number
  style?: React.CSSProperties
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export default function Seal({ text, type = 'yang', shape = 'square', size = 44, seed = 42, style }: SealProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const noiseId = `seal-noise-${uid}`

  const { cols, rows, grid } = useMemo(() => {
    const chars = text.replace(/[,，]/g, ' ').split(/\s+/).filter(Boolean)
    const c = Math.max(1, Math.ceil(chars.length / 2))
    const g: string[][] = []
    for (let i = 0; i < c; i++) {
      const col = chars.slice(i * 2, i * 2 + 2)
      g.push(col.length === 2 ? col : [col[0] ?? '', ''])
    }
    return { cols: g.length, rows: 2, grid: g }
  }, [text])

  const rng = useMemo(() => mulberry32(seed), [seed])
  // 毛边强度：由 seed 派生
  const dispScale = 3 + rng() * 4

  const fg = '#DA1E2B' // 朱砂
  const bg = '#FBF7EE' // 印泥反白
  const isYang = type === 'yang'
  const boxFill = isYang ? fg : 'transparent'
  const boxStroke = isYang ? 'none' : fg
  const textFill = isYang ? bg : fg

  const frame = { x: 1.5, y: 1.5, w: 46, h: 46, rx: 2.5 }
  const ell = shape === 'ellipse' ? { rx: 24.5, ry: 17 } : { rx: 23, ry: 23 }

  const cellW = 16
  const colW = cellW + 4

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 49 49"
      style={{ display: 'block', ...style }}
      aria-hidden="true"
      role="presentation"
    >
      <defs>
        <filter id={noiseId} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={seed} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={dispScale} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>

      <g filter={`url(#${noiseId})`}>
        {shape === 'square' && (
          <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} rx={frame.rx}
            fill={boxFill} stroke={boxStroke} strokeWidth={2.2} />
        )}
        {shape !== 'square' && (
          <ellipse cx={24.5} cy={24.5} rx={ell.rx} ry={ell.ry}
            fill={boxFill} stroke={boxStroke} strokeWidth={2.2} />
        )}
        {/* 文字：右起竖排，每列两字 */}
        {cols > 0 &&
          Array.from({ length: cols }).map((_, c) => {
            const colChars = Array.from({ length: rows }).map((_, r) => {
              const ch = grid?.[c]?.[r] ?? ''
              return ch
            })
            return colChars.map((ch, r) => {
              if (!ch) return null
              const x = 24.5 - (cols - 1 - c) * colW
              const y = 13 + r * 17
              return (
                <text key={`${c}-${r}`} x={x} y={y}
                  textAnchor="middle" dominantBaseline="central"
                  fontFamily='"Noto Serif SC", "SimSun", serif'
                  fontSize={ch.length > 1 ? 8 : 13}
                  fontWeight={700}
                  fill={textFill}
                  stroke={isYang ? 'none' : fg}
                  strokeWidth={isYang ? 0 : 0.4}
                  style={{ letterSpacing: 0 }}
                >
                  {ch}
                </text>
              )
            })
          })}
      </g>
    </svg>
  )
}
