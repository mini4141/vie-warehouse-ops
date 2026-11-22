import { beforeAll, describe, expect, it } from 'vitest'
import i18n from '@/i18n'
import { formatNumber, formatPercent, formatRelative } from './format'

describe('formatters', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en')
  })

  it('formats numbers and percents with Intl', () => {
    expect(formatNumber(1234.5, 1)).toBe('1,234.5')
    expect(formatPercent(0.42)).toBe('42%')
  })

  it('formats relative time in the active language', async () => {
    const now = Date.now()
    expect(formatRelative(now - 5 * 60_000, now)).toBe('5 minutes ago')
    await i18n.changeLanguage('ja')
    expect(formatRelative(now - 5 * 60_000, now)).toBe('5 分前')
    await i18n.changeLanguage('en')
  })
})
