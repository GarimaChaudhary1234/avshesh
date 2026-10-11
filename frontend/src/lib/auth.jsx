import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import i18n from '../i18n'
import { api, session } from './api'

const AuthContext = createContext(null)

export const ROLE_ICON = {
  HOUSEHOLD: '🏠',
  KABADIWALA: '🛺',
  COMPOST: '🌱',
  MUNICIPAL: '🏛️',
  FIELD_STAFF: '🧹',
}

/** "🏠 Household" in the current language. `t` comes from useTranslation(). */
export const roleLabel = (t, role) => `${ROLE_ICON[role] ?? ''} ${t(`role.${role}`)}`.trim()

export const isCollector = (user) => user?.role === 'KABADIWALA' || user?.role === 'COMPOST'

const chosenOnThisDevice = () => {
  try {
    return Boolean(localStorage.getItem('avshesh.lang'))
  } catch {
    return false
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => session.loadUser())

  const adopt = useCallback((next) => {
    session.saveUser(next)
    setUser(next)
    if (next.language && next.language !== i18n.language) {
      if (chosenOnThisDevice()) {
        // The language picked on this device (even before logging in) wins, and the account follows it.
        api.setLanguage(i18n.language).then((updated) => { session.saveUser(updated); setUser(updated) }).catch(() => {})
      } else {
        // A new device: the account's language is the best guess.
        i18n.changeLanguage(next.language)
      }
    }
    return next
  }, [])

  // The browser may hold a user whose cookie has expired: ask the server, which also refreshes the profile.
  useEffect(() => {
    if (session.loadUser()) {
      api.me().then(adopt).catch(() => {})
    }
  }, [adopt])

  const value = useMemo(
    () => ({
      user,
      login: async (phone, password) => adopt((await api.login(phone, password)).user),
      register: async (body) => adopt((await api.register({ ...body, language: i18n.language })).user),
      refresh: async () => adopt(await api.me()),
      logout: async () => {
        await api.logout().catch(() => {})
        session.clear()
        setUser(null)
      },
      setLanguage: async (code) => {
        await i18n.changeLanguage(code)
        if (session.loadUser()) adopt(await api.setLanguage(code).catch(() => session.loadUser()))
      },
    }),
    [user, adopt],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
