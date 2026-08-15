/*
 * 玄策 · 3D 素材管线
 * 立绘采样（与 Particles.tsx 同源逻辑）→ 点云数据 / 浮雕亮度图 / logo 抠底贴图
 * 供「3D 陈列室」四个 demo 复用；全部返回纯数据，demo 自行组装 three.js 对象
 */
// 中心裁剪窗（人物居中主体），与 2D 粒子一致
const CX0 = 0.10, CX1 = 0.90, CY0 = 0.03, CY1 = 0.97

export const PALETTE = {
  ink: '#2A2E37',
  inkMid: '#3A3E4A',
  inkLight: '#545A66',
  red: '#DA1E2B',
  gold: '#D9A845',
  green: '#5B8C9E',
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = () => reject(new Error('素材加载失败: ' + src))
    im.src = src
  })
}

function cropCanvas(im: HTMLImageElement, maxH: number): HTMLCanvasElement {
  const h = Math.min(im.height, maxH)
  const w = Math.round((im.width * h) / im.height)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  c.getContext('2d')!.drawImage(im, 0, 0, w, h)
  return c
}

/* ---------------- 掩码（与 Particles.tsx 相同的四段式） ---------------- */
function buildMask(data: Uint8ClampedArray, Wd: number, Hd: number, cx0: number, cx1: number, cy0: number, cy1: number): { mask: Uint8Array; fill: Uint8Array } {
  const rawL = new Float32Array(Wd * Hd)
  const lum = new Float32Array(Wd * Hd)
  for (let y = 0; y < Hd; y++)
    for (let x = 0; x < Wd; x++) {
      const i = (y * Wd + x) * 4
      const r = data[i], g = data[i + 1], b = data[i + 2]
      const l = r * 0.299 + g * 0.587 + b * 0.114
      rawL[i] = l
      let lp = (l - 128) * 1.45 + 128
      if (lp < 60) lp *= 0.4
      lum[i] = Math.min(255, Math.max(0, lp))
    }
  const mask = new Uint8Array(Wd * Hd)
  for (let y = cy0; y < cy1; y++)
    for (let x = cx0; x < cx1; x++) {
      const i = y * Wd + x
      if (lum[i] > 30) { mask[i] = 1; continue }
      const si = i * 4
      const mx = Math.max(data[si], data[si + 1], data[si + 2])
      const mn = Math.min(data[si], data[si + 1], data[si + 2])
      if (mx - mn > 42 && rawL[i] > 26) mask[i] = 1
    }
  const mag = new Float32Array(Wd * Hd)
  let sum = 0
  for (let y = cy0 + 1; y < cy1 - 1; y++)
    for (let x = cx0 + 1; x < cx1 - 1; x++) {
      const i = y * Wd + x
      const gx = -lum[i - Wd - 1] - 2 * lum[i - 1] - lum[i + Wd - 1] + lum[i - Wd + 1] + 2 * lum[i + 1] + lum[i + Wd + 1]
      const gy = -lum[i - Wd - 1] - 2 * lum[i - Wd] - lum[i - Wd + 1] + lum[i + Wd - 1] + 2 * lum[i + Wd] + lum[i + Wd + 1]
      mag[i] = Math.sqrt(gx * gx + gy * gy)
      sum += mag[i]
    }
  const E = (sum / ((cx1 - cx0) * (cy1 - cy0))) * 1.4
  for (let y = cy0; y < cy1; y++)
    for (let x = cx0; x < cx1; x++) {
      const i = y * Wd + x
      if (mag[i] > E) mask[i] = 1
    }
  const fill = new Uint8Array(Wd * Hd)
  for (let y = cy0 + 1; y < cy1 - 1; y++)
    for (let x = cx0 + 1; x < cx1 - 1; x++) {
      const i = y * Wd + x
      if (mask[i]) continue
      let n = 0
      n += mask[i - 1] + mask[i + 1] + mask[i - Wd] + mask[i + Wd]
      n += mask[i - Wd - 1] + mask[i - Wd + 1] + mask[i + Wd - 1] + mask[i + Wd + 1]
      if (n >= 4) fill[i] = 1
    }
  return { mask, fill }
}

