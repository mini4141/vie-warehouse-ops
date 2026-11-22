import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import ja from './ja.json'

// Locale detection: localStorage -> browser -> en.
function detect(): 'en' | 'ja' {
  try {
    const stored = localStorage.getItem('woc.lang')
    if (stored === 'en' || stored === 'ja') return stored
  } catch {
    /* ignore */
  }
  return navigator.language.toLowerCase().startsWith('ja') ? 'ja' : 'en'
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ja: { translation: ja } },
  lng: detect(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export function setLanguage(lang: 'en' | 'ja') {
  try {
    localStorage.setItem('woc.lang', lang)
  } catch {
    /* ignore */
  }
  document.documentElement.lang = lang
  void i18n.changeLanguage(lang)
}

export default i18n
