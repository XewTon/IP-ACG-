/**
 * 玄策 · 玄机官方壁纸采集脚本（一次性开发工具，不属于应用包）
 *
 * 从 玄机官网「精美壁纸」页 http://www.xjent.com/100033/ 精选并下载官方壁纸：
 *   - 解析每个壁纸块（alt 名称 + wp-sizz 下载链接，URL 含空格 → %20 编码）
 *   - 精选 ~16 张：优先 2025 年月度 + 2024/2025 节日 + 2023 圣诞
 *   - 变体选择：优先「无字版」→ 横板 jpg → 横板 png → 竖版
 *   - PNG 解码后缩小到 ≤1500px 重编码（控制仓库体积），jpg 原样（≤4MB）
 *   - 解析真实宽高 → aspect；输出 src/data/xuanjiWallpapers.ts（含 series 归属与官网源链接）
 *
 * 用法：node scripts/fetch-xuanji-wallpapers.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import zlib from 'node:zlib'

const BASE = 'http://www.xjent.com'
const PAGE = '/100033/'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
const OUT_DIR = path.resolve('page-agent/frontend/public/wallpapers')
const OUT_TS = path.resolve('page-agent/frontend/src/data/xuanjiWallpapers.ts')
const TARGET_COUNT = 16
const MAX_JPG_BYTES = 4 * 1024 * 1024
const PNG_MAX_W = 1500 // PNG 缩小目标宽度

/* ---------------- PNG 解码 / 缩小 / 重编码（纯 Node 实现） ---------------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function decodePng(buf) {
  let pos = 8, w = 0, h = 0, ct = 0, depth = 0, interlace = 0
  const idat = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    if (type === 'IHDR') {
      w = buf.readUInt32BE(pos + 8); h = buf.readUInt32BE(pos + 12)
      depth = buf[pos + 16]; ct = buf[pos + 17]; interlace = buf[pos + 20]
    } else if (type === 'IDAT') idat.push(buf.slice(pos + 8, pos + 8 + len))
    pos += 12 + len
  }
  if (depth !== 8 || interlace !== 0) throw new Error(`不支持的 PNG（depth=${depth} interlace=${interlace}）`)
  const bpp = ct === 6 ? 4 : 3
  const stride = w * bpp
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const out = Buffer.alloc(stride * h)
  const prev = Buffer.alloc(stride)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    const row = out.subarray(y * stride, (y + 1) * stride)
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? row[x - bpp] : 0
      const b = prev[x]
      const c = x >= bpp ? prev[x - bpp] : 0
      let v = line[x]
      if (f === 1) v += a
      else if (f === 2) v += b
      else if (f === 3) v += (a + b) >> 1
      else if (f === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      row[x] = v & 0xff
    }
    prev.set(row)
  }
  return { w, h, bpp, data: out }
}

function downscalePng(buf, maxW) {
  const { w, h, bpp, data } = decodePng(buf)
  if (w <= maxW) return { buf, w, h }
  const nw = maxW
  const nh = Math.max(1, Math.round((h * nw) / w))
  const out = Buffer.alloc(nw * nh * bpp)
  for (let y = 0; y < nh; y++) {
    const sy = Math.min(h - 1, Math.floor((y * h) / nh))
    for (let x = 0; x < nw; x++) {
      const sx = Math.min(w - 1, Math.floor((x * w) / nw))
      const si = (sy * w + sx) * bpp
      const di = (y * nw + x) * bpp
      for (let k = 0; k < bpp; k++) out[di + k] = data[si + k]
    }
  }
  // 重编码
  const stride = nw * bpp
  const raw = Buffer.alloc((stride + 1) * nh)
  for (let y = 0; y < nh; y++) {
    raw[y * (stride + 1)] = 0
    out.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const idat = zlib.deflateSync(raw, { level: 9 })
  const chunk = (type, payload) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(payload.length)
    const td = Buffer.from(type, 'ascii')
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(Buffer.concat([td, payload])))
    return Buffer.concat([len, td, payload, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(nw, 0)
  ihdr.writeUInt32BE(nh, 4)
  ihdr[8] = 8
  ihdr[9] = bpp === 4 ? 6 : 2
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return { buf: Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]), w: nw, h: nh }
}

function dimsFromBuffer(buf) {
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
  }
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8) {
    let o = 2
    while (o < buf.length - 9) {
      if (buf[o] !== 0xff) { o++; continue }
      const marker = buf[o + 1]
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { h: buf.readUInt16BE(o + 5), w: buf.readUInt16BE(o + 7) }
      }
      const seg = buf.readUInt16BE(o + 2)
      o += 2 + seg
    }
  }
  return null
}

/* 精选优先级（按 alt 名称匹配，命中顺序即优先级） */
const PRIORITY = [
  /2025年9月/, /2025年8月/, /2025年7月/, /2025年6月/, /2025年5月/, /2025年4月/, /2025年3月/, /2025年2月/, /2025年1月/,
  /2025年七夕/, /2025年情人节/,
  /2024年中秋/, /2024年七夕/, /2024年冬至/, /2024年端午节/,
  /2023圣诞/, /2023年中秋/,
]

