/*
 * 玄策 · OpenWeather 实时天气
 * 数据流：geolocation → Current Weather API → 映射到 Weather 枚举 + intensity/wind
 * 缓存：localStorage 30 分钟（WeatherFX 在 API 失败时回退）
 */
import type { Weather } from '../components/weather'
import { resolveGeo } from './geo'

export interface WeatherReport {
  weather: Weather
  intensity: number // 0-1
  windSpeed: number // m/s
  windDeg: number
  temp: number
  humidity: number
  clouds: number // 0-100
  rain1h?: number // mm/h
  snow1h?: number // mm/h
}

const LS_CACHE = 'weather_cache'
export const WEATHER_CACHE_TTL = 30 * 60 * 1000

function mapCode(code: number): Weather {
  if (code >= 200 && code < 300) return 'storm'
  if (code >= 300 && code < 400) return 'rain' // 毛毛雨
  if (code >= 500 && code < 600) return 'rain'
  if (code >= 600 && code < 700) return 'snow'
  if (code >= 700 && code < 800) return 'fog'
  if (code === 800) return 'sunny'
  return 'cloudy'
}

export function getCachedWeather(): { report: WeatherReport; ts: number } | null {
  try {
    const raw = localStorage.getItem(LS_CACHE)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function saveCachedWeather(report: WeatherReport) {
  try {
    localStorage.setItem(LS_CACHE, JSON.stringify({ report, ts: Date.now() }))
  } catch {
    /* ignore */
  }
}

export async function fetchWeather(): Promise<WeatherReport> {
  const { lat, lon } = await resolveGeo()
  const key = (import.meta.env.VITE_OPENWEATHER_KEY as string | undefined) ?? ''
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=zh_cn&appid=${encodeURIComponent(key)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`weather api ${res.status}`)
  const d = await res.json()
  const code = d.weather?.[0]?.id ?? 800
  const clouds = d.clouds?.all ?? 0
  const rain1h = d.rain?.['1h'] ?? 0
  const snow1h = d.snow?.['1h'] ?? 0
  const windSpeed = d.wind?.speed ?? 0
  const precip = Math.max(rain1h, snow1h)
  const intensity = Math.min(1, Math.max(0.3, precip / 4, windSpeed / 25, clouds / 100))
  return {
    weather: mapCode(code),
    intensity,
    windSpeed,
    windDeg: d.wind?.deg ?? 0,
    temp: d.main?.temp ?? 0,
    humidity: d.main?.humidity ?? 0,
    clouds,
    rain1h,
    snow1h,
  }
}

/** 拉取并缓存；失败时回退缓存，无缓存则抛错（由调用方走随机兜底） */
export async function getWeatherWithCache(): Promise<WeatherReport> {
  try {
    const report = await fetchWeather()
    saveCachedWeather(report)
    return report
  } catch (err) {
    const cached = getCachedWeather()
    if (cached) return cached.report
    throw err
  }
}