/* ---------------- 点云 ---------------- */
export interface PointCloud {
  positions: Float32Array // x,y,z；z=亮度深度（亮部朝镜头）
  colors: Float32Array // r,g,b (0-1)，含朱砂/天行金点缀（PALETTE 量化）
  sourceColors?: Float32Array // r,g,b (0-1) 原图真实色彩（GPU 粒子用）
  hotFlags?: Uint8Array // 1=朱砂红/天行金热区（辉光层用）
  counts: { total: number; ink: number; red: number; gold: number }
  aspect: number // 裁剪窗宽高比（世界 x/y 比例）
  foreground?: HTMLCanvasElement // 背景剔除后的透明立绘（粒子聚形后显影层用）
}

const hexToF = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16) / 255,
  parseInt(hex.slice(3, 5), 16) / 255,
  parseInt(hex.slice(5, 7), 16) / 255,
]

/* 温和的色彩增强（保留原图色相）：轻度提饱和 + 提亮暗部，
 * 让立绘主体（大面积墨色）不再发灰发暗，又不变成纯色全息体。 */
function enhanceColor(r: number, g: number, b: number): [number, number, number] {
  const lv = (r * 0.299 + g * 0.587 + b * 0.114) / 255
  const s = 0.3 // 饱和度增强幅度
  const gray = lv * 255
  const er = Math.min(255, gray + (r - gray) * (1 + s))
  const eg = Math.min(255, gray + (g - gray) * (1 + s))
  const eb = Math.min(255, gray + (b - gray) * (1 + s))
  // 暗部抬升：防止墨色区域在黑背景上失去轮廓（幅度克制，保留墨色明暗对比，避免过曝发灰）
  const lift = lv < 0.28 ? 1 + (0.28 - lv) * 0.28 : 1
  // 高光软压缩：亮部（白衣/白发/光效）向 0.79 收敛，防止立绘显影时"蹦出"过曝，保留轮廓对比
  const soft = (v: number) => (v < 0.62 ? v : 0.62 + (v - 0.62) * 0.45)
  return [
    soft(Math.min(1, (er * lift) / 255)),
    soft(Math.min(1, (eg * lift) / 255)),
    soft(Math.min(1, (eb * lift) / 255)),
  ]
}

export async function buildPointCloud(src: string, target = 60000): Promise<PointCloud> {
  const im = await loadImage(src)
  const c = cropCanvas(im, 1024)
  const Wd = c.width, Hd = c.height
  const data = c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, Wd, Hd).data
  const cx0 = Math.round(Wd * CX0), cx1 = Math.round(Wd * CX1)
  const cy0 = Math.round(Hd * CY0), cy1 = Math.round(Hd * CY1)
  const cw = cx1 - cx0, chh = cy1 - cy0
  const aspect = cw / chh
  const { mask, fill } = buildMask(data, Wd, Hd, cx0, cx1, cy0, cy1)
  const isFg = (x: number, y: number) => mask[y * Wd + x] === 1 || fill[y * Wd + x] === 1

  let step = 1
  for (let t = 0; t < 9; t++) {
    let n = 0
    for (let y = cy0; y < cy1; y += step) for (let x = cx0; x < cx1; x += step) if (isFg(x, y)) n++
    if (n > target * 1.1) step++
    else if (n < target * 0.7 && step > 1) step--
    else break
  }

  const inkC = hexToF(PALETTE.ink), inkMidC = hexToF(PALETTE.inkMid), inkLightC = hexToF(PALETTE.inkLight)
  const redC = hexToF(PALETTE.red), goldC = hexToF(PALETTE.gold)
  const pos: number[] = [], col: number[] = []
  const counts = { total: 0, ink: 0, red: 0, gold: 0 }
  const depth = 1.05
  for (let y = cy0; y < cy1; y += step)
    for (let x = cx0; x < cx1; x += step) {
      if (!isFg(x, y)) continue
      const i = y * Wd + x
      const lv = (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114) / 255
      let tone: 'ink' | 'red' | 'gold' = 'ink'
      if (lv > 0.78) {
        const rn = Math.random()
        if (rn < 0.045) tone = 'red'
        else if (rn < 0.06) tone = 'gold'
      }
      const wx = ((x - cx0) / cw - 0.5) * 2 * aspect
      const wy = (0.5 - (y - cy0) / chh) * 2
      const wz = lv * depth + (Math.random() - 0.5) * 0.03
      pos.push(wx, wy, wz)
      counts[tone]++
      counts.total++
      const c = tone === 'red' ? redC : tone === 'gold' ? goldC : lv > 0.5 ? inkC : lv > 0.32 ? inkMidC : inkLightC
      col.push(c[0], c[1], c[2])
    }
  return { positions: new Float32Array(pos), colors: new Float32Array(col), counts, aspect }
}

