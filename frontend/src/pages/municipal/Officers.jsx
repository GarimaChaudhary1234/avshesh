import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import NewOfficerForm from '../../components/NewOfficerForm'
import OfficerCard from '../../components/OfficerCard'
import { Card, ErrorText, Loading } from '../../components/ui'
import { api } from '../../lib/api'
import { useLoad } from '../../lib/useLoad'

/** Every ward officer of the city: create, move to another ward, switch off or on. Commissioner only. */
export default function Officers() {
  const { t } = useTranslation()
  const load = useCallback(() => Promise.all([api.municipalOfficers(), api.municipalWards()]), [])
  const { data, error, loading, reload } = useLoad(load)

  if (loading) return <Loading />
  if (error) return <ErrorText error={error} />
  const [officers, city] = data
  const wardChoices = city.wards.map((w) => ({ id: w.ward.id, label: w.ward.label }))

  return (
    <>
      <h1 className="text-xl font-bold">👷 {t('city.officers.title')}</h1>
      <p className="text-sm text-slate-600">{t('city.officers.intro')}</p>
      {officers.length === 0 && <Card className="text-sm text-slate-600">{t('city.officers.none')}</Card>}
      {officers.map((o) => (
        <OfficerCard key={o.id} officer={o} wards={wardChoices} onChanged={reload} />
      ))}
      <NewOfficerForm wards={wardChoices} onCreated={reload} />
    </>
  )
}
