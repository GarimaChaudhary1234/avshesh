import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, ErrorText, Loading } from '../components/ui'
import { api } from '../lib/api'
import { dateTime } from '../lib/format'
import { useLoad } from '../lib/useLoad'

export default function Notifications() {
  const { t } = useTranslation()
  const load = useCallback(() => api.notifications(), [])
  const { data, error, loading, reload } = useLoad(load)

  const markRead = () => api.markNotificationsRead().then(reload)

  if (loading) return <Loading />
  if (error) return <ErrorText error={error} />

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-leaf-700">{t('notif.title')}</h1>
        {data.unread > 0 && (
          <Button variant="ghost" onClick={markRead}>{t('notif.markRead')}</Button>
        )}
      </div>
      {data.items.length === 0 && <Card><p className="text-sm text-slate-600">{t('notif.empty')}</p></Card>}
      {data.items.map((n) => (
        <Card key={n.id} className={n.read ? '' : 'ring-2 ring-leaf-300'}>
          <p className="text-sm">{n.message}</p>
          <p className="mt-1 text-xs text-slate-500">{dateTime(n.createdAt)}</p>
        </Card>
      ))}
    </div>
  )
}
