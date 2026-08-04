// 九歌 · 天气系统状态机
// sunny → cloudy → rain → storm → snow → fog

export type Weather = 'sunny' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog'

export interface WeatherState {
  current: Weather
  intensity: number     // 0-1，天气强度
  transitionProgress: number  // 0-1，过渡进度
  moonBrightness: number      // 0-1
  cloudOpacity: number        // 0-1
  goldParticleBoost: number   // 金色粒子增强
  timestamp: number
}

const WEATHER_PARAMS: Record<Weather, Omit<WeatherState, 'current' | 'transitionProgress' | 'timestamp'>> = {
  sunny:  { intensity: 0.2, moonBrightness: 1.0,  cloudOpacity: 0.1, goldParticleBoost: 1.5 },
  cloudy: { intensity: 0.5, moonBrightness: 0.6,  cloudOpacity: 0.5, goldParticleBoost: 0.8 },
  rain:   { intensity: 0.7, moonBrightness: 0.3,  cloudOpacity: 0.8, goldParticleBoost: 0.4 },
  storm:  { intensity: 1.0, moonBrightness: 0.15, cloudOpacity: 0.95,goldParticleBoost: 0.2 },
  snow:   { intensity: 0.4, moonBrightness: 0.7,  cloudOpacity: 0.6, goldParticleBoost: 0.9 },
  fog:    { intensity: 0.6, moonBrightness: 0.4,  cloudOpacity: 0.9, goldParticleBoost: 0.5 },
}

// 天气切换时间（ms）
const TRANSITION_DURATION = 8000

// 天气保持时间范围（ms）
const WEATHER_DURATION_MIN = 30000
const WEATHER_DURATION_MAX = 120000

export class WeatherSystem {
  state: WeatherState
  private target: WeatherState
  private transitionStart: number = 0
  private nextChange: number = 0
  private onChange?: (w: Weather) => void

  constructor(initial: Weather = 'sunny', onChange?: (w: Weather) => void) {
    this.onChange = onChange
    const params = WEATHER_PARAMS[initial]
    this.state = { current: initial, transitionProgress: 1, timestamp: Date.now(), ...params }
    this.target = { ...this.state }
    this.scheduleNext()
  }

  private scheduleNext() {
    this.nextChange = Date.now() + WEATHER_DURATION_MIN + Math.random() * (WEATHER_DURATION_MAX - WEATHER_DURATION_MIN)
  }

  /** 平滑过渡到目标天气 */
  private lerp(a: number, b: number, t: number): number {
    // easeInOutCubic
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    return a + (b - a) * eased
  }

  update(now: number): WeatherState {
    // 自动切换天气
    if (now >= this.nextChange && this.state.transitionProgress >= 1) {
      const weathers: Weather[] = ['sunny', 'cloudy', 'rain', 'storm', 'snow', 'fog']
      const next = weathers[Math.floor(Math.random() * weathers.length)]
      // 避免极端跳转
      if (next !== this.state.current) {
        this.setWeather(next)
      }
      this.scheduleNext()
    }

    // 过渡计算
    if (this.state.transitionProgress < 1) {
      const elapsed = now - this.transitionStart
      const progress = Math.min(1, elapsed / TRANSITION_DURATION)

      this.state = {
        ...this.state,
        transitionProgress: progress,
        intensity: this.lerp(this.state.intensity, this.target.intensity, progress),
        moonBrightness: this.lerp(this.state.moonBrightness, this.target.moonBrightness, progress),
        cloudOpacity: this.lerp(this.state.cloudOpacity, this.target.cloudOpacity, progress),
        goldParticleBoost: this.lerp(this.state.goldParticleBoost, this.target.goldParticleBoost, progress),
        timestamp: now,
      }

      if (progress >= 1) {
        this.state.current = this.target.current
      }
    }

    return this.state
  }

  setWeather(w: Weather) {
    const params = WEATHER_PARAMS[w]
    this.transitionStart = Date.now()
    this.state = { ...this.state, transitionProgress: 0 }
    this.target = { current: w, transitionProgress: 1, timestamp: Date.now(), ...params }
    this.onChange?.(w)
  }
}
