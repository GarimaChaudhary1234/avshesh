import { useEffect, useState } from 'react'
import { api, session } from '../lib/api'

const known = new Map()
let queue = Promise.resolve()

/**
 * Looks names up one at a time: the free map service behind the backend allows about one request a second, so a long
 * list waits in line. A lookup whose screen was closed, or whose user logged out meanwhile, is dropped instead of
 * being sent (it would only be refused) and is not remembered as "no name".
 */
function lookup(lat, lng, isWanted) {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`
  if (!known.has(key)) {
    known.set(
      key,
      (queue = queue.then(() => {
        if (!isWanted() || !session.loadUser()) {
          known.delete(key)
          return ''
        }
        return api.placeName(lat, lng).then((r) => r.label).catch(() => '')
      })),
    )
  }
  return known.get(key)
}

/** The name of the place of a pin ("Jaydev Vihar, Bhubaneswar"), shown once it is known and nothing while it is not. */
export default function PlaceName({ lat, lng }) {
  const [label, setLabel] = useState('')
  useEffect(() => {
    let alive = true
    if (lat != null && lng != null) lookup(lat, lng, () => alive).then((l) => alive && setLabel(l))
    return () => {
      alive = false
    }
  }, [lat, lng])
  return label ? <>{label}</> : null
}
