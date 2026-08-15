import { useEffect, useState } from 'react'

interface Props {
  /** 显示时长（毫秒），默认 2800 */
  duration?: number
  /** 淡出动画时长（毫秒），默认 800 */
  fadeOut?: number
  onDone: () => void
}

export default function SplashScreen({ duration = 2800, fadeOut = 800, onDone }: Props) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setExiting(true), duration)
    const t2 = setTimeout(onDone, duration + fadeOut)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [duration, fadeOut, onDone])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: '#070d1a',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      opacity: exiting ? 0 : 1,
      transition: `opacity ${fadeOut}ms ease-out`,
    }}>
      {/* 背景微光 */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, rgba(200,155,60,0.06) 0%, transparent 70%)',
      }} />

      {/* 主图 */}
      <img
        src="/splash.png"
        alt="玄策"
        style={{
          maxWidth: '80vw', maxHeight: '65vh',
          objectFit: 'contain',
          filter: 'drop-shadow(0 0 60px rgba(200,155,60,0.2))',
          animation: 'splashFloat 3s ease-in-out infinite',
        }}
      />

      {/* 标题 */}
      <h1 style={{
        fontFamily: '"Noto Serif SC", serif',
        fontSize: '3rem', fontWeight: 700,
        color: '#DCE8FF', letterSpacing: '0.4em',
        textShadow: '0 0 60px rgba(200,155,60,0.3), 0 0 4px rgba(200,155,60,0.5)',
        margin: '32px 0 8px',
      }}>玄 策</h1>
      <p style={{
        fontFamily: '"Noto Sans SC", sans-serif',
        fontSize: '0.75rem', color: 'rgba(220,232,255,0.4)',
        letterSpacing: '0.3em',
      }}>国 漫 IP 智 能 运 营 中 心</p>

      {/* 底部进度线 */}
      <div style={{
        position: 'absolute', bottom: '12%',
        width: '120px', height: '1px',
        background: 'rgba(200,155,60,0.2)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', background: 'rgba(200,155,60,0.6)',
          animation: `splashProgress ${duration}ms linear forwards`,
        }} />
      </div>
    </div>
  )
}
