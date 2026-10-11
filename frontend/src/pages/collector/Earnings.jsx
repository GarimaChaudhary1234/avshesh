import { useTranslation } from 'react-i18next'
import { Card, ErrorText, Loading, Stat } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { kg, rupee } from '../../lib/format'
import { api } from '../../lib/api'
import { useLoad } from '../../lib/useLoad'

const loadWeek = () => api.earnings(7)

export default function Earnings() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data, error, loading } = useLoad(loadWeek)

  if (loading) return <Loading />
  if (error) return <ErrorText error={error} />

  return (
    <>
      <h1 className="text-xl font-bold">💰 {t('collector.earnings.title')}</h1>
      <Card className="space-y-3">
        <p className="text-sm text-slate-600">{t('collector.earnings.period', { days: data.days })}</p>
        <p className="text-lg">
          {t('collector.earnings.pickupsCount', { n: data.pickups })} · {kg(data.kg)} · <b className="text-leaf-700">{t('collector.earnings.profitAmount', { amount: rupee(data.profit) })}</b>
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Stat label={t('collector.earnings.pickups')} value={data.pickups} />
          <Stat label={t('collector.earnings.collected')} value={kg(data.kg)} />
          <Stat label={t('collector.earnings.profit')} value={rupee(data.profit)} />
        </div>
        <p className="text-sm text-slate-600">{t('collector.earnings.paid', { amount: rupee(data.paidToHouseholds) })}</p>
        {user.role === 'COMPOST' && (
          <p className="rounded-xl bg-leaf-50 px-3 py-2 text-sm">
            🌱 {t('collector.earnings.compost', { wet: kg(data.kg), compost: kg(data.compostKg) })}
          </p>
        )}
      </Card>
    </>
  )
}
