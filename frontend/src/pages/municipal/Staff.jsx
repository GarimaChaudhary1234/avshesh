import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge, Button, Card, ErrorText, Field, inputClass, Loading } from '../../components/ui'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useLoad } from '../../lib/useLoad'

export default function Staff() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data, error, loading, reload } = useLoad(api.municipalStaff)
  const [form, setForm] = useState({ name: '', phone: '', password: '' })
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)

  if (loading) return <Loading />
  if (error) return <ErrorText error={error} />

  // A commissioner has no ward of their own, so only ward officers add staff.
  const canAdd = user.wardId != null

  const add = async (e) => {
    e.preventDefault()
    setBusy(true)
    setFormError(null)
    try {
      await api.createStaff(form)
      setForm({ name: '', phone: '', password: '' })
      await reload()
    } catch (err) {
      setFormError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h1 className="text-xl font-bold">👷 {t('municipal.staff.title')}</h1>
      <p className="text-sm text-slate-600">{t('municipal.staff.intro')}</p>

      {data.length === 0 && <Card className="text-sm text-slate-600">{t('municipal.staff.empty')}</Card>}
      {data.map((s) => (
        <Card key={s.id} className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold">{s.name}</p>
            <p className="text-sm text-slate-600">{s.phone} · {s.hasLogin ? t('municipal.staff.hasLogin') : t('municipal.staff.noLogin')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={s.active ? 'green' : 'slate'}>{s.active ? t('municipal.active') : t('municipal.inactive')}</Badge>
            {canAdd && (
              <Button variant="secondary" onClick={() => api.setStaffActive(s.id, !s.active).then(reload)}>
                {s.active ? t('municipal.deactivate') : t('municipal.activate')}
              </Button>
            )}
          </div>
        </Card>
      ))}

      {canAdd ? (
        <form onSubmit={add}>
          <Card className="space-y-3">
            <h2 className="font-semibold">{t('municipal.staff.add')}</h2>
            <Field label={t('municipal.name')}>
              <input className={inputClass} maxLength={100} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </Field>
            <Field label={t('municipal.staff.phone')} hint={t('municipal.staff.phoneHint')}>
              <input className={inputClass} inputMode="numeric" maxLength={10} pattern="\d{10}" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} required />
            </Field>
            <Field label={t('municipal.staff.password')} hint={t('municipal.staff.passwordHint')}>
              <input className={inputClass} type="password" minLength={6} maxLength={72} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required />
            </Field>
            <ErrorText error={formError} />
            <Button big disabled={busy}>{busy ? t('municipal.saving') : t('municipal.staff.addButton')}</Button>
          </Card>
        </form>
      ) : (
        <Card className="text-sm text-slate-600">{t('municipal.staff.officerOnly')}</Card>
      )}
    </>
  )
}
