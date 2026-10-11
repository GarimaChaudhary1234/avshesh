import i18n from '../i18n'

const LOCALES = { en: 'en-IN', hi: 'hi-IN', or: 'or-IN' }
const locale = () => LOCALES[i18n.language] ?? 'en-IN'

const number = (n) => Number(n ?? 0).toLocaleString(locale(), { maximumFractionDigits: 2 })

/** A whole number written the way the current language does (1,23,456). */
export const count = (n) => Number(n ?? 0).toLocaleString(locale())

export const rupee = (n) => `₹${number(n)}`

/** "5.4 kg", "5.4 किलो" or "5.4 କିଲୋ". */
export const kg = (n) => i18n.t('units.kg', { value: number(n) })

export const dateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString(locale(), {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })
    : ''

export const dateOnly = (iso) =>
  iso ? new Date(iso).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' }) : ''

/** Straight-line distance between two {lat, lng} points in kilometres. */
export const distanceKm = (a, b) => {
  const rad = (d) => (d * Math.PI) / 180
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** Value for <input type="datetime-local"> some hours from now, rounded to the hour. */
export const inHours = (hours) => {
  const d = new Date(Date.now() + hours * 3600_000)
  d.setMinutes(0, 0, 0)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}
