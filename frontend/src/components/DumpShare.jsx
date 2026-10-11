import { useTranslation } from 'react-i18next'
import { kg } from '../lib/format'
import { Card, ProgressBar } from './ui'

/**
 * "If all the waste had gone to the dump, how much did we keep out of it?" The total is an estimate (people x
 * assumed kilograms per person per day), so the card says so.
 *
 * @param scope   'household' | 'ward' | 'city': picks the wording
 * @param percent share kept out of the dump, 0 to 100, or null when it cannot be worked out
 */
export default function DumpShare({ scope, percent, estimatedKg, keptKg }) {
  const { t } = useTranslation()
  if (percent === null || percent === undefined || !(estimatedKg > 0)) return null
  const left = Math.max(estimatedKg - keptKg, 0)

  return (
    <Card className="space-y-3">
      <p className="text-sm text-slate-600">{t(`dump.title.${scope}`)}</p>
      <p>
        <span className="text-4xl font-bold text-leaf-700">{Number(percent).toLocaleString(undefined, { maximumFractionDigits: 1 })}%</span>
        <span className="ml-2 text-sm text-slate-600">{t('dump.keptOut')}</span>
      </p>
      <ProgressBar percent={percent} />
      <div className="grid grid-cols-2 gap-2 text-center text-xs">
        <div className="rounded-xl bg-red-50 p-2">
          <div className="text-base font-bold text-red-700">{kg(estimatedKg)}</div>
          {t('dump.without')}
        </div>
        <div className="rounded-xl bg-leaf-50 p-2">
          <div className="text-base font-bold text-leaf-700">{kg(left)}</div>
          {t('dump.with')}
        </div>
      </div>
      <p className="text-xs text-slate-500">{t('dump.assumption')}</p>
    </Card>
  )
}
