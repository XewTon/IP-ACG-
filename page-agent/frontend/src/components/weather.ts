// 玄策 · 天气系统状态机
// sunny → cloudy → rain → storm → snow → fog
// 实时模式：WeatherFX 从 OpenWeather 拉取 → setFromApi 驱动；随机自动切换仅作 API 不可用兜底

export type Weather = 'sunny' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog'

export interface WeatherState {
  current: Weather
  intensity: number     // 0-1，天气强度（API 降雨/降雪/风速驱动）
  windSpeed: number     // 风速 m/s（API 驱动，雨雪倾角/速度联动）
  transitionProgress: number  // 0-1，过渡进度
  moonBrightness: number      // 0-1
  cloudOpacity: number        // 0-1
  goldParticleBoost: number   // 金色粒子增强
  timestamp: number
}

const WEATHER_PARAMS: Record<Weather, Omit<WeatherState, 'current' | 'transitionProgress' | 'timestamp' | 'windSpeed'>> = {
  sunny:  { intensity: 0.2, moonBrightness: 1.0,  cloudOpacity: 0.1, goldParticleBoost: 1.5 },
  cloudy: { intensity: 0.5, moonBrightness: 0.6,  cloudOpacity: 0.5, goldParticleBoost: 0.8 },
  rain:   { intensity: 0.7, moonBrightness: 0.3,  cloudOpacity: 0.8, goldParticleBoost: 0.4 },
  storm:  { intensity: 1.0, moonBrightness: 0.15, cloudOpacity: 0.95,goldParticleBoost: 0.2 },
  snow:   { intensity: 0.4, moonBrightness: 0.7,  cloudOpacity: 0.6, goldParticleBoost: 0.9 },
  fog:    { intensity: 0.6, moonBrightness: 0.4,  cloudOpacity: 0.9, goldParticleBoost: 0.5 },
}

// 天气切换时间（ms）
const TRANSITION_DURATION = 8000

// 天气保持时间范围（ms）（仅兜底随机模式使用）
const WEATHER_DURATION_MIN = 30000
const WEATHER_DURATION_MAX = 120000

export class WeatherSystem {
  state: WeatherState
  private target: WeatherState
  private transitionStart: number = 0
  private nextChange: number = 0
  private onChange?: (w: Weather) => void
  private durationMin: number
  private durationMax: number
  /** 兜底随机模式开关（API 不可用时由 WeatherFX 置 true） */
  auto: boolean

  constructor(initial: Weather = 'sunny', onChange?: (w: Weather) => void, opts?: { min?: number; max?: number; auto?: boolean }) {
    this.onChange = onChange
    this.durationMin = opts?.min ?? WEATHER_DURATION_MIN
    this.durationMax = opts?.max ?? WEATHER_DURATION_MAX
    this.auto = opts?.auto ?? false
    const params = WEATHER_PARAMS[initial]
    this.state = { current: initial, transitionProgress: 1, timestamp: Date.now(), windSpeed: 0, ...params }
    this.target = { ...this.state }
    this.scheduleNext()
  }

  private scheduleNext() {
    this.nextChange = Date.now() + this.durationMin + Math.random() * (this.durationMax - this.durationMin)
  }

  /** 平滑过渡到目标天气 */
  private lerp(a: number, b: number, t: number): number {
    // easeInOutCubic
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    return a + (b - a) * eased
  }

  update(now: number): WeatherState {
    // 兜底随机模式（API 不可用时 WeatherFX 会置 auto=true）
    if (this.auto && now >= this.nextChange && this.state.transitionProgress >= 1) {
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
        windSpeed: this.lerp(this.state.windSpeed, this.target.windSpeed, progress),
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
    this.target = { current: w, transitionProgress: 1, timestamp: Date.now(), windSpeed: this.state.windSpeed, ...params }
    this.onChange?.(w)
  }

  /** 实时天气驱动：API 数据 → 天气 + 强度 + 风速（8s 平滑过渡，保留原有氛围参数） */
  setFromApi(w: Weather, intensity: number, windSpeed = 0) {
    const params = WEATHER_PARAMS[w]
    this.transitionStart = Date.now()
    this.state = { ...this.state, transitionProgress: 0 }
    this.target = {
      current: w,
      transitionProgress: 1,
      timestamp: Date.now(),
      ...params,
      intensity: Math.min(1, Math.max(0.15, intensity)),
      windSpeed,
    }
    this.onChange?.(w)
  }
}

/** 全局共享天气状态单例（Particles 人物层与 WeatherFX 天气层共用） */
export const weatherSys = new WeatherSystem('sunny')
