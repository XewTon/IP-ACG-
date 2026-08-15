import { describe, it, expect } from 'vitest'
import { COPY_TEMPLATES, PLATFORM_RULES } from './copyTemplates'

describe('copyTemplates 数据完整性', () => {
  it('COPY_TEMPLATES 每条含非空 id/name/body', () => {
    expect(COPY_TEMPLATES.length).toBeGreaterThan(0)
    for (const t of COPY_TEMPLATES) {
      expect(t.id).toBeTruthy()
      expect(t.name).toBeTruthy()
      expect(t.body.length).toBeGreaterThan(20)
    }
  })

  it('PLATFORM_RULES 覆盖四个核心平台', () => {
    for (const p of ['B站', '微博', '小红书', '公众号']) {
      expect(PLATFORM_RULES.some(r => r.platform === p)).toBe(true)
    }
  })
})
