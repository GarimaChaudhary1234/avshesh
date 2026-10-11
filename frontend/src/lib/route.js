import { distanceKm } from './format'

/**
 * Puts stops in a sensible visiting order: always the nearest one that is left, starting from `start` (or, with no
 * start, from the first stop). It is the same idea the server uses for a dealer's pickup, so a worker who has no
 * fixed starting point still gets a short round.
 */
export function visitingOrder(stops, start) {
  const left = [...stops]
  const ordered = []
  let here = start ?? (left.length ? left.shift() : null)
  if (!start && here) ordered.push(here)
  while (left.length) {
    let best = 0
    for (let i = 1; i < left.length; i++) {
      if (distanceKm(here, left[i]) < distanceKm(here, left[best])) best = i
    }
    here = left.splice(best, 1)[0]
    ordered.push(here)
  }
  return ordered
}

/** Straight-line kilometres from the start (if any) through every stop in order. */
export function routeLength(stops, start) {
  return stops.reduce((km, s, i) => {
    const from = i === 0 ? start : stops[i - 1]
    return from ? km + distanceKm(from, s) : km
  }, 0)
}

/**
 * One Google Maps link for the whole round: from the start, through the stops, to the last one. Google accepts at most
 * 9 stops in between, so a longer round is cut after the first ten stops.
 */
export function wholeRouteUrl(stops, start) {
  const points = stops.slice(0, 10)
  if (points.length === 0) return null
  const at = (p) => `${p.lat},${p.lng}`
  const last = points[points.length - 1]
  const between = points.slice(0, -1)
  const params = new URLSearchParams({ api: '1', destination: at(last), travelmode: 'driving' })
  if (start) params.set('origin', at(start))
  if (between.length) params.set('waypoints', between.map(at).join('|'))
  return `https://www.google.com/maps/dir/?${params.toString()}`
}
