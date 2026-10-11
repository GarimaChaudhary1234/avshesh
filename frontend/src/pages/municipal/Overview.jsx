import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import ActivityFeed from '../../components/ActivityFeed'
import DumpShare from '../../components/DumpShare'
import { Card, ErrorText, Loading, Stat } from '../../components/ui'
import { kg, rupee } from '../../lib/format'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useLoad } from '../../lib/useLoad'
import CityOverview from './CityOverview'

const LOCALES = { en: 'en-IN', hi: 'hi-IN', or: 'or-IN' }

/** The commissioner (no ward) gets the city overview; a ward officer gets the ward overview below. */
export default function MunicipalOverview() {
  const { user } = useAuth()
  return user.wardId == null ? <CityOverview /> : <WardOverview />
}

const loadWard = () => Promise.all([api.municipalOverview(), api.municipalActivity()])

function WardOverview() {
  const { t, i18n } = useTranslation()
  const { data: loaded, error, loading } = useLoad(loadWard)

  if (loading) return <Loading />
  if (error) return <ErrorText error={error} />
  const [data, activity] = loaded
  const { impact, poolsByStatus: pools, ward } = data
  const num = (n) => n?.toLocaleString(LOCALES[i18n.language] ?? 'en-IN')

  return (
    <>
      <h1 className="text-xl font-bold">📊 {ward ? ward.label : t('municipal.overview.cityTitle')}</h1>
      {ward ? (
        <p className="text-sm text-slate-600">
          {t('municipal.overview.wardFigures', {
            households: num(ward.households),
            population: num(ward.population),
            registered: data.households,
          })}
        </p>
      ) : (
        <p className="text-sm text-slate-600">{t('municipal.overview.commissioner')}</p>
      )}

      {(data.openRequests > 0 || data.pendingCollectors > 0 || data.openDisputes > 0) && (
        <Card tone="notice" className="space-y-2">
          <p className="font-semibold">{t('municipal.overview.attention')}</p>
          {data.openDisputes > 0 && (
            <p className="text-sm font-semibold">
              ⚠️ {t('municipal.overview.disputes', { count: data.openDisputes })}{' '}
              <Link to="/requests?tab=disputes" className="font-semibold text-leaf-700 underline">{t('municipal.review')}</Link>
            </p>
          )}
          {data.openRequests > 0 && (
            <p className="text-sm">
              🗑️{' '}
              {data.openRequests === 1
                ? t('municipal.overview.openRequestsOne', { n: data.openRequests })
                : t('municipal.overview.openRequestsMany', { n: data.openRequests })}{' '}
              <Link to="/requests" className="font-semibold text-leaf-700 underline">{t('municipal.review')}</Link>
            </p>
          )}
          {data.pendingCollectors > 0 && (
            <p className="text-sm">
              🛺{' '}
              {data.pendingCollectors === 1
                ? t('municipal.overview.pendingDealersOne', { n: data.pendingCollectors })
                : t('municipal.overview.pendingDealersMany', { n: data.pendingCollectors })}{' '}
              <Link to="/dealers" className="font-semibold text-leaf-700 underline">{t('municipal.review')}</Link>
            </p>
          )}
        </Card>
      )}

      <DumpShare scope={ward ? 'ward' : 'city'} percent={impact.keptFromDumpPercent} estimatedKg={impact.estimatedWasteKg} keptKg={impact.kgDiverted} />

      <Card className="space-y-3">
        <h2 className="font-semibold">{t('municipal.overview.landfill')}</h2>
        <div className="grid grid-cols-2 gap-3">
          <Stat label={t('municipal.overview.diverted')} value={kg(impact.kgDiverted)} />
          <Stat label={t('municipal.overview.recycled')} value={kg(impact.kgRecycled)} />
          <Stat label={t('municipal.overview.composted')} value={kg(impact.kgComposted)} />
          <Stat label={t('municipal.overview.co2')} value={kg(impact.co2SavedKg)} />
        </div>
        <p className="text-sm text-slate-600">
          {t('municipal.overview.earned', { amount: rupee(impact.paidToHouseholds), pickups: impact.pickups })}
        </p>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">{t('municipal.overview.network')}</h2>
        <div className="grid grid-cols-3 gap-3">
          <Stat label={t('municipal.overview.households')} value={data.households} />
          <Stat label={t('municipal.overview.verifiedDealers')} value={data.verifiedCollectors} />
          <Stat label={t('municipal.overview.dropoffPoints')} value={data.openedCollectionPoints} />
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">{t('municipal.overview.pools')}</h2>
        <div className="grid grid-cols-4 gap-2">
          <Stat label={t('municipal.overview.filling')} value={pools.FILLING} />
          <Stat label={t('municipal.overview.ready')} value={pools.READY} />
          <Stat label={t('municipal.overview.accepted')} value={pools.ACCEPTED} />
          <Stat label={t('municipal.overview.done')} value={pools.DONE} />
        </div>
      </Card>
      <Card className="space-y-2">
        <h2 className="font-semibold">{t('activity.title')}</h2>
        <ActivityFeed entries={activity.slice(0, 10)} />
      </Card>
      <p className="text-xs text-slate-500">{t('municipal.overview.boundaries')}</p>
    </>
  )
}
