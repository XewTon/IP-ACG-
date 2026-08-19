/*
 * 玄策 · 素材类型定义
 * 展示柜素材统一类型：3D 画廊 / 专业展柜 / 2D 陈列 共用。
 * 素材数据源：src/data/xuanjiWallpapers.ts（玄机官方壁纸精选，按作品分区）。
 */

export type AssetType = 'portrait' | 'artwork' | 'brand'

export interface IPAsset {
  id: string
  name: string
  /** 立绘 / 官图壁纸 / 品牌标志 */
  type: AssetType
  /** 来源作品 */
  work: string
  /** 图片路径（public 下） */
  src: string
  /** 宽高比（w/h） */
  aspect: number
  note: string
  tags: string[]
}

export const TYPE_LABEL: Record<AssetType, string> = {
  portrait: '立绘',
  artwork: '官图',
  brand: '标志',
}
