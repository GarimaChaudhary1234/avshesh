import { useTranslation } from 'react-i18next'
import { dateTime } from '../lib/format'

/** What officers did, newest first. Each entry is a code from the server turned into a sentence here. */
export default function ActivityFeed({ entries }) {
  const { t } = useTranslation()
  if (!entries || entries.length === 0) return <p className="text-sm text-slate-600">{t('activity.empty')}</p>
  return (
    <ul className="space-y-2">
      {entries.map((a) => (
        <li key={a.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
          <p>{t(`activity.${a.code}`, { actor: a.actorName, detail: a.detail ?? '', defaultValue: `${a.actorName}: ${a.code} ${a.detail ?? ''}` })}</p>
          <p className="text-xs text-slate-500">{dateTime(a.at)}</p>
        </li>
      ))}
    </ul>
  )
}