/* ---------------- 开场动画专用：立绘主体采样（背景连通灌水剔除） ----------------
 * 适用于「背景与人物相接」的复杂立绘（如亮灰光晕背景 + 暗底），
 * 从裁剪窗四边 flood-fill，吃掉与边缘连通的低饱和背景区域，
 * 再剔除过小的连通碎片（防误吃人物细部），剩余像素即主体。
 * sourceColors / hotFlags 为 GPU 粒子系统提供原图真实色彩（神似关键）：
 *  - sourceColors: 原像素 RGB（压暗 40% 保持墨色氛围），替代 PALETTE 量化灰阶
 *  - hotFlags: 1 = 朱砂红 / 天行金 高饱和热区（辉光层）
 */
export async function buildSplashCloud(src: string, target = 60000): Promise<PointCloud> {
  const key = `${src}|${target}`
  const hit = splashCloudCache.get(key)
  if (hit) return hit
  const p = buildSplashCloudInner(src, target).catch((e) => {
    splashCloudCache.delete(key)
    throw e
  })
  splashCloudCache.set(key, p)
  return p
}

const splashCloudCache = new Map<string, Promise<PointCloud>>()

async function buildSplashCloudInner(src: string, target = 60000): Promise<PointCloud> {
  const im = await loadImage(src)
  const c = cropCanvas(im, 1024)
  const Wd = c.width, Hd = c.height
  const data = c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, Wd, Hd).data
  const cx0 = Math.round(Wd * CX0), cx1 = Math.round(Wd * CX1)
  const cy0 = Math.round(Hd * CY0), cy1 = Math.round(Hd * CY1)
  const cw = cx1 - cx0, chh = cy1 - cy0
  const aspect = cw / chh

  const sat = new Uint8Array(Wd * Hd)
  const lum = new Float32Array(Wd * Hd)
  for (let y = cy0; y < cy1; y++)
    for (let x = cx0; x < cx1; x++) {
      const i = y * Wd + x, si = i * 4
      const r = data[si], g = data[si + 1], b = data[si + 2]
      const l = r * 0.299 + g * 0.587 + b * 0.114
      lum[i] = l
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
      sat[i] = mx - mn
    }

  const bg = new Uint8Array(Wd * Hd)
  const isBg = (i: number) => sat[i] < 30 && (lum[i] > 140 || lum[i] < 48)
  const q: number[] = []
  const push = (i: number) => {
    if (!bg[i] && isBg(i)) { bg[i] = 1; q.push(i) }
  }
  for (let x = cx0; x < cx1; x++) { push(cy0 * Wd + x); push((cy1 - 1) * Wd + x) }
  for (let y = cy0; y < cy1; y++) { push(y * Wd + cx0); push(y * Wd + cx1 - 1) }
  while (q.length) {
    const i = q.pop()!
    const x = i % Wd, y = (i / Wd) | 0
    if (x > cx0) push(i - 1)
    if (x < cx1 - 1) push(i + 1)
    if (y > cy0) push(i - Wd)
    if (y < cy1 - 1) push(i + Wd)
    if (x > cx0 && y > cy0) push(i - Wd - 1)
    if (x < cx1 - 1 && y > cy0) push(i - Wd + 1)
    if (x > cx0 && y < cy1 - 1) push(i + Wd - 1)
    if (x < cx1 - 1 && y < cy1 - 1) push(i + Wd + 1)
  }
  const minRegion = Math.round((cw * chh) / 200)
  const seen = new Uint8Array(Wd * Hd)
  for (let y = cy0; y < cy1; y++)
    for (let x = cx0; x < cx1; x++) {
      const i = y * Wd + x
      if (!bg[i] || seen[i]) continue
      const region: number[] = [i]
      seen[i] = 1
      for (let k = 0; k < region.length; k++) {
        const j = region[k]
        const px = j % Wd, py = (j / Wd) | 0
        if (px > cx0 && bg[j - 1] && !seen[j - 1]) { seen[j - 1] = 1; region.push(j - 1) }
        if (px < cx1 - 1 && bg[j + 1] && !seen[j + 1]) { seen[j + 1] = 1; region.push(j + 1) }
        if (py > cy0 && bg[j - Wd] && !seen[j - Wd]) { seen[j - Wd] = 1; region.push(j - Wd) }
        if (py < cy1 - 1 && bg[j + Wd] && !seen[j + Wd]) { seen[j + Wd] = 1; region.push(j + Wd) }
      }
      if (region.length < minRegion) for (const j of region) bg[j] = 0
    }

  const isFg = (x: number, y: number) => !bg[y * Wd + x]

  // 前景透明立绘：背景像素 alpha=0 且 RGB 清零（防 bloom 按亮度提取透明区 → 矩形泛光框），
  // 主体保留原色（供显影层用，与粒子云像素对齐）
  const fg = document.createElement('canvas')
  fg.width = cw
  fg.height = chh
  const fgCtx = fg.getContext('2d')!
  const fgImg = fgCtx.createImageData(cw, chh)
  const fgPx = fgImg.data
  for (let y = 0; y < chh; y++)
    for (let x = 0; x < cw; x++) {
      const o = (y * cw + x) * 4
      const si = ((cy0 + y) * Wd + cx0 + x) * 4
      const isBg = bg[(cy0 + y) * Wd + cx0 + x] === 1
      // 防"矩形出戏"：前景四周留白（3%），全屏放大时立绘不会被平面矩形边缘框住
      const nearEdge = x < cw * 0.03 || x >= cw * 0.97 || y < chh * 0.03 || y >= chh * 0.97
      if (isBg || nearEdge) continue
      const [tr, tg, tb] = enhanceColor(data[si], data[si + 1], data[si + 2])
      fgPx[o] = tr * 255
      fgPx[o + 1] = tg * 255
      fgPx[o + 2] = tb * 255
      fgPx[o + 3] = 255
    }
  fgCtx.putImageData(fgImg, 0, 0)

  let step = 1
  for (let t = 0; t < 9; t++) {
    let n = 0
    for (let y = cy0; y < cy1; y += step) for (let x = cx0; x < cx1; x += step) if (isFg(x, y)) n++
    if (n > target * 1.1) step++
    else if (n < target * 0.7 && step > 1) step--
    else break
  }

  // step=1 仍不足时按比例亚像素复制（每像素 per 个粒子 + 抖动），保证粒子数贴近 target
  let baseN = 0
  for (let y = cy0; y < cy1; y += step) for (let x = cx0; x < cx1; x += step) if (isFg(x, y)) baseN++
  const per = Math.max(1, Math.round(target / Math.max(1, baseN)))

  const inkC = hexToF(PALETTE.ink), inkMidC = hexToF(PALETTE.inkMid), inkLightC = hexToF(PALETTE.inkLight)
  const redC = hexToF(PALETTE.red), goldC = hexToF(PALETTE.gold)
  const pos: number[] = [], col: number[] = [], srcCol: number[] = [], hot: number[] = []
  const counts = { total: 0, ink: 0, red: 0, gold: 0 }
  const depth = 1.05
  for (let y = cy0; y < cy1; y += step)
    for (let x = cx0; x < cx1; x += step) {
      if (!isFg(x, y)) continue
      const i = y * Wd + x
      const si = i * 4
      const r = data[si], g = data[si + 1], b = data[si + 2]
      const lv = (r * 0.299 + g * 0.587 + b * 0.114) / 255
      let tone: 'ink' | 'red' | 'gold' = 'ink'
      if (lv > 0.78) {
        const rn = Math.random()
        if (rn < 0.045) tone = 'red'
        else if (rn < 0.06) tone = 'gold'
      }
      for (let k = 0; k < per; k++) {
        // 亚像素抖动：per>1 时在像素内均匀/随机散布，避免重叠感
        const dx = per > 1 ? (Math.random() - 0.5) * 0.8 : 0
        const dy = per > 1 ? (Math.random() - 0.5) * 0.8 : 0
        const wx = ((x + dx - cx0) / cw - 0.5) * 2 * aspect
        const wy = (0.5 - (y + dy - cy0) / chh) * 2
        const wz = lv * depth + (Math.random() - 0.5) * 0.03
        pos.push(wx, wy, wz)
        counts[tone]++
        counts.total++
        const c = tone === 'red' ? redC : tone === 'gold' ? goldC : lv > 0.5 ? inkC : lv > 0.32 ? inkMidC : inkLightC
        col.push(c[0], c[1], c[2])
        // 原图色彩增强（保留色相，轻度提饱和 + 暗部抬升，避免发灰）
        const [tr, tg, tb] = enhanceColor(r, g, b)
        srcCol.push(tr, tg, tb)
        // 热区判定：朱砂红（r 显著 > g/b）或 天行金（r,g 高、b 低）
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
        const s = mx === 0 ? 0 : (mx - mn) / mx
        const isHotRed = r > 120 && r > g * 1.9 && r > b * 1.9 && s > 0.35
        const isHotGold = r > 130 && g > 95 && b < 105 && r - b > 55 && s > 0.22
        hot.push(isHotRed || isHotGold ? 1 : 0)
      }
    }
  return {
    positions: new Float32Array(pos),
    colors: new Float32Array(col),
    sourceColors: new Float32Array(srcCol),
    hotFlags: new Uint8Array(hot),
    counts,
    aspect,
    foreground: fg,
  }
}

