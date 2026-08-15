/*
 * 玄策 · 墨痕背景 —— SVG turbulence + displacementMap 有机晕染
 * 借鉴 zenHeart 的「墨痕」手法：fractalNoise 经位移映射后产生自然洇边，
 * 而非生硬的 radial-gradient 墨团。供 3D 陈列室 / 暗色区块做氛围底。
 * light 变体：暖纸上的淡墨（低透明）；dark 变体：暗底上的墨痕。
 */
import { useId } from 'react'
import { dark } from '../lib/theme'

interface InkWashBackgroundProps {
  variant?: 'dark' | 'light'
  opacity?: number
  /** 墨痕主条位置：'left' | 'right' | 'center' */
  position?: 'left' | 'right' | 'center'
  style?: React.CSSProperties
}

export default function InkWashBackground({ variant = 'dark', opacity = 1, position = 'left', style }: InkWashBackgroundProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const inkId = `iw-ink-${uid}`
  const blobId = `iw-blob-${uid}`

  const inkColor = variant === 'dark' ? '#1A1612' : '#2A1A0A'
  const accentColor = variant === 'dark' ? '#C9A96E' : '#B9894B'
  const stripPos: React.CSSProperties =
    position === 'left' ? { left: -60 }
    : position === 'right' ? { right: -60 }
    : { left: '50%', transform: 'translateX(-50%)' }

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
        ...style,
      }}
    >
      {/* 墨痕主条：窄条 + 大位移 → 有机洇边 */}
      <svg
        style={{ position: 'absolute', top: '12%', bottom: '8%', width: 340, maxWidth: '38vw', ...stripPos }}
        preserveAspectRatio="none"
        viewBox="0 0 340 800"
      >
        <defs>
          <filter id={inkId} x="-60%" y="-20%" width="220%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.011 0.006" numOctaves={4} seed={11} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={90} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <rect x="60" y="0" width="220" height="800" fill={inkColor} filter={`url(#${inkId})`} opacity={variant === 'dark' ? 0.85 : 0.5} />
      </svg>

      {/* 墨韵圆斑：点墨扩散 */}
      <svg
        style={{ position: 'absolute', width: 520, maxWidth: '46vw', top: '46%', ...(position === 'right' ? { left: '58%' } : { left: '6%' }) }}
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 520 520"
      >
        <defs>
          <filter id={blobId} x="-40%" y="-40%" width="180%" height="180%">
            <feTurbulence type="fractalNoise" baseFrequency="0.016" numOctaves={3} seed={23} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={70} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <circle cx="260" cy="260" r="150" fill={variant === 'dark' ? accentColor : inkColor} filter={`url(#${blobId})`} opacity={variant === 'dark' ? 0.07 : 0.05} />
      </svg>

      {/* 底部淡墨渐隐 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: variant === 'dark'
            ? `radial-gradient(80% 55% at 30% 20%, rgba(212,160,74,0.05), transparent 62%), linear-gradient(180deg, ${dark.paper} 0%, rgba(14,13,12,0.92) 100%)`
            : 'linear-gradient(180deg, rgba(245,241,230,0) 0%, rgba(239,233,218,0.9) 100%)',
          opacity,
        }}
      />
    </div>
  )
}
