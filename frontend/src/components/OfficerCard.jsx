import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { dateTime } from '../lib/format'
import { Badge, Button, Card, ErrorText, inputClass } from './ui'

/**
 * One ward officer, with what the commissioner can do: move them to another ward, switch them off or on.
 * `wards` is the list of {id, label} to choose from; `onChanged` runs after a change so the page reloads.
 */
export default function OfficerCard({ officer, wards, onChanged, showWard = true }) {
  const { t } = useTranslation()
  const [target, setTarget] = useState('')
  const [confirmOff, setConfirmOff] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const run = async (body) => {
    setBusy(true)
    setError(null)
    try {
      await api.updateOfficer(officer.id, body)
      setConfirmOff(false)
      setTarget('')
      await onChanged()
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
          <h3 className="font-semibold">{officer.name}</h3>
          <p className="text-sm text-slate-600">{officer.phone}</p>
          {showWard && (
            <Link to={`/wards/${officer.wardId}`} className="text-sm font-semibold text-leaf-700 underline">
              {officer.wardLabel}
            </Link>
          )}
        </div>
        <Badge tone={officer.active ? 'green' : 'red'}>{officer.active ? t('city.officers.on') : t('city.officers.off')}</Badge>
      </div>
      <p className="text-xs text-slate-500">
        {officer.lastActionAt ? t('city.officers.last', { when: dateTime(officer.lastActionAt) }) : t('city.officers.never')}
        {officer.actions > 0 && ` · ${t('city.officers.actions', { n: officer.actions })}`}
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-xs font-medium text-slate-600">{t('city.officers.move')}</span>
          <select className={inputClass} value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">{t('city.officers.pickWard')}</option>
            {wards
              .filter((w) => w.id !== officer.wardId)
              .map((w) => (
                <option key={w.id} value={w.id}>{w.label}</option>
              ))}
          </select>
        </label>
        <Button variant="secondary" disabled={busy || !target} onClick={() => run({ wardId: Number(target) })}>
          {t('city.officers.moveButton')}
        </Button>
      </div>

      {officer.active ? (
        confirmOff ? (
          <div className="flex gap-2">
            <Button variant="danger" disabled={busy} onClick={() => run({ active: false })}>{t('city.officers.confirmOff')}</Button>
            <Button variant="ghost" onClick={() => setConfirmOff(false)}>{t('collector.common.cancel')}</Button>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmOff(true)}>{t('city.officers.switchOff')}</Button>
        )
      ) : (
        <Button variant="secondary" disabled={busy} onClick={() => run({ active: true })}>{t('city.officers.switchOn')}</Button>
      )}
      <ErrorText error={error} />
    </Card>
  )
}
