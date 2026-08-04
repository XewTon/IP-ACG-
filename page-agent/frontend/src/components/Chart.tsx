import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

interface Props {
  data: Record<string, number | string>[]
  lines: { key: string; color: string; name: string }[]
  xKey?: string
  height?: number
}

const defaultColors = ['#e74c3c', '#f97316', '#ec4899', '#22c55e']

export default function Chart({ data, lines, xKey = 'date', height = 280 }: Props) {
  if (!data.length) {
    return <div className="flex items-center justify-center h-64 text-ink-400 text-sm">暂无数据</div>
  }

  const resolvedLines = lines.length ? lines : Object.keys(data[0])
    .filter(k => k !== xKey)
    .map((k, i) => ({ key: k, color: defaultColors[i % defaultColors.length], name: k }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
        <XAxis dataKey={xKey} tick={{ fontSize: 12 }} stroke="#a8a29e" />
        <YAxis tick={{ fontSize: 12 }} stroke="#a8a29e" tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #e7e5e4', fontSize: 13 }}
          formatter={(value: number) => [value.toLocaleString(), '']}
        />
        <Legend />
        {resolvedLines.map(line => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            stroke={line.color}
            name={line.name}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
