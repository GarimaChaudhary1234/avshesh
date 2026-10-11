import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { Button, Card, ErrorText, Field, inputClass } from '../components/ui'
import { api } from '../lib/api'

/** Two steps on one page: ask for a code by SMS, then enter the code with a new password. */
export default function ForgotPassword() {
  const { t } = useTranslation()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [sent, setSent] = useState(null)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const run = (action) => async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const requestCode = run(async () => setSent(await api.forgotPassword(phone)))
  const reset = run(async () => {
    await api.resetPassword({ phone, code, newPassword })
    setDone(true)
  })

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 p-5">
      <div className="flex justify-end">
        <LanguageSwitcher className="border-slate-300 text-slate-700" />
      </div>
      <h1 className="text-center text-2xl font-bold text-leaf-700">{t('forgot.title')}</h1>
      <Card className="space-y-4">
        {done ? (
          <p className="font-semibold text-leaf-700">{t('forgot.done')}</p>
        ) : (
          <>
            <form onSubmit={requestCode} className="space-y-3">
              <p className="text-sm text-slate-600">{t('forgot.intro')}</p>
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
              <Button disabled={busy} variant={sent ? 'secondary' : 'primary'}>{t('forgot.sendCode')}</Button>
            </form>

            {sent && (
              <form onSubmit={reset} className="space-y-3">
                <p className="text-sm text-leaf-700">{t('forgot.sent')}</p>
                {/* Only present in local test mode, where no real SMS is sent. */}
                {sent.devCode && (
                  <p className="rounded-xl bg-earth-100 px-3 py-2 text-sm">{t('verify.devCode', { code: sent.devCode })}</p>
                )}
                <Field label={t('verify.code')}>
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    maxLength={6}
                    pattern="\d{6}"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                  />
                </Field>
                <Field label={t('forgot.newPassword')} hint={t('auth.min6')}>
                  <input
                    className={inputClass}
                    type="password"
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </Field>
                <Button disabled={busy}>{t('forgot.reset')}</Button>
              </form>
            )}
            <ErrorText error={error} />
          </>
        )}
        <p className="text-center text-sm">
          <Link to="/login" className="font-semibold text-leaf-700">{t('forgot.back')}</Link>
        </p>
      </Card>
    </div>
  )
}
