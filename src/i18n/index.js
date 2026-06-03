import { createI18n } from 'vue-i18n'
import he from './he'
import en from './en'

const savedLocale = localStorage.getItem('teamrush_locale') || 'he'

export const i18n = createI18n({
  legacy: false,
  locale: savedLocale,
  fallbackLocale: 'he',
  messages: { he, en },
})

export const setLocale = (locale) => {
  i18n.global.locale.value = locale
  localStorage.setItem('teamrush_locale', locale)
  document.documentElement.lang = locale
  document.documentElement.dir = locale === 'he' ? 'rtl' : 'ltr'
}

// Apply initial locale settings
document.documentElement.lang = savedLocale
document.documentElement.dir = savedLocale === 'he' ? 'rtl' : 'ltr'
