import '@testing-library/jest-dom'
import { vi } from 'vitest'

// 1. Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
})

// 2. Mock ResizeObserver
window.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
}

// 3. Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            if (key === 'common.date_format') return 'yyyy-MM-dd'
            return key
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
    },
    // Mock Trans component if used
    Trans: ({ children }: { children: unknown }) => children,
}))

// 4. Mock next-themes
vi.mock('next-themes', () => ({
    useTheme: () => ({
        theme: 'light',
        setTheme: vi.fn(),
    }),
    ThemeProvider: ({ children }: { children: unknown }) => children,
}))
