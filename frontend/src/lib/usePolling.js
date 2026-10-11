import { useEffect } from 'react'

/**
 * Calls `refresh` every `ms` milliseconds while the tab is visible, and once when the tab comes back into view.
 * Near-real-time by polling: a pool changes only when a household lists, so a few seconds of delay is fine.
 */
export function usePolling(refresh, ms = 10000) {
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    const timer = setInterval(tick, ms)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [refresh, ms])
}
