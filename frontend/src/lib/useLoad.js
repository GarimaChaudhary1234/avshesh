import { useCallback, useEffect, useState } from 'react'

/**
 * Runs an async loader on mount and exposes {data, error, loading, reload}.
 * `loading` is only true until the first result: a reload keeps showing the old data, so components
 * on screen are not unmounted (and do not lose their state) while fresh data arrives.
 */
export function useLoad(loader) {
  const [state, setState] = useState({ data: null, error: null, loading: true })

  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: s.data === null, error: null }))
    return loader()
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => setState({ data: null, error, loading: false }))
  }, [loader])

  useEffect(() => {
    reload()
  }, [reload])

  return { ...state, reload }
}
