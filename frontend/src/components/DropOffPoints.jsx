import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { useLoad } from '../lib/useLoad'
import { Card, ErrorText, Loading } from './ui'

/** The nearest authorised places to hand in hazardous waste, closest first. */
export default function DropOffPoints() {
  const { t } = useTranslation()
  const { data, error, loading } = useLoad(api.nearbyPoints)

  if (loading) return <Loading label={t('dropoff.finding')} />
  if (error) return <ErrorText error={error} />
  if (data.length === 0) {
    return <Card className="text-sm text-slate-600">{t('dropoff.none')}</Card>
  }

  return (
    <div className="space-y-2">
      <h3 className="font-semibold">{t('dropoff.title')}</h3>
      {data.map((p) => (
        <Card key={p.id} className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold">{p.name}</p>
            <span className="shrink-0 text-sm text-slate-600">{t('dropoff.distance', { km: p.distanceKm })}</span>
          </div>
          <p className="text-sm text-slate-600">{p.address}</p>
          <p className="text-sm">{t('dropoff.accepts', { items: p.accepts })}</p>
          {p.openingHours && <p className="text-xs text-slate-500">🕒 {p.openingHours}</p>}
        </Card>
      ))}
    </div>
  )
}
