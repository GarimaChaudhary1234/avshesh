import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '../i18n'
import { useAuth } from '../lib/auth'

/** Picks the language of the whole app. A logged-in user's choice is also saved on their account (SMS use it). */
export default function LanguageSwitcher({ className = '' }) {
  const { t, i18n } = useTranslation()
  const { setLanguage } = useAuth()

  return (
    <select
      aria-label={t('language.label')}
      value={i18n.language}
      onChange={(e) => setLanguage(e.target.value)}
      className={`rounded-lg border border-white/30 bg-transparent px-2 py-1 text-sm ${className}`}
    >
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code} className="text-slate-900">
          {l.label}
        </option>
      ))}
    </select>
  )
}
