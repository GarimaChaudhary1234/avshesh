import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Badge, Button, Card, ErrorText, Field, inputClass, Loading } from '../../components/ui'
import { dateTime, kg, rupee } from '../../lib/format'
import { api } from '../../lib/api'
import { useLoad } from '../../lib/useLoad'

const STATUS = {
  OPEN: { tone: 'amber' },
  SCHEDULED: { tone: 'green' },
  COLLECTED: { tone: 'slate' },
  REJECTED: { tone: 'red' },
}

/** Local date as yyyy-mm-dd for <input type="date">, days from today. */
const dateIn = (days) => {
  const d = new Date(Date.now() + days * 24 * 3600_000)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

const load = () => Promise.all([api.municipalQueue(), api.municipalStaff()])

export default function Requests() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'disputes' ? 'disputes' : 'pickups'

  const select = (next) => setParams(next === 'disputes' ? { tab: 'disputes' } : {}, { replace: true })

  return (
    <>
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1" role="tablist">
        {['pickups', 'disputes'].map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => select(id)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              tab === id ? 'bg-white text-leaf-700 shadow-sm' : 'text-slate-600'
            }`}
          >
            {t(`municipal.tab.${id}`)}
          </button>
        ))}
      </div>
      {tab === 'disputes' ? <Disputes /> : <PickupRequests />}
    </>
  )
}

function PickupRequests() {
  const { t } = useTranslation()
  const { data, error, loading, reload } = useLoad(load)

  if (loading) return <Loading />
  if (error) return <ErrorText error={error} />
  const [requests, staff] = data

  return (
    <>
      <h1 className="text-xl font-bold">🗑️ {t('municipal.requests.title')}</h1>
      <p className="text-sm text-slate-600">{t('municipal.requests.intro')}</p>
      {requests.length === 0 && <Card className="text-sm text-slate-600">{t('municipal.requests.empty')}</Card>}
      {requests.map((r) => (
        <RequestCard key={r.id} request={r} staff={staff.filter((s) => s.active)} onChanged={reload} />
      ))}
    </>
  )
}

const loadDisputes = () => api.municipalDisputes()

function Disputes() {
  const { t } = useTranslation()
  const { data, error, loading, reload } = useLoad(loadDisputes)
  const [resolved, setResolved] = useState(false)

  if (loading) return <Loading />
  if (error) return <ErrorText error={error} />
  const open = data.filter((d) => d.status === 'DISPUTED')

  return (
    <>
      <h1 className="text-xl font-bold">⚠️ {t('municipal.disputes.title')}</h1>
      <p className="text-sm text-slate-600">{t('municipal.disputes.intro')}</p>
      {resolved && (
        <p role="status" className="rounded-xl bg-leaf-50 px-3 py-2 text-sm text-leaf-700">
          {t('municipal.disputes.resolved')}
        </p>
      )}
      {open.length === 0 && <Card className="text-sm text-slate-600">{t('municipal.disputes.empty')}</Card>}
      {open.map((d) => (
        <DisputeCard
          key={d.stopId}
          dispute={d}
          onResolved={async () => {
            await reload()
            setResolved(true)
          }}
          onStart={() => setResolved(false)}
        />
      ))}
    </>
  )
}

function DisputeCard({ dispute: d, onResolved, onStart }) {
  const { t } = useTranslation()
  const [note, setNote] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const resolve = async (e) => {
    e.preventDefault()
    onStart()
    setBusy(true)
    setError(null)
    try {
      await api.resolveDispute(d.stopId, note.trim())
      await onResolved()
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={resolve}>
      <Card className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold">{d.householdName}</h2>
            <p className="text-sm text-slate-600">
              {t('municipal.disputes.collector', { name: d.dealerName })} · {rupee(d.amountPaid)}
            </p>
          </div>
          <Badge tone="amber">{t('municipal.disputes.badge')}</Badge>
        </div>
        {d.note && <p className="text-sm">“{d.note}”</p>}
        <p className="text-xs text-slate-500">{dateTime(d.raisedAt)}</p>
        <Field label={t('municipal.disputes.noteLabel')}>
          <textarea
            className={inputClass}
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            required
          />
        </Field>
        <ErrorText error={error} />
        <Button disabled={busy || !note.trim()}>{t('municipal.disputes.resolve')}</Button>
      </Card>
    </form>
  )
}

function RequestCard({ request: r, staff, onChanged }) {
  const { t } = useTranslation()
  const [date, setDate] = useState(() => dateIn(1))
  const [staffId, setStaffId] = useState(r.staffId ?? '')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const status = STATUS[r.status]

  const update = async (next) => {
    setBusy(true)
    setError(null)
    try {
      await api.updateMunicipalRequest(r.id, {
        status: next,
        scheduledFor: next === 'SCHEDULED' ? date : null,
        staffId: next === 'SCHEDULED' ? Number(staffId) : null,
      })
      onChanged()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{r.itemName}</h2>
          <p className="text-sm text-slate-600">{kg(r.estKg)} · {r.householdName} · {r.phone}</p>
        </div>
        <Badge tone={status.tone}>{t(`municipal.status.${r.status}`)}</Badge>
      </div>
      {r.note && <p className="text-sm">“{r.note}”</p>}
      <a
        className="text-xs font-semibold text-leaf-700 underline"
        href={`https://www.google.com/maps?q=${r.lat},${r.lng}`}
        target="_blank"
        rel="noreferrer"
      >
        📍 {t('municipal.requests.viewLocation')}
      </a>
      {r.status === 'SCHEDULED' && (
        <p className="text-sm">
          <Trans i18nKey="municipal.requests.collectionOn" values={{ date: r.scheduledFor }} components={{ b: <b /> }} />
          {r.staffName && (
            <>
              {' '}
              <Trans
                i18nKey="municipal.requests.collectionBy"
                values={{ name: r.staffName, phone: r.staffPhone }}
                components={{ b: <b /> }}
              />
            </>
          )}
        </p>
      )}

      {(r.status === 'OPEN' || r.status === 'SCHEDULED') && (
        <div className="space-y-2 rounded-xl bg-slate-50 p-3">
          <Field label={t('municipal.requests.assignTo')}>
            <select className={inputClass} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">{t('municipal.requests.selectStaff')}</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <Field label={r.status === 'OPEN' ? t('municipal.requests.collectionDate') : t('municipal.requests.rescheduleTo')}>
            <input className={inputClass} type="date" min={dateIn(0)} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || !staffId} onClick={() => update('SCHEDULED')}>
              {r.status === 'OPEN' ? t('municipal.requests.assignSchedule') : t('municipal.requests.reschedule')}
            </Button>
            {r.status === 'SCHEDULED' && (
              <Button disabled={busy} variant="secondary" onClick={() => update('COLLECTED')}>
                {t('municipal.requests.markCollected')}
              </Button>
            )}
            <Button disabled={busy} variant="danger" onClick={() => update('REJECTED')}>
              {t('municipal.reject')}
            </Button>
          </div>
          {staff.length === 0 && (
            <p className="text-xs text-slate-500">{t('municipal.requests.addStaffFirst')}</p>
          )}
        </div>
      )}
      <ErrorText error={error} />
    </Card>
  )
}
