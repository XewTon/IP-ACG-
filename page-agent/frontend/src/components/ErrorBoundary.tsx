/*
 * 玄策 · 通用错误边界 —— 捕获子组件渲染/生命周期异常，降级为提示卡片，
 * 防止某个模块（如 3D 地球）出错时 React 卸载整棵树导致整页白屏。
 */
import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="xj-panel" style={{ padding: 18, fontSize: '0.6875rem', color: 'var(--xj-red)', lineHeight: 1.8 }}>
          该模块加载失败：{String(this.state.error?.message || this.state.error)}（不影响本页其他内容）
        </div>
      )
    }
    return this.props.children
  }
}
