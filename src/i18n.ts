import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import he from './locales/he.json';
import en from './locales/en.json';

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            he: { translation: he },
            en: { translation: en }
        },
        lng: 'he', // Default language as requested
        fallbackLng: 'he',
        interpolation: {
            escapeValue: false // React already safes from xss
        }
    });

// Critical: Direction Logic
i18n.on('languageChanged', (lng) => {
    if (lng === 'he') {
        document.documentElement.dir = 'rtl';
        document.documentElement.lang = 'he';
    } else {
        document.documentElement.dir = 'ltr';
        document.documentElement.lang = 'en';
    }
});

// Set initial direction
document.documentElement.dir = 'rtl';
document.documentElement.lang = 'he';

export default i18n;