/* 文件名可识别系列的补充壁纸（官方壁纸页未标注系列，此处按文件名关键词归入对应作品） */
const BONUS = [
  {
    name: '秦时明月 · 夜尽天明 LOGO 壁纸',
    slug: 'qinshimingyue-yejin',
    series: 'qinshimingyue',
    url: '/static/upload/png/202308/2560 1440 夜尽天明logoA85CA300AE6F4DBFBD27168979B0E410.png',
  },
  {
    name: '秦时明月 · 倒计时 盖聂与天明',
    slug: 'qinshimingyue-countdown',
    series: 'qinshimingyue',
    url: '/static/upload/jpg/202111/倒计时 1 盖聂 天明 (3).jpg',
  },
]

function fetchBuffer(url, maxBytes = 12 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    http.get(url, { headers: { 'User-Agent': UA } }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode} ${url}`)) }
      const chunks = []
      let size = 0
      res.on('data', (c) => {
        size += c.length
        if (size > maxBytes) { res.destroy(); return reject(new Error(`too large ${url}`)) }
        chunks.push(c)
      })
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

function fetchText(url) {
  return fetchBuffer(url).then((b) => b.toString('utf8'))
}

function encodePath(u) {
  // 空格 → %20，保留中文（http.get 会自动处理已编码部分）
  return u.replace(/ /g, '%20')
}

/* 变体选择：无字 jpg → 横板 jpg → 横板 png → 竖版 */
function pickVariant(links) {
  const score = (l) => {
    let s = 0
    if (/无字|wz/i.test(l.label)) s += 100
    if (l.url.endsWith('.jpg') || l.url.endsWith('.jpeg')) s += 50
    else if (l.url.endsWith('.png')) s += 15
    if (/(2560\s*1440|1920\s*1080|2350\s*1000|2800\s*1880|2880\s*1800)/i.test(l.label)) s += 30
    else if (/(1080\s*(2160|1920))/i.test(l.label)) s += 4
    return s
  }
  return [...links].sort((a, b) => score(b) - score(a))[0]
}

function slugFromName(name) {
  const m = name.match(/(\d{4})年(\d{1,2})月/)
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}`
  const fest = [
    ['七夕', 'qixi'], ['情人节', 'valentine'], ['中秋', 'mid-autumn'], ['冬至', 'winter-solstice'],
    ['圣诞', 'christmas'], ['春节', 'spring-festival'], ['端午', 'dragon-boat'], ['母亲节', 'mothers-day'],
    ['元旦', 'new-year'], ['元宵', 'lantern'],
  ]
  const yy = (name.match(/(\d{4})/) || [])[1] || '2024'
  for (const [zh, en] of fest) {
    if (name.includes(zh)) return `${yy}-${en}`
  }
  return `wp-${Date.now().toString(36)}`
}

function seriesOf(url) {
  if (/盖聂|天明|夜尽天明|诸子百家|万里长城/i.test(url)) return 'qinshimingyue'
  return 'official'
}

