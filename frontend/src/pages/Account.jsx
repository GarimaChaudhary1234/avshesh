import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import LocationPicker from '../components/LocationPicker'
import { Button, Card, ErrorText } from '../components/ui'
import { api } from '../lib/api'
import { roleLabel, useAuth } from '../lib/auth'

/** The account of the logged-in user, with the home location (and so the ward) they can move. */
export default function Account() {
  const { t } = useTranslation()
  const { user, refresh } = useAuth()
  const [pin, setPin] = useState({ lat: user.lat, lng: user.lng })
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const changed = pin.lat !== user.lat || pin.lng !== user.lng

  const save = async () => {
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await api.setLocation(pin.lat, pin.lng)
      await refresh()
      setSaved(true)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-1">
        <h1 className="text-xl font-bold text-leaf-700">{t('location.accountTitle')}</h1>
        <p className="text-sm">{user.name} · {roleLabel(t, user.role)}</p>
        <p className="text-sm text-slate-600">{user.phone}</p>
        {!user.phoneVerified && (
          <Link to="/verify" className="text-sm font-semibold text-leaf-700 underline">{t('verify.bannerAction')}</Link>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">{t('location.title')}</h2>
        {user.role === 'MUNICIPAL' || user.role === 'FIELD_STAFF' ? (
          <p className="text-sm text-slate-600">{t('location.fixedForOfficers')}</p>
        ) : (
          <>
            <p className="text-sm text-slate-600">{t('location.rules')}</p>
            <LocationPicker value={pin} onChange={setPin} />
            <ErrorText error={error} />
            {saved && <p role="status" className="text-sm font-semibold text-leaf-700">{t('location.saved')}</p>}
            <Button big disabled={busy || !changed} onClick={save}>
              {busy ? t('auth.wait') : t('location.save')}
            </Button>
          </>
        )}
      </Card>
    </div>
  )
}
