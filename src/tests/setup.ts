import '@testing-library/jest-dom'
import { vi } from 'vitest'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            if (key === 'common.date_format') return 'yyyy-MM-dd'; // Return a safe format string for tests
            return key;
        },
        i18n: {
            changeLanguage: () => new Promise(() => { }),
            language: 'en',
            dir: () => 'ltr',
        },
    }),
    initReactI18next: {
        type: '3rdParty',
        init: () => { },
    }
}))
