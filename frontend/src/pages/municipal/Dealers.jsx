import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StarRating } from '../../components/Stars'
import { Badge, Button, Card, ErrorText, Loading } from '../../components/ui'
import { roleLabel } from '../../lib/auth'
import { api } from '../../lib/api'
import { useLoad } from '../../lib/useLoad'

const VERIFICATION = {
  VERIFIED: { tone: 'green', icon: '✅ ' },
  PENDING: { tone: 'amber', icon: '⏳ ' },
  REJECTED: { tone: 'red', icon: '' },
}

export default function Dealers() {
  const { t } = useTranslation()
  const { data, error, loading, reload } = useLoad(api.municipalCollectors)
  const [actionError, setActionError] = useState(null)

  if (loading) return <Loading />
  if (error) return <ErrorText error={error} />

  const verify = async (id, status) => {
    setActionError(null)
    try {
      await api.verifyCollector(id, status)
      reload()
    } catch (err) {
      setActionError(err)
    }
  }

  return (
    <>
      <h1 className="text-xl font-bold">🛺 {t('municipal.dealers.title')}</h1>
      <p className="text-sm text-slate-600">{t('municipal.dealers.intro')}</p>
      <ErrorText error={actionError} />
      {data.map((c) => {
        const v = VERIFICATION[c.verification]
        return (
          <Card key={c.id} className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold">{c.businessName ?? c.name}</h2>
                <p className="text-sm text-slate-600">{c.name} · {c.phone}</p>
              </div>
              <Badge tone={v.tone}>{v.icon}{t(`municipal.verification.${c.verification}`)}</Badge>
            </div>
            <p className="text-sm">
              {roleLabel(t, c.role)} · {t(`municipal.vehicle.${c.vehicleType}`)} · {t('municipal.dealers.upTo', { km: c.serviceRadiusKm })}
            </p>
            <StarRating value={c.rating} count={c.ratingCount} />
            {c.address && <p className="text-sm text-slate-600">{c.address}</p>}
            {c.workingHours && <p className="text-xs text-slate-500">🕒 {c.workingHours}</p>}
            {!c.acceptingPickups && <p className="text-xs text-slate-500">⏸️ {t('municipal.dealers.paused')}</p>}
            <div className="flex gap-2">
              {c.verification !== 'VERIFIED' && (
                <Button onClick={() => verify(c.id, 'VERIFIED')}>{t('municipal.dealers.verify')}</Button>
              )}
              {c.verification === 'PENDING' && (
                <Button variant="danger" onClick={() => verify(c.id, 'REJECTED')}>{t('municipal.reject')}</Button>
              )}
              {c.verification === 'VERIFIED' && (
                <Button variant="secondary" onClick={() => verify(c.id, 'REJECTED')}>{t('municipal.dealers.revoke')}</Button>
              )}
            </div>
          </Card>
        )
      })}
    </>
  )
}
