import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import ActivityFeed from '../../components/ActivityFeed'
import NewOfficerForm from '../../components/NewOfficerForm'
import OfficerCard from '../../components/OfficerCard'
import { Badge, Card, ErrorText, Loading, Stat } from '../../components/ui'
import { api } from '../../lib/api'
import { roleLabel } from '../../lib/auth'
import { count, kg } from '../../lib/format'
import { useLoad } from '../../lib/useLoad'

/** One ward in depth, for the commissioner: its numbers, its officers (who can be changed), staff, dealers and activity. */
export default function WardDetail() {
  const { t } = useTranslation()
  const { id } = useParams()
  const load = useCallback(() => Promise.all([api.municipalWard(id), api.municipalWards()]), [id])
  const { data, error, loading, reload } = useLoad(load)

  if (loading) return <Loading />
  if (error) return <ErrorText error={error} />
  const [detail, city] = data
  const { row } = detail
  const wardChoices = city.wards.map((w) => ({ id: w.ward.id, label: w.ward.label }))

  return (
    <>
      <Link to="/wards" className="text-sm font-semibold text-leaf-700 underline">← {t('city.ward.back')}</Link>
      <h1 className="text-xl font-bold">🏘️ {row.ward.label}</h1>
      <p className="text-sm text-slate-600">
        {t('city.ward.population', { population: count(row.ward.population), households: count(row.ward.households) })}
      </p>

      <Card className="space-y-3">
        <h2 className="font-semibold">{t('city.ward.stats')}</h2>
        <div className="grid grid-cols-2 gap-3">
          <Stat label={t('city.ward.registered')} value={count(row.registeredHouseholds)} />
          <Stat label={t('city.ward.verifiedDealers')} value={count(row.verifiedDealers)} />
          <Stat label={t('city.ward.pendingDealers')} value={count(row.pendingDealers)} />
          <Stat label={t('city.ward.requests')} value={count(row.openRequests)} />
          <Stat label={t('city.ward.disputes')} value={count(row.openDisputes)} />
          <Stat label={t('city.ward.pickups')} value={count(row.pickups)} />
          <Stat label={t('city.ward.collections')} value={count(row.collections)} />
          <Stat label={t('city.ward.diverted')} value={kg(row.kgDiverted)} />
          <Stat label={t('city.ward.kept')} value={row.keptFromDumpPercent == null ? '–' : `${row.keptFromDumpPercent}%`} />
        </div>
      </Card>

      <h2 className="pt-2 text-lg font-semibold">{t('city.ward.officers')}</h2>
      {detail.officers.length === 0 && <Card className="text-sm text-slate-600">{t('city.ward.noOfficers')}</Card>}
      {detail.officers.map((o) => (
        <OfficerCard key={o.id} officer={o} wards={wardChoices} onChanged={reload} showWard={false} />
      ))}
      <NewOfficerForm fixedWardId={row.ward.id} wards={wardChoices} onCreated={reload} />

      <h2 className="pt-2 text-lg font-semibold">{t('city.ward.staff')}</h2>
      {detail.staff.length === 0 && <Card className="text-sm text-slate-600">{t('city.ward.noStaff')}</Card>}
      {detail.staff.map((s) => (
        <Card key={s.id} className="flex items-center justify-between gap-2">
          <div>
            <p className="font-semibold">{s.name}</p>
            <p className="text-sm text-slate-600">{s.phone}</p>
          </div>
          {!s.active && <Badge tone="slate">{t('city.ward.staffInactive')}</Badge>}
        </Card>
      ))}

      <h2 className="pt-2 text-lg font-semibold">{t('city.ward.dealers')}</h2>
      {detail.dealers.length === 0 && <Card className="text-sm text-slate-600">{t('city.ward.noDealers')}</Card>}
      {detail.dealers.map((d) => (
        <Card key={d.id} className="flex items-center justify-between gap-2">
          <div>
            <p className="font-semibold">{d.businessName ?? d.name}</p>
            <p className="text-sm text-slate-600">{roleLabel(t, d.role)} · {d.phone}</p>
          </div>
          <Badge tone={d.verification === 'VERIFIED' ? 'green' : d.verification === 'PENDING' ? 'amber' : 'red'}>
            {t(`municipal.verification.${d.verification}`, { defaultValue: d.verification })}
          </Badge>
        </Card>
      ))}

      <Card className="space-y-2">
        <h2 className="font-semibold">{t('city.ward.activity')}</h2>
        <ActivityFeed entries={detail.activity} />
      </Card>
    </>
  )
}
