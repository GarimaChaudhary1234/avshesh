import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import DumpShare from '../../components/DumpShare'
import PoolCard from '../../components/PoolCard'
import { Button, Card, ErrorText, Loading } from '../../components/ui'
import { kg, rupee } from '../../lib/format'
import { api } from '../../lib/api'
import { useLoad } from '../../lib/useLoad'
import { usePolling } from '../../lib/usePolling'

export default function HouseholdHome() {
  const { t } = useTranslation()
  const { data, error, loading, reload } = useLoad(api.home)
  usePolling(reload, 15000)

  if (loading) return <Loading />
  if (error) return <ErrorText error={error} />

  return (
    <>
      {data.ward && (
        <p className="text-sm text-slate-600">
          <Trans i18nKey="household.home.inWard" values={{ ward: data.ward.label }} components={{ b: <b /> }} />
        </p>
      )}

      <Card tone="brand">
        <p className="text-sm text-leaf-100">{t('household.home.thisMonth')}</p>
        <p className="mt-1 text-lg">
          <Trans
            i18nKey="household.home.earned"
            values={{ amount: rupee(data.earnedThisMonth) }}
            components={{ b: <b className="text-3xl" /> }}
          />
        </p>
        <p className="mt-1 text-sm text-leaf-100">
          {t('household.home.impact', { weight: kg(data.kgSaved), co2: kg(data.co2SavedKg) })}
        </p>
      </Card>

      <DumpShare scope="household" percent={data.keptFromDumpPercent} estimatedKg={data.estimatedWasteKg} keptKg={data.kgSaved} />

      <Link to="/scan">
        <Button big>{t('household.home.scan')}</Button>
      </Link>

      <h2 className="pt-2 text-lg font-semibold">{t('household.home.poolTitle')}</h2>
      {data.pools.length === 0 ? (
        <Card className="text-sm text-slate-600">{t('household.home.noPool')}</Card>
      ) : (
        data.pools.map((p) => <PoolCard key={p.id} pool={p} />)
      )}
    </>
  )
}
