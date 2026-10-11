import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { Button, Card, ErrorText, Field, inputClass } from './ui'

/** Creates a ward officer. With `fixedWardId` the ward is not asked for (the form sits on that ward's page). */
export default function NewOfficerForm({ wards, fixedWardId, onCreated }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({ name: '', phone: '', password: '', wardId: fixedWardId ?? '' })
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setDone(false)
    try {
      await api.createOfficer({ ...form, wardId: Number(form.wardId) })
      setForm({ name: '', phone: '', password: '', wardId: fixedWardId ?? '' })
      setDone(true)
      await onCreated()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-3">
        <h2 className="font-semibold">{t('city.officers.add')}</h2>
        <Field label={t('city.officers.name')}>
          <input className={inputClass} value={form.name} onChange={set('name')} required maxLength={100} />
        </Field>
        <Field label={t('city.officers.phone')}>
          <input className={inputClass} inputMode="numeric" maxLength={10} pattern="\d{10}" value={form.phone} onChange={set('phone')} required />
        </Field>
        <Field label={t('city.officers.password')} hint={t('city.officers.passwordHint')}>
          <input className={inputClass} type="password" minLength={6} value={form.password} onChange={set('password')} required />
        </Field>
        {fixedWardId == null && (
          <Field label={t('city.officers.ward')}>
            <select className={inputClass} value={form.wardId} onChange={set('wardId')} required>
              <option value="">{t('city.officers.pickWard')}</option>
              {wards.map((w) => (
                <option key={w.id} value={w.id}>{w.label}</option>
              ))}
            </select>
          </Field>
        )}
        <ErrorText error={error} />
        {done && <p role="status" className="text-sm font-semibold text-leaf-700">{t('city.officers.created')}</p>}
        <Button big disabled={busy}>{busy ? t('auth.wait') : t('city.officers.addButton')}</Button>
      </form>
    </Card>
  )
}
