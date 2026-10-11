import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import LanguageSwitcher from '../components/LanguageSwitcher'
import LocationPicker from '../components/LocationPicker'
import { Button, Card, ErrorText, Field, inputClass } from '../components/ui'
import { roleLabel, useAuth } from '../lib/auth'

const ROLES = ['HOUSEHOLD', 'KABADIWALA', 'COMPOST']

// The pin starts in the demo neighbourhood (ward 15, Bhubaneswar); the user moves it to their home.
const DEMO_PIN = { lat: 20.305481, lng: 85.797729 }

export default function Register() {
  const { t } = useTranslation()
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ role: 'HOUSEHOLD', name: '', phone: '', password: '' })
  const [pin, setPin] = useState(DEMO_PIN)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const user = await register({ ...form, lat: pin.lat, lng: pin.lng })
      // When the server asks for proof of the phone number, that comes first; otherwise the user is in.
      navigate(user.phoneVerified ? '/' : '/verify')
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 p-5">
      <div className="flex justify-end">
        <LanguageSwitcher className="border-slate-300 text-slate-700" />
      </div>
      <h1 className="text-center text-2xl font-bold text-leaf-700">{t('auth.join')}</h1>
      <Card>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map((r) => (
              <button
                type="button"
                key={r}
                onClick={() => setForm((f) => ({ ...f, role: r }))}
                className={`rounded-xl border px-2 py-3 text-sm font-semibold ${
                  form.role === r ? 'border-leaf-600 bg-leaf-50 text-leaf-700' : 'border-slate-200 text-slate-600'
                }`}
              >
                {roleLabel(t, r)}
              </button>
            ))}
          </div>
          <Field label={t('auth.name')}>
            <input className={inputClass} value={form.name} onChange={set('name')} required />
          </Field>
          <Field label={t('auth.phone')} hint={t('auth.tenDigits')}>
            <input
              className={inputClass}
              inputMode="numeric"
              maxLength={10}
              pattern="\d{10}"
              value={form.phone}
              onChange={set('phone')}
              required
            />
          </Field>
          <Field label={t('auth.password')} hint={t('auth.min6')}>
            <input
              className={inputClass}
              type="password"
              minLength={6}
              value={form.password}
              onChange={set('password')}
              required
            />
          </Field>
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">{t('location.pickOnRegister')}</p>
            <LocationPicker value={pin} onChange={setPin} />
          </div>
          <ErrorText error={error} />
          <Button big disabled={busy}>
            {busy ? t('auth.wait') : t('auth.register')}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm">
          {t('auth.haveAccount')}<Link to="/login" className="font-semibold text-leaf-700">{t('auth.login')}</Link>
        </p>
      </Card>
    </div>
  )
}
