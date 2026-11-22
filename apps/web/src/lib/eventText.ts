import type { TFunction } from 'i18next'
import type { WocEvent } from '@/api/types'

/** The backend sends `code` + `params`; display text is always built client-side. */
export function eventText(t: TFunction, e: WocEvent): string {
  const reason = e.params.reason ? t(`events.reason.${e.params.reason}`, { defaultValue: String(e.params.reason) }) : ''
  return t(`events.${e.code}`, { robot: e.robotId ?? '', order: e.orderId ?? '', ...e.params, reason, defaultValue: e.code })
}
