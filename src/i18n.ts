import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

// TODO: Добавить файлы переводов в public/locales/en/translation.json, public/locales/es/translation.json и т.д.
// Пример структуры translation.json:
// {
//   "title": "Guest Registration",
//   "firstName": "First Name",
//   ...
// }

i18n
  // Подключаем backend для загрузки переводов
  .use(Backend)
  // Подключаем детектор языка браузера
  .use(LanguageDetector)
  // Передаем i18n инстанс в react-i18next
  .use(initReactI18next)
  // Инициализация i18next
  .init({
    // Опции инициализации
    debug: import.meta.env.DEV,
    fallbackLng: 'en', // Язык по умолчанию
    // Указываем, какие пространства имен использовать (если есть)
    // ns: ['translation'],
    // defaultNS: 'translation',

    interpolation: {
      escapeValue: false, // React сам защищает от XSS
    },

    // Опции детектора языка
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },

    // Опции http backend
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json', // Стандартный путь
    },

    // Опции react-i18next
    react: {
      useSuspense: false, // Можно установить true, если используете Suspense для загрузки переводов
    },

    // supportedLngs больше не используется напрямую в init, 
    // i18next определит их из доступных файлов в /locales/
    // или можно передать их в LanguageDetector, если нужно
  });

export default i18n; 