function toCode(id, name, src, aspect, dimsLabel, series, sourceUrl) {
  const seriesName = series === 'qinshimingyue' ? '秦时明月' : '官方壁纸精选'
  return `  {
    id: '${id}',
    name: '${name}',
    type: 'artwork',
    work: '玄机科技官方壁纸',
    src: '${src}',
    aspect: ${aspect.toFixed(4)},
    note: '${dimsLabel} · 玄机科技官网精美壁纸精选',
    tags: ['官方壁纸', '${seriesName}'],
    series: '${series}',
    source: '${sourceUrl}',
  },`
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  console.log('[1/4] 抓取壁纸页', BASE + PAGE)
  const html = await fetchText(BASE + PAGE)

  console.log('[2/4] 解析壁纸块')
  const blocks = []
  let current = null
  const re = /<img[^>]*alt="([^"]*)"[^>]*>|<a class="wp-sizz" href="([^"]+)"[^>]*>([^<]+)<\/a>/g
  let m
  while ((m = re.exec(html))) {
    if (m[1] !== undefined && m[1].trim()) {
      current = { name: m[1].trim(), links: [] }
      blocks.push(current)
    } else if (m[2] && current) {
      current.links.push({ label: m[3].trim(), url: m[2] })
    }
  }
  console.log('  解析到壁纸块:', blocks.length)

  // 精选
  const picked = []
  for (const p of PRIORITY) {
    if (picked.length >= TARGET_COUNT) break
    const b = blocks.find((x) => !picked.includes(x) && p.test(x.name))
    if (b) picked.push(b)
  }
  if (picked.length < Math.min(12, TARGET_COUNT)) {
    // 回退：按名称顺序补足
    for (const b of blocks) {
      if (picked.length >= TARGET_COUNT) break
      if (!picked.includes(b)) picked.push(b)
    }
  }
  console.log('  精选:', picked.length, '张 ->', picked.map((p) => p.name).join('、'))

  console.log('[3/4] 下载壁纸（PNG 自动缩小到 ≤1500px）')
  const entries = []
  const seen = new Set()

  const downloadOne = async (name, slug, url, forcedSeries, variantLabel) => {
    const isPng = url.endsWith('.png')
    const file = `${slug}.${isPng ? 'png' : 'jpg'}`
    if (seen.has(file)) { console.warn('  跳过（重名）:', file); return null }
    seen.add(file)
    const full = BASE + encodePath(url)
    try {
      const buf = await fetchBuffer(full)
      let finalBuf = buf
      let dims = null
      if (isPng) {
        try {
          const r = downscalePng(buf, PNG_MAX_W)
          finalBuf = r.buf
          dims = { w: r.w, h: r.h }
        } catch (e) {
          console.warn('  PNG 解码失败，跳过:', name, '-', e.message)
          return null
        }
      } else {
        if (buf.length > MAX_JPG_BYTES) { console.warn('  跳过（jpg 过大）:', file); return null }
        dims = dimsFromBuffer(buf)
      }
      if (!dims) { console.warn('  跳过（无法解析尺寸）:', file); return null }
      fs.writeFileSync(path.join(OUT_DIR, file), finalBuf)
      console.log(`  ✓ ${file}  ${dims.w}×${dims.h}  ${(finalBuf.length / 1024 / 1024).toFixed(2)}MB  [${variantLabel}]`)
      return { name, slug, file, dims, url: full, series: forcedSeries ?? seriesOf(url) }
    } catch (e) {
      console.warn('  下载失败:', name, e.message)
      return null
    }
  }

  for (const b of picked) {
    const v = pickVariant(b.links)
    if (!v) { console.warn('  跳过（无下载链接）:', b.name); continue }
    const slug = slugFromName(b.name)
    const entry = await downloadOne(b.name, slug, v.url, null, v.label)
    if (entry) entries.push(entry)
  }
  // 补充：文件名可识别系列的壁纸
  for (const bx of BONUS) {
    const entry = await downloadOne(bx.name, bx.slug, bx.url, bx.series, '官方系列壁纸')
    if (entry) entries.push(entry)
  }
  console.log('  成功:', entries.length, '张')

  console.log('[4/4] 生成', OUT_TS)
  const lines = [
    '/*',
    ' * 玄策 · 玄机官方壁纸精选（数据由 scripts/fetch-xuanji-wallpapers.mjs 生成）',
    ' * 来源：玄机科技官网「精美壁纸」https://www.xjent.com/100033/',
    ' * series 归属：' + '官方未标注系列，初始仅按文件名关键词识别（盖聂/天明/夜尽天明 → 秦时明月），其余归 official；',
    ' *            可在 xuanjiSeries.ts 的映射表中手工调整。',
    ' */',
    'import type { IPAsset } from \'./assets\'',
    '',
    'export interface XuanjiWallpaper extends IPAsset { series: string; source: string }',
    '',
    'export const WALLPAPERS: XuanjiWallpaper[] = [',
  ]
  for (const e of entries) {
    const id = `xj-${e.slug}`
    const dimsLabel = `${e.dims.w}×${e.dims.h}`
    const aspect = e.dims.w / e.dims.h
    lines.push(toCode(id, e.name, `/wallpapers/${e.file}`, aspect, dimsLabel, e.series, e.url))
  }
  lines.push(']', '')
  fs.writeFileSync(OUT_TS, lines.join('\n'), 'utf8')
  console.log('完成 ✓ 生成', entries.length, '条数据 ->', OUT_TS)
}

main().catch((e) => { console.error(e); process.exit(1) })
