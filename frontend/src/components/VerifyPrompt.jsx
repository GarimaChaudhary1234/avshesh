import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Card, ErrorText } from './ui'

/** Asks the user to verify their phone before listing, scanning or rating. */
export function VerifyPrompt() {
  const { t } = useTranslation()
  return (
    <Card className="space-y-2 text-sm">
      <p>{t('household.verify.needed')}</p>
      <Link to="/verify" className="font-semibold text-leaf-700 underline">
        {t('household.verify.link')}
      </Link>
    </Card>
  )
}

/** The backend answers 403 PHONE_NOT_VERIFIED for unverified users; show the verify link instead of a bare error. */
export function ErrorOrVerify({ error }) {
  if (error?.code === 'PHONE_NOT_VERIFIED') return <VerifyPrompt />
  return <ErrorText error={error} />
}
