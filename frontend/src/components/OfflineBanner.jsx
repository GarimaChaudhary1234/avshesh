import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { pendingCount, subscribe, syncQueue } from '../lib/offlineQueue'

/** Tells the user when they are offline and sends saved listing drafts as soon as the network is back. */
export default function OfflineBanner() {
  const { t } = useTranslation()
  const [online, setOnline] = useState(navigator.onLine)
  const [queued, setQueued] = useState(pendingCount())
  const [note, setNote] = useState(null)

  useEffect(() => subscribe(setQueued), [])

  useEffect(() => {
    const sync = async () => {
      if (pendingCount() === 0) return
      setNote(t('offline.sending'))
      const { sent, failed } = await syncQueue()
      const parts = []
      if (sent) parts.push(t('offline.sent', { count: sent }))
      if (failed) parts.push(t('offline.failed', { count: failed }))
      setNote(parts.join(' · ') || null)
    }
    const goOnline = () => {
      setOnline(true)
      sync()
    }
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    if (navigator.onLine) sync()
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [t])

  const text = !online ? t('offline.banner') : queued > 0 ? t('offline.queued', { count: queued }) : note
  if (!text) return null
  return (
    <div role="status" className="bg-earth-100 px-4 py-2 text-center text-sm text-slate-700">
      {!online && queued > 0 ? `${text} · ${t('offline.queued', { count: queued })}` : text}
    </div>
  )
}
