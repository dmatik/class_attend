import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LanguageSwitcher } from './LanguageSwitcher'

// Create mock i18n instance with spy functions
const mockChangeLanguage = vi.fn()
const mockDir = vi.fn()

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: {
            changeLanguage: mockChangeLanguage,
            language: 'he', // Default to Hebrew
            dir: mockDir,
        },
    }),
}))

// Mock UI components to simplify testing
vi.mock('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: ({ children, dir }: any) => <div data-testid="dropdown-menu" data-dir={dir}>{children}</div>,
    DropdownMenuTrigger: ({ children }: any) => <div data-testid="dropdown-trigger">{children}</div>,
    DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-content">{children}</div>,
    DropdownMenuItem: ({ children, onClick }: any) => (
        <button data-testid="dropdown-item" onClick={onClick}>
            {children}
        </button>
    ),
}))

vi.mock('@/components/ui/button', () => ({
    Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}))

describe('LanguageSwitcher Component', () => {
    beforeEach(() => {
        // Clear all mocks before each test
        vi.clearAllMocks()
        // Set default return value for dir()
        mockDir.mockReturnValue('rtl')
    })

    it('Scenario 1: Render - Default language is Hebrew (RTL)', () => {
        render(<LanguageSwitcher />)

        // Verify the dropdown menu is rendered with RTL direction
        const dropdownMenu = screen.getByTestId('dropdown-menu')
        expect(dropdownMenu).toBeInTheDocument()
        expect(dropdownMenu).toHaveAttribute('data-dir', 'rtl')

        // Verify the language toggle button is present (there are multiple buttons: trigger + dropdown items)
        const buttons = screen.getAllByRole('button')
        expect(buttons.length).toBeGreaterThan(0)

        // Verify sr-only text for accessibility
        expect(screen.getByText('common.toggle_language')).toBeInTheDocument()
    })

    it('Scenario 2: Switch to English - Verify i18n.changeLanguage called', async () => {
        const user = userEvent.setup()
        render(<LanguageSwitcher />)

        // Find all dropdown items (Hebrew and English)
        const dropdownItems = screen.getAllByTestId('dropdown-item')

        // The first item is Hebrew, second is English
        expect(dropdownItems).toHaveLength(2)
        expect(dropdownItems[0]).toHaveTextContent('common.hebrew')
        expect(dropdownItems[1]).toHaveTextContent('common.english')

        // Click on English option
        await user.click(dropdownItems[1])

        // Verify i18n.changeLanguage was called with 'en'
        expect(mockChangeLanguage).toHaveBeenCalledTimes(1)
        expect(mockChangeLanguage).toHaveBeenCalledWith('en')
    })

    it('Scenario 3: Switch to Hebrew - Verify i18n.changeLanguage called', async () => {
        const user = userEvent.setup()
        render(<LanguageSwitcher />)

        // Find all dropdown items
        const dropdownItems = screen.getAllByTestId('dropdown-item')

        // Click on Hebrew option
        await user.click(dropdownItems[0])

        // Verify i18n.changeLanguage was called with 'he'
        expect(mockChangeLanguage).toHaveBeenCalledTimes(1)
        expect(mockChangeLanguage).toHaveBeenCalledWith('he')
    })

    it('Scenario 4: Direction changes after language switch', async () => {
        const user = userEvent.setup()

        // Simulate that after clicking English, dir() returns 'ltr'
        mockDir.mockReturnValueOnce('rtl') // Initial render

        const { rerender } = render(<LanguageSwitcher />)

        // Initial state - RTL
        expect(screen.getByTestId('dropdown-menu')).toHaveAttribute('data-dir', 'rtl')

        // Click English
        const dropdownItems = screen.getAllByTestId('dropdown-item')
        await user.click(dropdownItems[1])

        // After language change, dir() should return 'ltr'
        mockDir.mockReturnValue('ltr')

        // Re-render to simulate the state update after language change
        rerender(<LanguageSwitcher />)

        // Verify direction changed to LTR
        await waitFor(() => {
            expect(screen.getByTestId('dropdown-menu')).toHaveAttribute('data-dir', 'ltr')
        })
    })

    it('Scenario 5: Accessibility - Button has screen reader label', () => {
        render(<LanguageSwitcher />)

        // Verify sr-only text exists for screen readers
        const srOnlyText = screen.getByText('common.toggle_language')
        expect(srOnlyText).toBeInTheDocument()
        // Note: The actual 'sr-only' class is applied by the real Button component
        // In our mock, we just verify the text is present
    })
})
