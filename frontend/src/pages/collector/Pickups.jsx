import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PhoneVerifyPrompt } from '../../components/CollectorStatusBanner'
import PlaceName from '../../components/PlaceName'
import RouteMap from '../../components/RouteMap'
import { Badge, Button, Card, ErrorText, Field, inputClass, Loading } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { dateTime, distanceKm, kg } from '../../lib/format'
import { wholeRouteUrl } from '../../lib/route'
import { api } from '../../lib/api'
import { useLoad } from '../../lib/useLoad'

export default function Pickups() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data, error, loading, reload } = useLoad(api.pickups)

  if (loading) return <Loading />
  if (error) return <ErrorText error={error} />

  return (
    <>
      <h1 className="text-xl font-bold">🛺 {t('collector.pickups.title')}</h1>
      {data.length === 0 && <Card className="text-sm text-slate-600">{t('collector.pickups.empty')}</Card>}
      {data.map((p) => (
        <Card key={p.id} className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">{dateTime(p.start)} – {dateTime(p.end)}</h2>
            <Badge tone={p.status === 'DONE' ? 'slate' : 'green'}>{p.status === 'DONE' ? t('collector.pickups.completed') : t('collector.pickups.inProgress')}</Badge>
          </div>
          {p.status !== 'DONE' && (
            <>
              <RouteMap start={user} stops={p.stops} label={t('collector.route.mapLabel')} />
              <p className="text-sm text-slate-600">
                {t('collector.route.summary', { stops: p.stops.length, km: routeKm(user, p.stops).toFixed(1) })}
              </p>
              <a href={wholeRouteUrl(p.stops.filter((s) => !s.done), user)} target="_blank" rel="noreferrer" className="inline-block text-sm font-semibold text-leaf-700 underline">
                🧭 {t('route.navigateAll')}
              </a>
            </>
          )}
          <ol className="space-y-2">
            {p.stops.map((s, i) => (
              <Stop key={s.stopId} stop={s} from={i === 0 ? user : p.stops[i - 1]} fromYou={i === 0} onDone={reload} />
            ))}
          </ol>
        </Card>
      ))}
    </>
  )
}

/** Kilometres in a straight line from the collector's place through every home in the visiting order. */
const routeKm = (start, stops) =>
  stops.reduce((km, s, i) => km + distanceKm(i === 0 ? start : stops[i - 1], s), 0)

/** Payment confirmation state of a completed stop, so the collector knows if the household agreed. */
const PAYMENT_CHIPS = {
  PENDING: { tone: 'amber', key: 'collector.payment.pending' },
  CONFIRMED: { tone: 'green', key: 'collector.payment.confirmed' },
  DISPUTED: { tone: 'red', key: 'collector.payment.disputed' },
  RESOLVED: { tone: 'slate', key: 'collector.payment.resolved' },
}

function Stop({ stop, from, fromYou, onDone }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ actualKg: '', paymentMode: 'CASH' })
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      setResult(await api.completeStop(stop.stopId, { ...form, actualKg: Number(form.actualKg) }))
      onDone()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-medium">
            {stop.seq}. {stop.ownerName}
          </div>
          <div className="text-xs text-slate-500">
            {t(`item.${stop.itemCode}.name`, { defaultValue: stop.itemCode })} · {t('collector.stop.about', { kg: kg(stop.estKg) })}
          </div>
          {!stop.done && stop.lat != null && (
            <div className="mt-1 space-y-1 text-sm">
              <div className="text-slate-700">
                📍 <PlaceName lat={stop.lat} lng={stop.lng} />{' '}
                <span className="text-xs text-slate-500">
                  {t(fromYou ? 'collector.stop.fromYou' : 'collector.stop.fromPrevious', { km: distanceKm(from, stop).toFixed(1) })}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-leaf-700 underline"
                >
                  🧭 {t('collector.stop.navigate')}
                </a>
                {stop.ownerPhone && (
                  <a href={`tel:${stop.ownerPhone}`} className="font-semibold text-leaf-700 underline">
                    📞 {stop.ownerPhone}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
        {stop.done ? (
          <Badge>✅ {kg(stop.actualKg)}</Badge>
        ) : (
          !open && (
            <Button variant="secondary" onClick={() => setOpen(true)}>
              {t('collector.stop.collect')}
            </Button>
          )
        )}
      </div>

      {stop.done && PAYMENT_CHIPS[stop.paymentStatus] && (
        <div className="mt-2">
          <Badge tone={PAYMENT_CHIPS[stop.paymentStatus].tone}>{t(PAYMENT_CHIPS[stop.paymentStatus].key)}</Badge>
        </div>
      )}

      {open && !stop.done && (
        <form onSubmit={submit} className="mt-3 space-y-3 rounded-xl bg-leaf-50 p-3">
          <Field label={t('collector.stop.weight')}>
            <input className={inputClass} type="number" min="0.1" step="0.1" value={form.actualKg} onChange={set('actualKg')} required />
          </Field>
          <Field label={t('collector.stop.payment')}>
            <select className={inputClass} value={form.paymentMode} onChange={set('paymentMode')}>
              <option value="CASH">{t('collector.stop.cash')}</option>
              <option value="UPI">{t('collector.stop.upi')}</option>
            </select>
          </Field>
          {error?.code === 'PHONE_NOT_VERIFIED' ? <PhoneVerifyPrompt /> : <ErrorText error={error} />}
          <Button disabled={busy} className="w-full">
            {busy ? t('collector.common.wait') : t('collector.stop.done')}
          </Button>
        </form>
      )}
      {result && (
        <p className="mt-3 rounded-xl bg-leaf-50 px-3 py-2 text-sm font-semibold text-leaf-700">✅ {result.message}</p>
      )}
    </li>
  )
}
