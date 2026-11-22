import i18n from '@/i18n'

const lang = () => i18n.language || 'en'

export const formatNumber = (n: number, digits = 0) =>
  new Intl.NumberFormat(lang(), { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n)

export const formatPercent = (fraction: number) =>
  new Intl.NumberFormat(lang(), { style: 'percent', maximumFractionDigits: 0 }).format(fraction)

export const formatTime = (iso: string | number) =>
  new Intl.DateTimeFormat(lang(), { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(iso))

export const formatDateTime = (iso: string | number) =>
  new Intl.DateTimeFormat(lang(), { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
  ['second', 1],
]

export function formatRelative(iso: string | number, now = Date.now()) {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000)
  const rtf = new Intl.RelativeTimeFormat(lang(), { numeric: 'auto' })
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size || unit === 'second') return rtf.format(Math.round(seconds / size), unit)
  }
  return ''
}
