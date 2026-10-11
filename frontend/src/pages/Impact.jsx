import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import DumpShare from '../components/DumpShare'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { Card, ErrorText, Loading, Stat } from '../components/ui'
import { kg, rupee } from '../lib/format'
import { api } from '../lib/api'
import { useLoad } from '../lib/useLoad'

const loadAll = () => api.impact()

/** Public page: no login needed. Shows municipalities and judges what the pools achieved. */
export default function Impact() {
  const { t } = useTranslation()
  const { data, error, loading } = useLoad(loadAll)

  return (
    <div className="mx-auto max-w-xl space-y-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-leaf-700">📊 {t('impact.title')}</h1>
        <LanguageSwitcher className="border-slate-300 text-slate-700" />
        <Link to="/" className="text-sm font-semibold text-leaf-700 underline">
          ← {t('impact.back')}
        </Link>
      </header>
      <p className="text-sm text-slate-600">{t('impact.intro')}</p>

      {loading && <Loading />}
      <ErrorText error={error} />
      {data && (
        <>
          <DumpShare scope="city" percent={data.keptFromDumpPercent} estimatedKg={data.estimatedWasteKg} keptKg={data.kgDiverted} />
          <Card className="grid grid-cols-2 gap-3">
            <Stat label={t('impact.diverted')} value={kg(data.kgDiverted)} />
            <Stat label={t('impact.recycled')} value={kg(data.kgRecycled)} />
            <Stat label={t('impact.composted')} value={kg(data.kgComposted)} />
            <Stat label={t('impact.co2')} value={kg(data.co2SavedKg)} />
          </Card>
          <Card className="grid grid-cols-2 gap-3">
            <Stat label={t('impact.paid')} value={rupee(data.paidToHouseholds)} />
            <Stat label={t('impact.pickups')} value={data.pickups} />
            <Stat label={t('impact.collections')} value={data.collections} />
          </Card>
          <p className="text-xs text-slate-500">{t('impact.disclaimer')}</p>
        </>
      )}
    </div>
  )
}