/* ---------------- 浮雕亮度图（亮度 → 位移贴图） ---------------- */
export async function buildReliefCanvas(src: string, outH = 640): Promise<HTMLCanvasElement> {
  const im = await loadImage(src)
  const c = cropCanvas(im, 1024)
  const Wd = c.width, Hd = c.height
  const ictx = c.getContext('2d', { willReadFrequently: true })!
  const data = ictx.getImageData(0, 0, Wd, Hd).data
  const cx0 = Math.round(Wd * CX0), cx1 = Math.round(Wd * CX1)
  const cy0 = Math.round(Hd * CY0), cy1 = Math.round(Hd * CY1)
  const cw = cx1 - cx0, chh = cy1 - cy0
  const outW = Math.round((cw / chh) * outH)

  // 直方图百分位拉伸：取 [p2, p98] → [8, 255]，避免暗部被压平导致位移无起伏
  const hist = new Uint32Array(256)
  const mapped = new Float32Array(Wd * Hd)
  for (let y = cy0; y < cy1; y++)
    for (let x = cx0; x < cx1; x++) {
      const si = (y * Wd + x) * 4
      let l = data[si] * 0.299 + data[si + 1] * 0.587 + data[si + 2] * 0.114
      l = (l - 128) * 1.45 + 128
      if (l < 60) l *= 0.4
      l = Math.min(255, Math.max(0, l))
      mapped[y * Wd + x] = l
      hist[Math.round(l)]++
    }
  let cum = 0, p2 = 0, p98 = 255
  const total = cw * chh
  for (let v = 0; v < 256; v++) {
    cum += hist[v]
    if (p2 === 0 && cum >= total * 0.02) p2 = v
    if (cum >= total * 0.98) { p98 = v; break }
  }
  if (p98 <= p2) { p2 = 0; p98 = 255 }

  const out = document.createElement('canvas')
  out.width = outW
  out.height = outH
  const octx = out.getContext('2d')!
  const img = octx.createImageData(outW, outH)
  const px = img.data
  for (let y = 0; y < outH; y++)
    for (let x = 0; x < outW; x++) {
      const sx = cx0 + Math.min(cw - 1, Math.floor((x / outW) * cw))
      const sy = cy0 + Math.min(chh - 1, Math.floor((y / outH) * chh))
      let l = mapped[sy * Wd + sx]
      l = ((l - p2) / (p98 - p2)) * 247 + 8
      l = Math.min(255, Math.max(0, l))
      const o = (y * outW + x) * 4
      px[o] = px[o + 1] = px[o + 2] = l
      px[o + 3] = 255
    }
  octx.putImageData(img, 0, 0)
  return out
}

/* ---------------- logo 抠底（黑底 chroma-key，透明底自动识别） ---------------- */
export async function buildLogoCanvas(src: string, maxH = 512): Promise<HTMLCanvasElement> {
  const im = await loadImage(src)
  const h = Math.min(im.height, maxH)
  const w = Math.round((im.width * h) / im.height)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(im, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h).data
  const corner = data[3] + data[(w - 1) * 4 + 3]
  if (corner < 16) return c // 已是透明底
  const img = ctx.getImageData(0, 0, w, h)
  const px = img.data
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2]
    if (r + g + b < 225 && Math.max(r, g, b) < 110) px[i + 3] = 0
  }
  ctx.putImageData(img, 0, 0)
  return c
}
