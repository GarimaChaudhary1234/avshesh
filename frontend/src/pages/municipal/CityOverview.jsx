import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import ActivityFeed from '../../components/ActivityFeed'
import DumpShare from '../../components/DumpShare'
import { Card, ErrorText, Loading, Stat } from '../../components/ui'
import { api } from '../../lib/api'
import { count, kg } from '../../lib/format'
import { useLoad } from '../../lib/useLoad'

const load = () => Promise.all([api.municipalWards(), api.municipalActivity()])

export const needsAttention = (w) => w.openRequests > 0 || w.openDisputes > 0 || !w.officers.some((o) => o.active)

/** The commissioner's home: the whole city at a glance, the wards that need attention, and the latest activity. */
export default function CityOverview() {
  const { t } = useTranslation()
  const { data, error, loading } = useLoad(load)

  if (loading) return <Loading />
  if (error) return <ErrorText error={error} />
  const [{ summary: s, wards }, activity] = data
  const attention = wards.filter(needsAttention).sort((a, b) => b.openDisputes + b.openRequests - (a.openDisputes + a.openRequests)).slice(0, 6)

  return (
    <>
      <h1 className="text-xl font-bold">🏙️ {t('city.overview.title')}</h1>
      <p className="text-sm text-slate-600">{t('city.hierarchy')}</p>

      <Card className="grid grid-cols-2 gap-3">
        <Stat label={t('city.overview.wards')} value={count(s.wards)} />
        <Stat label={t('city.overview.withOfficer')} value={`${count(s.wardsWithOfficer)} / ${count(s.wards)}`} />
        <Stat label={t('city.overview.households')} value={count(s.registeredHouseholds)} />
        <Stat label={t('city.overview.officialHouseholds')} value={count(s.officialHouseholds)} />
        <Stat label={t('city.overview.population')} value={count(s.population)} />
        <Stat label={t('city.overview.dealers')} value={count(s.dealers)} />
        <Stat label={t('city.overview.openRequests')} value={count(s.openRequests)} />
        <Stat label={t('city.overview.openDisputes')} value={count(s.openDisputes)} />
      </Card>

      <DumpShare scope="city" percent={s.impact.keptFromDumpPercent} estimatedKg={s.impact.estimatedWasteKg} keptKg={s.impact.kgDiverted} />
      <p className="text-sm text-slate-600">{kg(s.impact.kgDiverted)} · {s.impact.pickups}</p>

      <Card className="space-y-2">
        <h2 className="font-semibold">⚠️ {t('city.overview.attention')}</h2>
        {attention.length === 0 && <p className="text-sm text-slate-600">{t('city.overview.allGood')}</p>}
        {attention.map((w) => (
          <Link key={w.ward.id} to={`/wards/${w.ward.id}`} className="block rounded-xl bg-slate-50 px-3 py-2 text-sm hover:bg-leaf-50">
            <span className="font-semibold">{w.ward.label}</span>
            <span className="block text-xs text-slate-600">
              {w.officers.some((o) => o.active) ? '' : `${t('city.wards.noOfficer')} · `}
              {t('city.wards.line2', { dealers: w.dealers, requests: w.openRequests, disputes: w.openDisputes })}
            </span>
          </Link>
        ))}
        <Link to="/wards" className="block text-sm font-semibold text-leaf-700 underline">{t('city.overview.seeAll')}</Link>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-semibold">{t('city.overview.recent')}</h2>
        <ActivityFeed entries={activity.slice(0, 10)} />
      </Card>
    </>
  )
}
