import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Badge, Card, ErrorText, Loading, inputClass } from '../../components/ui'
import { api } from '../../lib/api'
import { count, dateTime } from '../../lib/format'
import { useLoad } from '../../lib/useLoad'
import { needsAttention } from './CityOverview'

const SORTS = {
  number: (a, b) => a.ward.id - b.ward.id,
  requests: (a, b) => b.openRequests + b.openDisputes - (a.openRequests + a.openDisputes),
  households: (a, b) => b.registeredHouseholds - a.registeredHouseholds,
}

/** Every ward in one list, searchable, so the commissioner can open any of them. */
export default function Wards() {
  const { t } = useTranslation()
  const { data, error, loading } = useLoad(api.municipalWards)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('number')
  const [onlyAttention, setOnlyAttention] = useState(false)

  const rows = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    return data.wards
      .filter((w) => !onlyAttention || needsAttention(w))
      .filter((w) => !q || w.ward.label.toLowerCase().includes(q) || w.officers.some((o) => o.name.toLowerCase().includes(q)))
      .sort(SORTS[sort])
  }, [data, query, sort, onlyAttention])

  if (loading) return <Loading />
  if (error) return <ErrorText error={error} />

  return (
    <>
      <h1 className="text-xl font-bold">🗺️ {t('city.wards.title')}</h1>
      <div className="space-y-2">
        <input className={inputClass} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('city.wards.search')} aria-label={t('city.wards.search')} />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            {t('city.wards.sort')}
            <select className="rounded-lg border border-slate-300 bg-white px-2 py-1" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="number">{t('city.wards.sortNumber')}</option>
              <option value="requests">{t('city.wards.sortRequests')}</option>
              <option value="households">{t('city.wards.sortHouseholds')}</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={onlyAttention} onChange={(e) => setOnlyAttention(e.target.checked)} />
            {t('city.wards.onlyAttention')}
          </label>
        </div>
      </div>

      {rows.length === 0 && <Card className="text-sm text-slate-600">{t('city.wards.none')}</Card>}
      {rows.map((w) => {
        const active = w.officers.filter((o) => o.active)
        return (
          <Link key={w.ward.id} to={`/wards/${w.ward.id}`} className="block">
            <Card className="space-y-1 hover:ring-2 hover:ring-leaf-300">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold">{w.ward.label}</h2>
                {active.length === 0 ? <Badge tone="red">{t('city.wards.noOfficer')}</Badge> : null}
              </div>
              {active.length > 0 && <p className="text-sm">{t('city.wards.officer', { names: active.map((o) => o.name).join(', ') })}</p>}
              <p className="text-sm text-slate-700">
                {t('city.wards.line1', { registered: count(w.registeredHouseholds), official: count(w.ward.households) })}
              </p>
              <p className="text-sm text-slate-700">{t('city.wards.line2', { dealers: w.dealers, requests: w.openRequests, disputes: w.openDisputes })}</p>
              <p className="text-xs text-slate-500">
                {w.lastActivityAt ? t('city.wards.lastAction', { when: dateTime(w.lastActivityAt) }) : t('city.wards.noAction')}
              </p>
            </Card>
          </Link>
        )
      })}
    </>
  )
}
