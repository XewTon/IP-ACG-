/*
 * 玄策 · 玄机作品分区（与官网导航一致：https://www.xjent.com/）
 * 展示柜按「作品」分区浏览；壁纸的系列归属由 xuanjiWallpapers.ts 的 series 字段决定，
 * 需要手工调整时在下方 SERIES_OVERRIDES 映射表中改一行即可（id → 系列 id）。
 */
export type SeriesId =
  | 'qinshimingyue'
  | 'tianxingjiuge'
  | 'wugengji'
  | 'douluodalu'
  | 'tianbao'
  | 'tunshixingkong'
  | 'shixiong'
  | 'jueshitangmen'
  | 'tianyu'
  | 'mushenji'
  | 'official'

export interface SeriesInfo {
  id: SeriesId
  name: string
  /** 官网对应作品页（供跳转/标注来源） */
  siteUrl: string
}

export const SERIES: SeriesInfo[] = [
  { id: 'qinshimingyue', name: '秦时明月', siteUrl: 'http://www.xjent.com/100035/' },
  { id: 'tianxingjiuge', name: '天行九歌', siteUrl: 'http://www.xjent.com/100045/' },
  { id: 'wugengji', name: '武庚纪', siteUrl: 'http://www.xjent.com/100050/' },
  { id: 'douluodalu', name: '斗罗大陆', siteUrl: 'http://www.xjent.com/100058/' },
  { id: 'tianbao', name: '天宝伏妖录', siteUrl: 'http://www.xjent.com/100067/' },
  { id: 'tunshixingkong', name: '吞噬星空', siteUrl: 'http://www.xjent.com/100072/' },
  { id: 'shixiong', name: '师兄啊师兄', siteUrl: 'http://www.xjent.com/100081/' },
  { id: 'jueshitangmen', name: '斗罗大陆Ⅱ绝世唐门', siteUrl: 'http://www.xjent.com/100077/' },
  { id: 'tianyu', name: '天谕', siteUrl: 'http://www.xjent.com/100054/' },
  { id: 'mushenji', name: '牧神记', siteUrl: 'http://www.xjent.com/100085/' },
  { id: 'official', name: '官方壁纸精选', siteUrl: 'http://www.xjent.com/100033/' },
]

export const SERIES_NAME: Record<string, string> = Object.fromEntries(
  SERIES.map((s) => [s.id, s.name]),
)

/**
 * 壁纸手动归系列（一行一条）：把精选壁纸归入对应作品区。
 * 例：'xj-2025-09': 'tianxingjiuge'
 */
export const SERIES_OVERRIDES: Record<string, SeriesId> = {
  // 'xj-2024-qixi': 'tianxingjiuge',
}

/** 计算壁纸最终所属系列（override 优先） */
export function wallpaperSeries(series: string, id: string): SeriesId {
  const o = SERIES_OVERRIDES[id]
  if (o) return o
  return (SERIES.some((s) => s.id === series) ? series : 'official') as SeriesId
}
