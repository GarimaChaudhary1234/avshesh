import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, ErrorText, Field, inputClass } from '../components/ui'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { roleLabel, useAuth } from '../lib/auth'

// Seeded accounts of the local demo database (see DemoDataSeeder on the backend).
const DEMO_ACCOUNTS = [
  { label: (t) => roleLabel(t, 'HOUSEHOLD'), phone: '9000000001' },
  { label: (t) => roleLabel(t, 'KABADIWALA'), phone: '9000000101' },
  { label: (t) => t('auth.demoCompost'), phone: '9000000102' },
  { label: (t) => t('auth.demoOfficer'), phone: '9000000201' },
  { label: (t) => t('auth.demoCommissioner'), phone: '9000000200' },
  { label: (t) => t('auth.demoStaff'), phone: '9000000301' },
]
const DEMO_PASSWORD = 'demo1234'

export default function Login() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(phone, password)
      navigate('/')
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
      <div className="text-center">
        <div className="text-5xl">♻️</div>
        <h1 className="mt-2 text-3xl font-bold text-leaf-700">Avshesh</h1>
        <p className="text-sm text-slate-600">{t('auth.tagline')}</p>
      </div>

      <Card>
        <form onSubmit={submit} className="space-y-4">
          <Field label={t('auth.phone')}>
            <input
              className={inputClass}
              inputMode="numeric"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </Field>
          <Field label={t('auth.password')}>
            <input
              className={inputClass}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <ErrorText error={error} />
          <Button big disabled={busy}>
            {busy ? t('auth.wait') : t('auth.login')}
          </Button>
        </form>
        <p className="mt-3 text-center text-sm">
          <Link to="/forgot" className="text-leaf-700 underline">{t('auth.forgot')}</Link>
        </p>
        <p className="mt-3 text-center text-sm">
          {t('auth.newHere')}<Link to="/register" className="font-semibold text-leaf-700">{t('auth.createAccount')}</Link>
        </p>
      </Card>

      <Card className="space-y-2">
        <p className="text-sm font-semibold">{t('auth.demoTitle')}</p>
        <p className="text-xs text-slate-600">{t('auth.demoHierarchy')}</p>
        <div className="grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map((a) => (
            <Button
              key={a.phone}
              variant="secondary"
              className="w-full"
              onClick={() => {
                setPhone(a.phone)
                setPassword(DEMO_PASSWORD)
              }}
            >
              {a.label(t)}
            </Button>
          ))}
        </div>
        <Link to="/impact" className="block pt-1 text-center text-sm text-leaf-700 underline">
          {t('auth.viewImpact')}
        </Link>
      </Card>
    </div>
  )
}
