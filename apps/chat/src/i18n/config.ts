import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';

const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur']);

const applyDocumentDirection = (lang: string) => {
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
applyDocumentDirection(i18n.language ?? 'en');

export default i18n;
