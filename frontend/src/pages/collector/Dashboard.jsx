import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import CollectorStatusBanner, { PhoneVerifyPrompt } from '../../components/CollectorStatusBanner'
import { Badge, Button, Card, ErrorText, Field, inputClass, Loading, ProgressBar } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { inHours, kg, rupee } from '../../lib/format'
import { api } from '../../lib/api'
import { useLoad } from '../../lib/useLoad'
import { usePolling } from '../../lib/usePolling'

const load = () => Promise.all([api.collectorPools(), api.profile()])

export default function CollectorDashboard() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: loaded, error, loading, reload } = useLoad(load)
  const [openId, setOpenId] = useState(null)
  // Pools fill while the dealer is looking: refresh the numbers every few seconds.
  usePolling(reload, 10000)

  if (loading) return <Loading />
  if (error) return <ErrorText error={error} />
  const [data, profile] = loaded

  return (
    <>
      <h1 className="text-xl font-bold">🏘️ {t('collector.dashboard.title')}</h1>
      {user.phoneVerified === false && <PhoneVerifyPrompt />}
      <CollectorStatusBanner profile={profile} />
      <p className="text-sm text-slate-600">{t('collector.dashboard.intro')}</p>

      {data.length === 0 && profile.verification === 'VERIFIED' && profile.acceptingPickups && (
        <Card className="space-y-2 text-sm text-slate-600">
          <p>{t('collector.dashboard.empty')}</p>
          <p>
            {t('collector.dashboard.emptyHint')}{' '}
            <Link to="/profile" className="font-semibold text-leaf-700 underline">{t('collector.dashboard.profileLink')}</Link>.
          </p>
        </Card>
      )}

      {data.map((p) => (
        <Card key={p.poolId} className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-semibold">{p.name}</h2>
            {p.ready ? (
              <Badge>✅ {t('collector.pool.ready')}</Badge>
            ) : p.inRange ? (
              <Badge tone="amber">⏳ {t('collector.pool.filling')}</Badge>
            ) : (
              <Badge tone="slate">📍 {t('collector.pool.outside')}</Badge>
            )}
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center text-sm">
            <Metric label={t('collector.pool.distance')} value={t('collector.pool.km', { value: p.distanceKm })} />
            <Metric label={t('collector.pool.load')} value={kg(p.totalKg)} />
            <Metric label={t('collector.pool.profit')} value={rupee(p.profit)} />
          </dl>
          <div className="space-y-1">
            <ProgressBar percent={p.percent} />
            <p className="text-sm text-slate-700">
              <b>{t('collector.pool.percentFull', { percent: p.percent })}</b> ({rupee(Math.max(p.profit, 0))} / {rupee(p.target)})
              {p.kgNeeded != null && p.kgNeeded > 0 && ` · ${t('collector.pool.needMore', { weight: kg(p.kgNeeded) })}`}
            </p>
          </div>
          <ul className="space-y-1 text-sm" aria-label={t('collector.pool.inside')}>
            {p.items.map((i) => (
              <li key={i.itemCode} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5">
                <span>{t(`item.${i.itemCode}.name`, { defaultValue: i.itemCode })} · {kg(i.kg)}</span>
                <span className={i.buyRate == null ? 'text-xs text-red-700' : 'text-xs text-slate-600'}>
                  {i.buyRate == null ? t('collector.pool.notBought') : t('collector.pool.yourRate', { rate: rupee(i.buyRate) })}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500">
            {p.households} {p.households === 1 ? t('collector.pool.household') : t('collector.pool.households')} · {t('collector.pool.profitPerKm', { amount: rupee(p.profitPerKm) })}
          </p>

          {!p.inRange && (
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700" role="status">
              {t('collector.pool.outsideHint', { distance: p.distanceKm, radius: p.serviceRadiusKm })}{' '}
              <Link to="/profile" className="font-semibold text-leaf-700 underline">{t('collector.dashboard.profileLink')}</Link>
            </p>
          )}
          {p.inRange && p.profit <= 0 && (
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">{t('collector.pool.noProfit')}</p>
          )}

          {p.tooHeavy && (
            <p className="rounded-xl bg-earth-100 px-3 py-2 text-sm text-slate-800" role="status">
              ⚠️ {t('collector.pool.tooHeavy', { kg: kg(p.capacityKg) })}
            </p>
          )}

          {p.ready &&
            (openId === p.poolId ? (
              <AcceptForm poolId={p.poolId} onCancel={() => setOpenId(null)} onDone={reload} />
            ) : (
              <Button big disabled={p.tooHeavy} onClick={() => setOpenId(p.poolId)}>
                {t('collector.pool.accept')}
              </Button>
            ))}
        </Card>
      ))}
    </>
  )
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-2">
      <dd className="font-bold">{value}</dd>
      <dt className="text-xs text-slate-500">{label}</dt>
    </div>
  )
}

function AcceptForm({ poolId, onCancel }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [start, setStart] = useState(() => inHours(24))
  const [end, setEnd] = useState(() => inHours(26))
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.acceptPool(poolId, `${start}:00`, `${end}:00`)
      navigate('/pickups')
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl bg-leaf-50 p-3">
      <p className="text-sm font-semibold">{t('collector.accept.intro')}</p>
      <Field label={t('collector.accept.start')}>
        <input className={inputClass} type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
      </Field>
      <Field label={t('collector.accept.end')}>
        <input className={inputClass} type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required />
      </Field>
      {error?.code === 'PHONE_NOT_VERIFIED' ? <PhoneVerifyPrompt /> : <ErrorText error={error} />}
      <div className="flex gap-2">
        <Button disabled={busy} className="flex-1">
          {busy ? t('collector.common.wait') : t('collector.accept.confirm')}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('collector.common.cancel')}
        </Button>
      </div>
    </form>
  )
}
