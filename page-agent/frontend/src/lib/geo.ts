/*
 * 玄策 · 定位：浏览器 geolocation → localStorage 缓存（1 天）→ 失败回退北京
 */
const LS_GEO = 'weather_geo'
const GEO_TTL = 24 * 60 * 60 * 1000
const FALLBACK = { lat: 39.9042, lon: 116.4074 } // 北京

export interface GeoCoord {
  lat: number
  lon: number
}

export function getCachedGeo(): GeoCoord | null {
  try {
    const raw = localStorage.getItem(LS_GEO)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { lat: number; lon: number; ts: number }
    if (Date.now() - parsed.ts > GEO_TTL) return null
    return { lat: parsed.lat, lon: parsed.lon }
  } catch {
    return null
  }
}

export function resolveGeo(): Promise<GeoCoord> {
  const cached = getCachedGeo()
  if (cached) return Promise.resolve(cached)
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(FALLBACK)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coord = { lat: pos.coords.latitude, lon: pos.coords.longitude }
        try {
          localStorage.setItem(LS_GEO, JSON.stringify({ ...coord, ts: Date.now() }))
        } catch {
          /* ignore */
        }
        resolve(coord)
      },
      () => resolve(FALLBACK),
      { timeout: 5000, maximumAge: 10 * 60 * 1000 },
    )
  })
}
