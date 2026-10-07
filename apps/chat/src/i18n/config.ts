import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';

const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur']);

/*
 * `i18n.language` is the detected language (e.g. the browser's `uk`) even when
 * no resources exist for it and the UI falls back to English. `<html lang/dir>`
 * must describe the text actually rendered, so use the resolved language.
 */
const applyDocumentDirection = () => {
  const lang = i18n.resolvedLanguage ?? 'en';
  const base = lang.split('-')[0];
  document.documentElement.lang = lang;
  document.documentElement.dir = RTL_LANGUAGES.has(base) ? 'rtl' : 'ltr';
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

i18n.on('languageChanged', applyDocumentDirection);
applyDocumentDirection();
