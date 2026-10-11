import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button, Card, ErrorText, Field, inputClass } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'

export default function Verify() {
  const { t } = useTranslation()
  const { user, refresh } = useAuth()
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const run = (action) => async (e) => {
    e?.preventDefault()
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

  const send = run(async () => setSent(await api.sendPhoneCode()))
  const confirm = run(async () => {
    await api.verifyPhone(code)
    await refresh()
  })

  if (user.phoneVerified) {
    return (
      <Card className="space-y-3">
        <p className="font-semibold text-leaf-700">{t('verify.done')}</p>
        <Link to="/" className="font-semibold text-leaf-700 underline">{t('verify.continue')}</Link>
      </Card>
    )
  }

  return (
    <Card className="space-y-4">
      <h1 className="text-xl font-bold text-leaf-700">{t('verify.title')}</h1>
      <p className="text-sm text-slate-600">{t('verify.why', { phone: user.phone })}</p>

      <Button disabled={busy} onClick={send} variant={sent ? 'secondary' : 'primary'}>
        {sent ? t('verify.resend') : t('verify.send')}
      </Button>

      {sent?.sent && <p className="text-sm text-leaf-700">{t('verify.sent')}</p>}
      {/* The server only returns the code in local test mode, where no real SMS is sent. */}
      {sent?.devCode && (
        <p className="rounded-xl bg-earth-100 px-3 py-2 text-sm">{t('verify.devCode', { code: sent.devCode })}</p>
      )}

      <form onSubmit={confirm} className="space-y-3">
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
        <ErrorText error={error} />
        <Button disabled={busy}>{t('verify.confirm')}</Button>
      </form>
    </Card>
  )
}
