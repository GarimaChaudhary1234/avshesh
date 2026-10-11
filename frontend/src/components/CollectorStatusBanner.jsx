import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

/** Prompt shown while a collector's phone is not verified (accepting pools is blocked until then). */
export function PhoneVerifyPrompt() {
  const { t } = useTranslation()
  return (
    <Notice tone="amber" title={t('banner.phone.title')}>
      <Link to="/verify" className="font-semibold underline">{t('banner.phone.link')}</Link>
    </Notice>
  )
}

/** Tells a scrap dealer or compost center why they are not seeing pools (not verified, rejected or paused). */
export default function CollectorStatusBanner({ profile }) {
  const { t } = useTranslation()
  if (profile.verification === 'PENDING') {
    return (
      <Notice tone="amber" title={`⏳ ${t('banner.pending.title')}`}>
        {t('banner.pending.body')}
      </Notice>
    )
  }
  if (profile.verification === 'REJECTED') {
    return (
      <Notice tone="red" title={t('banner.rejected.title')}>
        {t('banner.rejected.body')}
      </Notice>
    )
  }
  if (!profile.acceptingPickups) {
    return (
      <Notice tone="slate" title={`⏸️ ${t('banner.paused.title')}`}>
        {t('banner.paused.before')} <b>{t('banner.paused.setting')}</b> {t('banner.paused.middle')}{' '}
        <Link to="/profile" className="font-semibold underline">{t('banner.paused.profile')}</Link>{' '}
        {t('banner.paused.after')}
      </Notice>
    )
  }
  return null
}

const TONES = {
  amber: 'bg-earth-100 text-slate-800',
  red: 'bg-red-50 text-red-800',
  slate: 'bg-slate-100 text-slate-800',
}

function Notice({ tone, title, children }) {
  return (
    <div className={`rounded-2xl p-4 text-sm ${TONES[tone]}`} role="status">
      <p className="font-semibold">{title}</p>
      <p className="mt-1">{children}</p>
    </div>
  )
}
