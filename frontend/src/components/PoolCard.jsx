import { Trans, useTranslation } from 'react-i18next'
import { kg, rupee } from '../lib/format'
import { Badge, Card, ProgressBar } from './ui'

const STATUS = {
  FILLING: { tone: 'amber', label: 'pool.status.FILLING' },
  READY: { tone: 'green', label: 'pool.status.READY' },
  ACCEPTED: { tone: 'green', label: 'pool.status.ACCEPTED' },
}

/** Household's view of one Mohalla Pool: how full it is and what is still missing. */
export default function PoolCard({ pool }) {
  const { t } = useTranslation()
  const status = STATUS[pool.status] ?? STATUS.FILLING
  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold">🏘️ {pool.name}</h3>
        <Badge tone={status.tone}>{t(status.label)}</Badge>
      </div>
      <ProgressBar percent={pool.percent} />
      <p className="text-sm text-slate-700">
        <b>{t('pool.percentFull', { percent: pool.percent })}</b> ({rupee(pool.currentValue)} / {rupee(pool.target)})
      </p>
      <p className="text-sm text-slate-600">
        {pool.households === 1
          ? t('pool.joinedOne', { weight: kg(pool.totalKg) })
          : t('pool.joinedMany', { households: pool.households, weight: kg(pool.totalKg) })}
      </p>
      {pool.items?.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 text-xs" aria-label={t('pool.inside')}>
          {pool.items.map((i) => (
            <li key={i.itemCode} className="rounded-full bg-slate-100 px-2.5 py-1">
              {t(`item.${i.itemCode}.name`, { defaultValue: i.itemCode })} · {kg(i.kg)}
            </li>
          ))}
        </ul>
      )}
      {pool.status === 'FILLING' && pool.kgNeeded != null && pool.kgNeeded > 0 && (
        <p className="rounded-xl bg-earth-100 px-3 py-2 text-sm">
          <Trans i18nKey="pool.needMore" values={{ weight: kg(pool.kgNeeded) }} components={{ b: <b /> }} />
        </p>
      )}
      {pool.status === 'READY' && <p className="rounded-xl bg-leaf-50 px-3 py-2 text-sm">{t('pool.ready')}</p>}
    </Card>
  )
}
