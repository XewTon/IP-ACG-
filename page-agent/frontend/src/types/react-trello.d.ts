declare module 'react-trello' {
  import * as React from 'react'

  export interface BoardCard {
    id: string
    title: string
    description?: string
    label?: string
    badgeText?: string
    metadata?: Record<string, unknown>
  }

  export interface BoardLane {
    id: string
    title: string
    cards: BoardCard[]
    label?: string
    style?: React.CSSProperties
  }

  export interface BoardData {
    lanes: BoardLane[]
  }

  export interface BoardProps {
    data?: BoardData
    draggable?: boolean
    style?: React.CSSProperties
    laneStyle?: React.CSSProperties
    cardStyle?: React.CSSProperties
    cardDragStyle?: React.CSSProperties
    onCardDragEnd?: (cardId: string, sourceLaneId: string, targetLaneId: string, position?: number) => void
    onCardClick?: (cardId: string, metadata?: Record<string, unknown>) => void
    laneDraggable?: boolean
    collapsibleLanes?: boolean
    editable?: boolean
    [key: string]: unknown
  }

  const Board: React.ComponentType<BoardProps>
  export default Board
}
