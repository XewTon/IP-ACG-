/*
 * 玄策 · 3D 陈列馆素材清单 —— 玄机旗下素材即插即用
 * 新增素材：往 ASSETS 数组加一项即可（图片放 public/ 下）。
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

export const ASSETS: IPAsset[] = [
  {
    id: 'splash-figure',
    name: '卫庄 · 横版立绘',
    type: 'portrait',
    work: '秦时明月',
    src: '/splash_figure.png',
    aspect: 1672 / 941,
    note: '透明底立绘，用作启动聚形粒子源与展柜陈列主像。',
    tags: ['立绘', '透明底', '粒子源'],
  },
  {
    id: 'wz-wallpaper',
    name: '卫庄 · 新造型壁纸',
    type: 'artwork',
    work: '秦时明月',
    src: '/wz.jpg',
    aspect: 1920 / 1080,
    note: '横版壁纸，场景背景与官图陈列两用。',
    tags: ['壁纸', '横版'],
  },
  {
    id: 'txjg-art',
    name: '天行九歌 · 竖版官图',
    type: 'artwork',
    work: '天行九歌',
    src: '/tianxingjiuge.jpg',
    aspect: 1080 / 2160,
    note: '竖版海报，墨影点云与浮雕管线的默认采样源。',
    tags: ['官图', '竖版', '采样源'],
  },
  {
    id: 'reference',
    name: '角色 · 设定参考图',
    type: 'artwork',
    work: '玄机素材',
    src: '/reference.png',
    aspect: 1086 / 1448,
    note: '角色设定参考，竖版。',
    tags: ['设定', '参考图', '竖版'],
  },
  {
    id: 'splash-visual',
    name: '玄策 · 启动主视觉',
    type: 'artwork',
    work: '玄机科技',
    src: '/splash.png',
    aspect: 1672 / 941,
    note: '品牌启动画面主视觉，横版。',
    tags: ['品牌', '横版', '主视觉'],
  },
  {
    id: 'xj-logo',
    name: '玄机科技 · 标志',
    type: 'brand',
    work: '玄机科技',
    src: '/xj_logo.png',
    aspect: 218 / 63,
    note: '黑底红字 logo，运行时 chroma-key 抠底。',
    tags: ['logo', '品牌'],
  },
  {
    id: 'txjg-logo',
    name: '天行九歌 · 标志',
    type: 'brand',
    work: '天行九歌',
    src: '/txjg_logo.png',
    aspect: 151 / 58,
    note: '透明底 logo，可直接贴片。',
    tags: ['logo', '品牌'],
  },
]

export const TYPE_LABEL: Record<AssetType, string> = {
  portrait: '立绘',
  artwork: '官图',
  brand: '标志',
}
