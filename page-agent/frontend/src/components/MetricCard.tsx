import { TrendingUp, TrendingDown } from 'lucide-react'

interface Props {
  label: string
  value: string | number
  change?: number
  changeLabel?: string
  icon?: React.ReactNode
  className?: string
}

const platformColorMap: Record<string, string> = {
  bilibili: 'border-l-pink-400 bg-pink-50/50',
  weibo: 'border-l-orange-400 bg-orange-50/50',
  xiaohongshu: 'border-l-red-400 bg-red-50/50',
  wechat: 'border-l-green-400 bg-green-50/50',
}

export default function MetricCard({ label, value, change, changeLabel, icon, className = '' }: Props) {
  const borderClass = Object.entries(platformColorMap).find(([k]) => label.includes(k))?.[1] || 'border-l-ink-400 bg-white'

  return (
    <div className={`rounded-xl border border-ink-200 border-l-4 p-5 ${borderClass} ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-ink-500">{label}</span>
        {icon && <span className="text-ink-400">{icon}</span>}
      </div>
      <div className="text-2xl font-bold text-ink-800">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {change !== undefined && (
        <div className={`flex items-center gap-1 mt-1.5 text-xs ${change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          <span>{change >= 0 ? '+' : ''}{change}{changeLabel ? ` ${changeLabel}` : ''}</span>
        </div>
      )}
    </div>
  )
}
