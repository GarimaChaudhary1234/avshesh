import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button, Card, Field, inputClass } from '../../components/ui'
import { ErrorOrVerify } from '../../components/VerifyPrompt'
import { rupee } from '../../lib/format'
import { api } from '../../lib/api'
import { queueListing } from '../../lib/offlineQueue'

const MODES = [
  { value: 'POOL', title: 'household.new.poolTitle', note: 'household.new.poolNote' },
  { value: 'SELF_DROP', title: 'household.new.selfTitle', note: 'household.new.selfNote' },
]

// No network at all (not a server error): the listing can safely wait on the phone.
const isOffline = (err) => err?.status === 0 || err?.code === 'NETWORK' || navigator.onLine === false

export default function NewListing() {
  const { t } = useTranslation()
  const scan = useLocation().state?.scan
  const navigate = useNavigate()
  const [weight, setWeight] = useState('')
  const [readyFrom, setReadyFrom] = useState(() => new Date().toISOString().slice(0, 10))
  const [mode, setMode] = useState('POOL')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  if (!scan) return <Navigate to="/scan" replace />

  const rate = scan.localRate ?? (scan.minRate + scan.maxRate) / 2
  const estimate = Number(weight) > 0 ? Number(weight) * rate : 0

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const body = {
      itemCode: scan.itemCode,
      estKg: Number(weight),
      readyFrom,
      mode,
      photoKey: scan.photoKey,
    }
    try {
      await api.createListing(body)
      navigate(mode === 'POOL' ? '/' : '/listings')
    } catch (err) {
      if (isOffline(err)) {
        queueListing(body)
        navigate('/listings', { state: { notice: t('household.new.offlineSaved') } })
      } else {
        setError(err)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h1 className="text-xl font-bold">{t('household.new.title')}</h1>
      <Card className="space-y-4">
        <form onSubmit={submit} className="space-y-4">
          <p className="font-semibold">{t(`item.${scan.itemCode}.name`, { defaultValue: scan.name })}</p>
          <Field label={t('household.new.weight')}>
            <input
              className={inputClass}
              type="number"
              inputMode="decimal"
              min="0.1"
              max="500"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              required
            />
          </Field>
          <p className="rounded-xl bg-leaf-50 px-3 py-2">
            <Trans
              i18nKey="household.new.estimated"
              values={{ amount: rupee(estimate) }}
              components={{ b: <b className="text-xl text-leaf-700" /> }}
            />
            <span className="block text-xs text-slate-500">
              {scan.localRate == null
                ? t('household.new.rateAtAi', { rate: rupee(rate) })
                : t('household.new.rateAt', { rate: rupee(rate) })}
            </span>
          </p>
          <Field label={t('household.new.readyFrom')}>
            <input
              className={inputClass}
              type="date"
              value={readyFrom}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setReadyFrom(e.target.value)}
              required
            />
          </Field>

          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium text-slate-700">{t('household.new.handOver')}</legend>
            {MODES.map((m) => (
              <label
                key={m.value}
                className={`block cursor-pointer rounded-xl border p-3 ${
                  mode === m.value ? 'border-leaf-600 bg-leaf-50' : 'border-slate-200'
                }`}
              >
                <input
                  type="radio"
                  name="mode"
                  className="mr-2"
                  checked={mode === m.value}
                  onChange={() => setMode(m.value)}
                />
                <b>{t(m.title)}</b>
                <span className="block pl-6 text-xs text-slate-500">{t(m.note)}</span>
              </label>
            ))}
          </fieldset>

          <ErrorOrVerify error={error} />
          <Button big disabled={busy || !(Number(weight) > 0)}>
            {busy ? t('household.wait') : t('household.new.submit')}
          </Button>
        </form>
      </Card>
    </>
  )
}
