/*
 * 玄策 · 水墨笔触书法标 —— 头部左上角品牌 LOGO
 *
 * 墨色「玄策」衬线字 + feTurbulence/feDisplacementMap 毛边滤镜模拟毛笔笔触：
 *  - baseFrequency 取 x/y 各向异性值，产生近似笔锋走向的条纹噪声
 *  - displacement scale 取 15，笔画边缘明显粗糙化（手绘感）
 * 滤镜 seed 固定，同参数下可复现同一笔触；useId 保证多实例滤镜 id 不冲突。
 * 印章落款默认关闭（小尺寸下易被误认为色块），需要时 showSeal 开启。
 */
import { useId } from 'react'
import Seal from './Seal'

interface XuanCeLogoProps {
  /** 字标高（px），印章按比例缩放 */
  size?: number
  /** 是否显示朱砂印章落款（默认关闭：小尺寸下印章易被误认为色块） */
  showSeal?: boolean
  /** 笔触滤镜随机种子，固定可复现 */
  seed?: number
  style?: React.CSSProperties
}

export default function XuanCeLogo({ size = 42, showSeal = false, seed = 7, style }: XuanCeLogoProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const brushId = `xc-brush-${uid}`

  // 文字垂直居中 + 字号留边，保证「字的下沿 + 毛边位移」不被 viewBox 裁切（此前下半身被裁）
  const fontPx = Math.round(size * 0.62)
  const textY = Math.round(size * 0.5)
  const svgW = Math.round(size * 2.7)
  const cx = svgW / 2

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.18), lineHeight: 1, ...style }}>
      {/* 笔触字标 */}
      <svg
        width={svgW}
        height={size}
        viewBox={`0 0 ${svgW} ${size}`}
        aria-hidden="true"
        role="presentation"
        style={{ display: 'block', flexShrink: 0 }}
      >
        <defs>
          {/* x/y 各向异性噪声 + 大位移量 → 明显毛笔毛边（位移 14 ≤ 安全余量，不裁字） */}
          <filter id={brushId} x="-20%" y="-30%" width="140%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.07 0.09" numOctaves={3} seed={seed} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={14} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <text x={cx} y={textY} textAnchor="middle" dominantBaseline="central"
          fontFamily='"Noto Serif SC", "SimSun", serif' fontWeight={700} fontSize={fontPx}
          fill="#2A2E37" filter={`url(#${brushId})`}>玄策</text>
      </svg>

      {/* 朱砂印章落款（可选） */}
      {showSeal && (
        <Seal
          text="玄策"
          type="yang"
          shape="square"
          size={Math.max(16, Math.round(size * 0.62))}
          seed={seed + 1}
          style={{ marginTop: Math.round(size * 0.14), flexShrink: 0 }}
        />
      )}
    </span>
  )
}
