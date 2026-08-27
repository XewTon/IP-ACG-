// 玄策 · 数据来源四级徽标（真实采集 / 部分真实 / 演示种子 / 估算占位 / 人工录入）
// status 取值：real / mixed / seed / estimate / manual

const STYLE: Record<string, { bg: string; color: string; label: string }> = {
  real: { bg: 'rgba(106,138,106,0.15)', color: '#4a6a4a', label: '真实采集' },
  mixed: { bg: 'rgba(91,140,158,0.15)', color: '#3f6a7a', label: '部分真实' },
  seed: { bg: 'rgba(217,168,69,0.18)', color: '#8a7a2a', label: '演示种子' },
  estimate: { bg: 'rgba(218,30,43,0.08)', color: '#A13A2A', label: '估算占位' },
  manual: { bg: 'rgba(74,106,122,0.15)', color: '#2f5570', label: '人工录入' },
}

export default function SourceBadge({ status, style }: { status?: string; style?: React.CSSProperties }) {
  const s = status || 'seed'
  const cfg = STYLE[s] || STYLE.seed
  return (
    <span
      style={{
        fontSize: '0.5rem',
        padding: '1px 7px',
        borderRadius: 8,
        background: cfg.bg,
        color: cfg.color,
        fontWeight: 600,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {cfg.label}
    </span>
  )
}
