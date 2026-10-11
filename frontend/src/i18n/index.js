import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import hi from './hi.json'
import or from './or.json'

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'or', label: 'ଓଡ଼ିଆ' },
]

const STORAGE_KEY = 'avshesh.lang'
const supported = (code) => LANGUAGES.some((l) => l.code === code)

function initialLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (supported(saved)) return saved
  } catch {
    // storage can be blocked: fall through to the browser language
  }
  const browser = (navigator.language ?? 'en').slice(0, 2)
  return supported(browser) ? browser : 'en'
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, hi: { translation: hi }, or: { translation: or } },
  lng: initialLanguage(),
  fallbackLng: 'en',
  // Keys are flat strings that contain dots, such as "auth.login".
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
  returnNull: false,
  // A missing key is a bug: it is reported loudly instead of silently showing the English text.
  saveMissing: true,
  missingKeyHandler: (languages, namespace, key) => console.error(`missing i18n key: ${key}`),
})

i18n.on('languageChanged', (code) => {
  document.documentElement.lang = code
  try {
    localStorage.setItem(STORAGE_KEY, code)
  } catch {
    // ignore: the choice just is not remembered
  }
})
document.documentElement.lang = i18n.language

export default i18n
