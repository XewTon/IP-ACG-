/*
 * 玄策 · 设计 token —— 「纸上墨影」
 * 与 index.css :root 对齐的 TS 侧常量，供组件内联样式 / three.js 场景使用。
 * 色板来源：宣纸底 + 五级墨色（InkPaper 规范）+ 玄机红 / 天行金 / 石青。
 * 暗色组借鉴 Midnight Ink（暖墨暗色 Editorial）。
 */
export const ink = {
  paper: '#F5F1E6',
  paperDeep: '#EFE9DA',
  card: '#FCFAF4',
  ink: '#2A2E37',
  inkSoft: '#565D69',
  muted: '#6E685C',
  faint: '#8A8578',
  line: 'rgba(42,46,55,0.12)',
  lineSoft: 'rgba(42,46,55,0.06)',
  red: '#DA1E2B',
  gold: '#D9A845',
  blue: '#5B8C9E',
  white: '#FBF7EE',
} as const

export const dark = {
  paper: '#0E0D0C',
  paper2: '#1A1714',
  ink: '#ECE2CF',
  muted: '#9A8C75',
  line: 'rgba(236,226,207,0.22)',
  accent: '#D4A04A',
  red: '#DA1E2B',
  gold: '#C9A96E',
  blue: '#5B8C9E',
} as const

export const seal = {
  red: '#DA1E2B',
  white: '#FBF7EE',
} as const

export const type = {
  serif: '"Noto Serif SC", serif',
  sans: '"Noto Sans SC", sans-serif',
} as const

export const radii = { sm: 6, md: 10, lg: 14 } as const

export const motion = { fast: '0.25s', mid: '0.45s', slow: '0.9s' } as const
