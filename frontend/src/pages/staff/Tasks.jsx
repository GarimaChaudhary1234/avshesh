import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import RouteMap from '../../components/RouteMap'
import { Badge, Button, Card, ErrorText, Field, inputClass, Loading } from '../../components/ui'
import { api } from '../../lib/api'
import { dateOnly, dateTime, distanceKm, kg } from '../../lib/format'
import { routeLength, visitingOrder, wholeRouteUrl } from '../../lib/route'
import { useLoad } from '../../lib/useLoad'
import { usePolling } from '../../lib/usePolling'

/** The municipal collection worker's screen: the pickups assigned to them, and a way to report each one. */
export default function Tasks() {
  const { t } = useTranslation()
  const { data, error, loading, reload } = useLoad(api.staffTasks)
  usePolling(reload, 30000)

  if (loading) return <Loading />
  if (error) return <ErrorText error={error} />

  // Earliest day first; inside one day the nearest house next, so the round stays short.
  const days = {}
  data.open.forEach((o) => (days[o.scheduledFor] ??= []).push(o))
  const ordered = Object.keys(days).sort().flatMap((d) => visitingOrder(days[d]))

  return (
    <>
      <h1 className="text-xl font-bold">🧹 {t('staff.title')}</h1>
      <p className="text-sm text-slate-600">{t('staff.intro')}</p>

      {data.open.length === 0 && <Card className="text-sm text-slate-600">{t('staff.empty')}</Card>}
      {ordered.length > 0 && (
        <Card className="space-y-2">
          <RouteMap
            key={ordered.map((o) => o.requestId).join('-')}
            stops={ordered.map((o, i) => ({ seq: i + 1, lat: o.lat, lng: o.lng, ownerName: o.householdName }))}
            label={t('staff.mapLabel')}
          />
          <p className="text-sm text-slate-600">
            {t('staff.routeSummary', { stops: ordered.length, km: routeLength(ordered).toFixed(1) })}
          </p>
          <a href={wholeRouteUrl(ordered)} target="_blank" rel="noreferrer" className="inline-block text-sm font-semibold text-leaf-700 underline">
            🧭 {t('route.navigateAll')}
          </a>
        </Card>
      )}
      {ordered.map((task, i) => (
        <Task key={task.requestId} task={task} number={i + 1} from={i > 0 ? ordered[i - 1] : null} onChanged={reload} />
      ))}

      {data.done.length > 0 && (
        <>
          <h2 className="pt-2 text-lg font-semibold">{t('staff.doneTitle')}</h2>
          {data.done.map((task) => (
            <Card key={task.requestId} className="flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{t(`item.${task.itemCode}.name`, { defaultValue: task.itemName })} · {kg(task.estKg)}</p>
                <p className="text-sm text-slate-600">{task.householdName} · {dateTime(task.doneAt)}</p>
              </div>
              <Badge>{t('staff.collected')}</Badge>
            </Card>
          ))}
        </>
      )}
    </>
  )
}

function Task({ task, number, from, onChanged }) {
  const { t } = useTranslation()
  const [problem, setProblem] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const run = async (action) => {
    setBusy(true)
    setError(null)
    try {
      await action()
      await onChanged()
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold">
          {number}. {t(`item.${task.itemCode}.name`, { defaultValue: task.itemName })} · {kg(task.estKg)}
        </h2>
        <Badge tone="amber">{dateOnly(task.scheduledFor)}</Badge>
      </div>
      <p className="text-sm">
        {task.householdName} ·{' '}
        <a href={`tel:${task.householdPhone}`} className="font-semibold text-leaf-700 underline">{task.householdPhone}</a>
      </p>
      {from && <p className="text-xs text-slate-500">{t('collector.stop.fromPrevious', { km: distanceKm(from, task).toFixed(1) })}</p>}
      {task.note && <p className="rounded-xl bg-earth-100 px-3 py-2 text-sm">{t('staff.note', { note: task.note })}</p>}
      <a
        href={`https://www.google.com/maps?q=${task.lat},${task.lng}`}
        target="_blank"
        rel="noreferrer"
        className="inline-block text-sm font-semibold text-leaf-700 underline"
      >
        📍 {t('staff.openMap')}
      </a>

      {problem ? (
        <div className="space-y-2 rounded-xl bg-slate-50 p-3">
          <Field label={t('staff.whatWentWrong')}>
            <textarea className={inputClass} rows={2} maxLength={150} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('staff.reasonPlaceholder')} />
          </Field>
          <div className="flex gap-2">
            <Button variant="danger" disabled={busy || !reason.trim()} onClick={() => run(() => api.staffProblem(task.requestId, reason.trim()))}>
              {t('staff.sendToOfficer')}
            </Button>
            <Button variant="ghost" onClick={() => setProblem(false)}>{t('collector.common.cancel')}</Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button big disabled={busy} onClick={() => run(() => api.staffCollected(task.requestId))}>{t('staff.markCollected')}</Button>
          <Button variant="secondary" disabled={busy} onClick={() => setProblem(true)}>{t('staff.couldNot')}</Button>
        </div>
      )}
      <ErrorText error={error} />
    </Card>
  )
}
