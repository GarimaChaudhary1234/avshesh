import { useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import DropOffPoints from '../../components/DropOffPoints'
import { StarRating } from '../../components/Stars'
import MunicipalPickupForm from '../../components/MunicipalPickupForm'
import { Badge, Button, Card, Field, inputClass } from '../../components/ui'
import { ErrorOrVerify, VerifyPrompt } from '../../components/VerifyPrompt'
import { useAuth } from '../../lib/auth'
import { rupee } from '../../lib/format'
import { api } from '../../lib/api'
import { downscale } from '../../lib/image'
import { useLoad } from '../../lib/useLoad'

export default function Scan() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const catalog = useLoad(api.catalog)
  const mode = useLoad(api.scanMode)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [item, setItem] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  // "mock": the backend cannot read photos, so the user names the item. "bedrock": photo only.
  const isMock = mode.data?.scanner === 'mock'

  useEffect(() => {
    if (!file) return undefined
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const pick = async (e) => {
    const chosen = e.target.files?.[0]
    setResult(null)
    setError(null)
    setFile(chosen ? await downscale(chosen) : null)
  }

  const scan = async () => {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      setResult(await api.scan(file, isMock ? item : ''))
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  // The backend rejects scans from unverified phones, so skip the camera and ask for verification first.
  if (!user?.phoneVerified) {
    return (
      <>
        <h1 className="text-xl font-bold">{t('household.scan.title')}</h1>
        <VerifyPrompt />
      </>
    )
  }

  return (
    <>
      <h1 className="text-xl font-bold">{t('household.scan.title')}</h1>

      <Card className="space-y-3">
        <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed border-leaf-500/40 bg-leaf-50 text-center">
          {preview ? (
            <img src={preview} alt={t('household.scan.photoAlt')} className="max-h-64 w-full object-contain" />
          ) : (
            <>
              <span className="text-4xl">📷</span>
              <span className="text-sm text-slate-600">{t('household.scan.takePhoto')}</span>
            </>
          )}
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
        </label>

        {isMock && (
          <Field
            label={t('household.scan.demoLabel')}
            hint={t('household.scan.demoHint')}
          >
            <select className={inputClass} value={item} onChange={(e) => setItem(e.target.value)}>
              <option value="">{t('household.scan.selectItem')}</option>
              {(catalog.data ?? []).map((i) => (
                <option key={i.code} value={i.code}>
                  {t(`item.${i.code}.name`, { defaultValue: i.name })}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Button big onClick={scan} disabled={!file || busy || mode.loading || (isMock && !item)}>
          {busy ? t('household.scan.analysing') : isMock ? t('household.scan.lookUp') : t('household.scan.identify')}
        </Button>
        <ErrorOrVerify error={error} />
      </Card>

      {result && <ScanResult result={result} onList={() => navigate('/list', { state: { scan: result } })} />}
    </>
  )
}

function ScanResult({ result, onList }) {
  const { t } = useTranslation()
  const name = t(`item.${result.itemCode}.name`, { defaultValue: result.name })
  const tip = t(`item.${result.itemCode}.tip`, { defaultValue: result.tip })
  switch (result.handling) {
    case 'DROP_OFF_POINT':
      return (
        <>
          <Card tone="danger" className="space-y-2">
            <h2 className="text-lg font-bold text-red-700">{t('household.scan.hazardTitle')}</h2>
            <p className="font-semibold">{name}</p>
            <p className="text-sm">{tip}</p>
            <p className="text-sm text-slate-700">{t('household.scan.hazardHandIn')}</p>
          </Card>
          <DropOffPoints />
        </>
      )
    case 'MUNICIPAL_PICKUP':
      return (
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">{name}</h2>
            <Badge tone="slate">{t('household.scan.general')}</Badge>
          </div>
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
            {t('household.scan.nobodyBuys')}
          </p>
          <p className="text-sm text-slate-600">{tip}</p>
          <MunicipalPickupForm itemCode={result.itemCode} />
        </Card>
      )
    default:
      return (
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">{name}</h2>
            <Badge tone={result.category === 'WET' ? 'amber' : 'green'}>
              {result.category === 'WET' ? t('household.scan.wet') : t('household.scan.dry')}
            </Badge>
          </div>
          <p>
            <Trans
              i18nKey="household.scan.market"
              values={{ min: rupee(result.minRate), max: rupee(result.maxRate) }}
              components={{ b: <b /> }}
            />
          </p>
          <p>
            {t('household.scan.liveRate')}{' '}
            {result.localRate != null ? (
              <>
                <b>
                  {t('household.scan.rateLine', { rate: rupee(result.localRate), collector: result.localCollector })}
                </b>{' '}
                <StarRating value={result.collectorRating} count={result.collectorRatingCount} />
              </>
            ) : (
              <span className="text-slate-500">{t('household.scan.noCollector')}</span>
            )}
          </p>
          <p className="rounded-xl bg-leaf-50 px-3 py-2 text-sm">{t('household.scan.tip', { tip })}</p>
          <Button big onClick={onList}>
            {t('household.scan.create')}
          </Button>
        </Card>
      )
  }
}
