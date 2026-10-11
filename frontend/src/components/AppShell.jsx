import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { api } from '../lib/api'
import { roleLabel, useAuth } from '../lib/auth'
import LanguageSwitcher from './LanguageSwitcher'
import OfflineBanner from './OfflineBanner'

const TABS = {
  HOUSEHOLD: [
    { to: '/', label: 'nav.home', icon: '🏠', end: true },
    { to: '/scan', label: 'nav.scan', icon: '📸' },
    { to: '/listings', label: 'nav.myListings', icon: '📝' },
    { to: '/impact', label: 'nav.impact', icon: '📊' },
  ],
  COLLECTOR: [
    { to: '/', label: 'nav.pools', icon: '🏘️', end: true },
    { to: '/pickups', label: 'nav.pickups', icon: '🛺' },
    { to: '/earnings', label: 'nav.earnings', icon: '💰' },
    { to: '/profile', label: 'nav.profile', icon: '👤' },
  ],
  // A ward officer runs one ward; the commissioner (no ward) looks after the whole city and the officers.
  WARD_OFFICER: [
    { to: '/', label: 'nav.overview', icon: '📊', end: true },
    { to: '/requests', label: 'nav.requests', icon: '🗑️' },
    { to: '/points', label: 'nav.dropoffs', icon: '📍' },
    { to: '/dealers', label: 'nav.dealers', icon: '🛺' },
    { to: '/staff', label: 'nav.staff', icon: '👷' },
  ],
  // A municipal collection worker has one job: the pickups assigned to them.
  FIELD_STAFF: [{ to: '/', label: 'nav.tasks', icon: '🧹', end: true }],
  COMMISSIONER: [
    { to: '/', label: 'nav.overview', icon: '🏙️', end: true },
    { to: '/wards', label: 'nav.wards', icon: '🗺️' },
    { to: '/officers', label: 'nav.officers', icon: '🧑‍💼' },
    { to: '/dealers', label: 'nav.dealers', icon: '🛺' },
  ],
}

const tabsFor = (user) => {
  if (user.role === 'HOUSEHOLD') return TABS.HOUSEHOLD
  if (user.role === 'FIELD_STAFF') return TABS.FIELD_STAFF
  if (user.role === 'MUNICIPAL') return user.wardId == null ? TABS.COMMISSIONER : TABS.WARD_OFFICER
  return TABS.COLLECTOR
}

/** "Name · Commissioner (whole city)" or "Name · Ward Officer · Ward 15 ..."; other roles keep their plain label. */
function useWhoAmI(user) {
  const { t } = useTranslation()
  const [ward, setWard] = useState(null)
  useEffect(() => {
    if ((user.role === 'MUNICIPAL' || user.role === 'FIELD_STAFF') && user.wardId != null) api.myWard().then(setWard).catch(() => {})
  }, [user.role, user.wardId])
  if (user.role === 'FIELD_STAFF') return t('city.headerStaff', { name: user.name, ward: ward?.label ?? '…' })
  if (user.role !== 'MUNICIPAL') return `${user.name} · ${roleLabel(t, user.role)}`
  if (user.wardId == null) return t('city.headerCommissioner', { name: user.name })
  return t('city.headerOfficer', { name: user.name, ward: ward?.label ?? '…' })
}

const POLL_MS = 60_000

/** Unread count for the bell. Polls once a minute; a failed poll just keeps the old number. */
function useUnreadCount() {
  const [unread, setUnread] = useState(0)
  useEffect(() => {
    let alive = true
    const poll = () =>
      api
        .notifications()
        .then((inbox) => alive && setUnread(inbox.unread))
        .catch(() => {})
    poll()
    const timer = setInterval(poll, POLL_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])
  return unread
}

export default function AppShell() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const tabs = tabsFor(user)
  const who = useWhoAmI(user)
  const unread = useUnreadCount()
  // Municipal officers mostly work at a desk: on a wide screen they get a sidebar and a wider page.
  const wide = user.role === 'MUNICIPAL'

  return (
    <div className={`mx-auto flex min-h-screen flex-col ${wide ? 'max-w-xl md:max-w-6xl' : 'max-w-xl'}`}>
      <header className="flex items-center justify-between gap-2 bg-leaf-700 px-4 py-3 text-white">
        <div className="min-w-0">
          <div className="text-lg font-bold">♻️ Avshesh</div>
          <Link to="/account" className="block truncate text-xs text-leaf-100 underline-offset-2 hover:underline">
            {who}
          </Link>
        </div>
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <Link
            to="/notifications"
            aria-label={t('nav.notifications')}
            className="relative rounded-lg px-2 py-1.5 text-lg hover:bg-white/10"
          >
            🔔
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 rounded-full bg-red-500 px-1.5 text-xs font-bold">
                {unread}
              </span>
            )}
          </Link>
          <button onClick={logout} className="rounded-lg px-3 py-1.5 text-sm hover:bg-white/10">
            {t('nav.logout')}
          </button>
        </div>
      </header>

      <OfflineBanner />
      {user.role !== 'MUNICIPAL' && user.role !== 'FIELD_STAFF' && user.wardId == null && (
        <div role="status" className="bg-earth-100 px-4 py-2 text-sm text-slate-800">
          <span>{t('location.outsideBanner')} </span>
          <Link to="/account" className="font-semibold underline">{t('location.changeNow')}</Link>
        </div>
      )}
      {!user.phoneVerified && (
        <div role="status" className="flex items-center justify-between gap-2 bg-red-50 px-4 py-2 text-sm text-red-800">
          <span>{t('verify.banner')}</span>
          <Link to="/verify" className="font-semibold underline">{t('verify.bannerAction')}</Link>
        </div>
      )}

      <div className={`flex flex-1 flex-col ${wide ? 'md:flex-row' : ''}`}>
      <main className={`flex-1 space-y-4 p-4 pb-24 ${wide ? 'md:max-w-3xl md:pb-4' : ''}`}>
        <Outlet />
      </main>

      <nav
        className={`fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white ${
          wide ? 'md:static md:order-first md:w-52 md:shrink-0 md:border-r md:border-t-0' : ''
        }`}
      >
        <ul className={`mx-auto flex ${wide ? 'max-w-xl md:max-w-none md:flex-col md:pt-2' : 'max-w-xl'}`}>
          {tabs.map((tab) => (
            <li key={tab.to} className="flex-1">
              <NavLink
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2 text-xs ${
                    wide ? 'md:flex-row md:justify-start md:gap-3 md:px-4 md:text-sm' : ''
                  } ${isActive ? 'font-semibold text-leaf-700' : 'text-slate-500'}`
                }
              >
                <span className="text-xl">{tab.icon}</span>
                {t(tab.label)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      </div>
    </div>
  )
}
