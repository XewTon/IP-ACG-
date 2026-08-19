/*
 * 玄策 · 轻量任务看板（自研，替换 react-trello）
 * react-trello@2.2.11（2019 年库）在 React 18 + styled-components 6 + StrictMode 下运行时不兼容导致页面白屏，
 * 此处用原生 HTML5 拖拽实现等价功能：泳道列、卡片拖拽换列、逾期徽标、点击回调。
 * 数据完全由父级（供应链页）通过 props 驱动，与 supplyApi 无关。
 */
import { useRef, useState } from 'react'

export interface KanbanLane {
  id: string
  title: string
  accent?: string
}

export interface KanbanCardData {
  id: string
  laneId: string
  title: string
  label?: string
  description?: string
  badgeText?: string
  badgeColor?: string
}

interface Props {
  lanes: KanbanLane[]
  cards: KanbanCardData[]
  /** 拖拽换列：cardId, fromLaneId, toLaneId */
  onMove: (cardId: string, from: string, to: string) => void
  onCardClick?: (cardId: string) => void
  hint?: string
}

export default function Kanban({ lanes, cards, onMove, onCardClick, hint }: Props) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overLane, setOverLane] = useState<string | null>(null)
  const dragFrom = useRef<string | null>(null)

  return (
    <div>
      {hint && <div style={{ margin: '0 0 10px', fontSize: '0.625rem', color: '#6B6258' }}>{hint}</div>}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', overflowX: 'auto', paddingBottom: 8 }}>
        {lanes.map((lane) => {
          const laneCards = cards.filter((c) => c.laneId === lane.id)
          const isOver = overLane === lane.id && dragId != null
          return (
            <div
              key={lane.id}
              onDragOver={(e) => { e.preventDefault(); setOverLane(lane.id) }}
              onDragLeave={() => setOverLane((o) => (o === lane.id ? null : o))}
              onDrop={(e) => {
                e.preventDefault()
                setOverLane(null)
                const id = e.dataTransfer.getData('text/plain') || dragId
                if (id && dragFrom.current && dragFrom.current !== lane.id) {
                  onMove(id, dragFrom.current, lane.id)
                }
                setDragId(null)
                dragFrom.current = null
              }}
              style={{
                flex: '1 1 180px',
                minWidth: 168,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                background: isOver ? 'rgba(218,30,43,0.06)' : 'rgba(247,243,233,0.55)',
                border: isOver ? '1px dashed rgba(218,30,43,0.5)' : '1px solid #E4DCC8',
                borderRadius: 10,
                padding: '10px 8px',
                minHeight: 240,
                transition: 'background 0.2s, border-color 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 6px' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: lane.accent || '#DA1E2B', flexShrink: 0 }} />
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#2A2E37', fontFamily: '"Noto Serif SC",serif' }}>{lane.title}</span>
                <span style={{ fontSize: '0.5625rem', color: '#8a8578', marginLeft: 'auto' }}>{laneCards.length}</span>
              </div>

              {laneCards.length === 0 && (
                <div style={{ padding: '18px 8px', textAlign: 'center', fontSize: '0.5625rem', color: '#B9B2A4' }}>
                  拖拽卡片到此列
                </div>
              )}

              {laneCards.map((c) => (
                <div
                  key={c.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', c.id)
                    e.dataTransfer.effectAllowed = 'move'
                    setDragId(c.id)
                    dragFrom.current = c.laneId
                  }}
                  onDragEnd={() => { setDragId(null); dragFrom.current = null; setOverLane(null) }}
                  onClick={() => onCardClick?.(c.id)}
                  title={onCardClick ? '点击删除（需二次确认）' : undefined}
                  style={{
                    background: '#FFFFFF',
                    border: dragId === c.id ? '1px solid rgba(218,30,43,0.5)' : '1px solid #E8E0D0',
                    borderRadius: 8,
                    boxShadow: '0 1px 3px rgba(42,46,55,0.06)',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    opacity: dragId === c.id ? 0.55 : 1,
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: '#2A2E37', fontWeight: 500, lineHeight: 1.5 }}>{c.title}</div>
                  {c.label && <div style={{ fontSize: '0.625rem', color: '#DA1E2B', marginTop: 4 }}>{c.label}</div>}
                  {c.description && <div style={{ fontSize: '0.625rem', color: '#8a8578', marginTop: 2 }}>{c.description}</div>}
                  {c.badgeText && (
                    <span style={{
                      display: 'inline-block', marginTop: 6, fontSize: '0.5625rem',
                      color: c.badgeColor || '#fff', background: c.badgeColor || '#DA1E2B',
                      padding: '1px 8px', borderRadius: 999,
                    }}>
                      {c.badgeText}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
