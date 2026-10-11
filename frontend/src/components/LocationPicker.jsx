import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { Button, ErrorText, inputClass } from './ui'

const DEFAULT_ZOOM = 16
const DEMO_PIN = { lat: 20.305481, lng: 85.797729 }
const PIN = L.divIcon({ html: '<div style="font-size:30px;line-height:30px">📍</div>', className: '', iconSize: [30, 30], iconAnchor: [15, 30] })

/**
 * A map with one draggable pin, an address search and a "use my GPS" button. The parent owns the value:
 * `value` is {lat, lng} and `onChange` gets the new one. Under the map it says which ward the pin is in.
 * Map tiles come from OpenStreetMap; address search goes through our own backend.
 */
export default function LocationPicker({ value, onChange }) {
  const { t } = useTranslation()
  const box = useRef(null)
  const map = useRef(null)
  const marker = useRef(null)
  const latest = useRef(onChange)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)
  const [ward, setWard] = useState(undefined)
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    latest.current = onChange
  }, [onChange])

  // Build the map once.
  useEffect(() => {
    const start = [value.lat, value.lng]
    const m = L.map(box.current, { zoomControl: true }).setView(start, DEFAULT_ZOOM)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      // The tile server needs to know which site asks (its usage policy); send our origin, never the full path.
      referrerPolicy: 'origin',
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m)
    const pin = L.marker(start, { draggable: true, icon: PIN, keyboard: true, alt: t('location.pin') }).addTo(m)
    const move = (latlng) => latest.current({ lat: round(latlng.lat), lng: round(latlng.lng) })
    pin.on('dragend', () => move(pin.getLatLng()))
    m.on('click', (e) => move(e.latlng))
    map.current = m
    marker.current = pin
    return () => {
      m.remove()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the map is created once; later values are applied below
  }, [])

  // Keep the pin on the value, and look up its ward (waiting a moment while the pin is still being moved).
  useEffect(() => {
    marker.current?.setLatLng([value.lat, value.lng])
    const timer = setTimeout(() => {
      api.wardAt(value.lat, value.lng).then(setWard).catch(() => setWard(null))
    }, 400)
    return () => clearTimeout(timer)
  }, [value.lat, value.lng])

  const place = (lat, lng) => {
    onChange({ lat: round(lat), lng: round(lng) })
    map.current?.setView([lat, lng], DEFAULT_ZOOM)
  }

  const search = async () => {
    setError(null)
    setResults(null)
    try {
      setResults(await api.geoSearch(query.trim()))
    } catch (err) {
      setError(err)
    }
  }

  // Says why it failed: the browser only offers GPS on HTTPS (or localhost), and the user may have blocked it.
  const useGps = () => {
    setError(null)
    if (!navigator.geolocation || !window.isSecureContext) {
      setError(new Error(t('location.gps.insecure')))
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false)
        place(p.coords.latitude, p.coords.longitude)
      },
      (failure) => {
        setLocating(false)
        const key = { 1: 'denied', 2: 'unavailable', 3: 'timeout' }[failure.code] ?? 'unavailable'
        setError(new Error(t(`location.gps.${key}`)))
      },
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 300000 },
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          className={inputClass}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (query.trim().length >= 3) search()
            }
          }}
          placeholder={t('location.searchPlaceholder')}
          aria-label={t('location.search')}
          minLength={3}
          maxLength={100}
        />
        <Button type="button" variant="secondary" disabled={query.trim().length < 3} onClick={search}>
          {t('location.search')}
        </Button>
      </div>

      {results && results.length === 0 && <p className="text-sm text-slate-600">{t('location.noResults')}</p>}
      {results && results.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
          {results.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-leaf-50"
                onClick={() => {
                  place(r.lat, r.lng)
                  setResults(null)
                }}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      <ErrorText error={error} />

      <div ref={box} className="z-0 h-64 w-full overflow-hidden rounded-xl border border-slate-200" />

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span role="status">
          {ward === undefined ? t('common.loading') : ward?.covered ? `📍 ${ward.ward.label}` : `⚠️ ${t('location.outside')}`}
          {ward && !ward.covered && (
            <button type="button" onClick={() => place(DEMO_PIN.lat, DEMO_PIN.lng)} className="ml-2 font-semibold text-leaf-700 underline">
              {t('location.goDemo')}
            </button>
          )}
        </span>
        <button type="button" onClick={useGps} disabled={locating} className="font-semibold text-leaf-700 underline disabled:opacity-60">
          {locating ? t('location.gps.locating') : t('auth.useLocation')}
        </button>
      </div>
      <p className="text-xs text-slate-500">{t('location.help')}</p>
    </div>
  )
}

const round = (n) => Math.round(n * 1e6) / 1e6
