import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge, Button, Card, ErrorText, Field, inputClass, Loading } from '../../components/ui'
import { api } from '../../lib/api'
import { useLoad } from '../../lib/useLoad'

// Centre of the demo mohalla in ward 15: the officer replaces these with the real location of the point.
const EMPTY = { name: '', address: '', lat: '20.3055', lng: '85.7977', accepts: '', openingHours: '', active: true }

export default function Points() {
  const { t } = useTranslation()
  const { data, error, loading, reload } = useLoad(api.municipalPoints)
  const [form, setForm] = useState(EMPTY)
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)

  if (loading) return <Loading />
  if (error) return <ErrorText error={error} />

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const add = async (e) => {
    e.preventDefault()
    setBusy(true)
    setFormError(null)
    try {
      await api.createPoint({ ...form, lat: Number(form.lat), lng: Number(form.lng) })
      setForm(EMPTY)
      await reload()
    } catch (err) {
      setFormError(err)
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (p) => {
    await api.updatePoint(p.id, { ...p, active: !p.active })
    reload()
  }

  return (
    <>
      <h1 className="text-xl font-bold">📍 {t('municipal.points.title')}</h1>
      <p className="text-sm text-slate-600">{t('municipal.points.intro')}</p>

      {data.map((p) => (
        <Card key={p.id} className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-semibold">{p.name}</h2>
            <Badge tone={p.active ? 'green' : 'slate'}>{p.active ? t('municipal.active') : t('municipal.inactive')}</Badge>
          </div>
          <p className="text-sm text-slate-600">{p.address}</p>
          <p className="text-sm">{t('municipal.points.accepts', { value: p.accepts })}</p>
          {p.openingHours && <p className="text-xs text-slate-500">🕒 {p.openingHours}</p>}
          <Button variant="secondary" onClick={() => toggle(p)}>
            {p.active ? t('municipal.deactivate') : t('municipal.activate')}
          </Button>
        </Card>
      ))}

      <form onSubmit={add}>
        <Card className="space-y-3">
          <h2 className="font-semibold">{t('municipal.points.add')}</h2>
          <Field label={t('municipal.name')}><input className={inputClass} maxLength={120} value={form.name} onChange={set('name')} required /></Field>
          <Field label={t('municipal.points.address')}><input className={inputClass} maxLength={255} value={form.address} onChange={set('address')} required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('municipal.points.lat')} hint={t('municipal.points.latHint')}><input className={inputClass} type="number" step="any" value={form.lat} onChange={set('lat')} required /></Field>
            <Field label={t('municipal.points.lng')}><input className={inputClass} type="number" step="any" value={form.lng} onChange={set('lng')} required /></Field>
          </div>
          <Field label={t('municipal.points.acceptsLabel')}><input className={inputClass} maxLength={255} placeholder={t('municipal.points.acceptsPlaceholder')} value={form.accepts} onChange={set('accepts')} required /></Field>
          <Field label={t('municipal.points.hours')}><input className={inputClass} maxLength={80} value={form.openingHours} onChange={set('openingHours')} /></Field>
          <ErrorText error={formError} />
          <Button big disabled={busy}>{busy ? t('municipal.saving') : t('municipal.points.addButton')}</Button>
        </Card>
      </form>
    </>
  )
}
