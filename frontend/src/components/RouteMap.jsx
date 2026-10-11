import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'

const numbered = (n) =>
  L.divIcon({
    html: `<div style="background:#1d673d;color:#fff;border:2px solid #fff;border-radius:9999px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;box-shadow:0 1px 4px rgba(0,0,0,.4)">${n}</div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
const START = L.divIcon({ html: '<div style="font-size:26px;line-height:26px">🛺</div>', className: '', iconSize: [26, 26], iconAnchor: [13, 13] })

/**
 * The pickup on a map: the collector's own place (🛺), then every home in the order they are visited (1, 2, 3 …),
 * joined by a line. Tapping a number shows the household's name.
 */
export default function RouteMap({ start, stops, label }) {
  const box = useRef(null)

  useEffect(() => {
    const points = stops.filter((s) => s.lat != null && s.lng != null)
    const m = L.map(box.current, { zoomControl: true, scrollWheelZoom: false })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      referrerPolicy: 'origin',
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m)
    const path = []
    if (start) {
      L.marker([start.lat, start.lng], { icon: START, keyboard: false }).addTo(m)
      path.push([start.lat, start.lng])
    }
    points.forEach((s) => {
      L.marker([s.lat, s.lng], { icon: numbered(s.seq), title: s.ownerName }).bindTooltip(`${s.seq}. ${s.ownerName}`).addTo(m)
      path.push([s.lat, s.lng])
    })
    if (path.length > 1) L.polyline(path, { color: '#1d673d', weight: 3, dashArray: '6 6' }).addTo(m)
    if (path.length > 0) m.fitBounds(L.latLngBounds(path), { padding: [30, 30], maxZoom: 17 })
    else m.setView([20.3, 85.8], 12)
    return () => m.remove()
    // the route of one pickup does not change while it is on screen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={box} role="img" aria-label={label} className="z-0 h-56 w-full overflow-hidden rounded-xl border border-slate-200" />
}
