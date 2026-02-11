import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

// Mock translations
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
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
}))

// Mock DatePicker to be a simple input for testing
vi.mock('@/components/ui/date-picker', () => ({
    DatePicker: ({ date, setDate, placeholder }: any) => (
        <input
            data-testid="mock-datepicker"
            placeholder={placeholder}
            value={date ? date.toISOString().split('T')[0] : ''}
            onChange={(e) => setDate(e.target.value ? new Date(e.target.value) : undefined)}
        />
    )
}))

// Mock window.scrollTo
Object.defineProperty(window, 'scrollTo', { value: () => { }, writable: true });

// Mock ResizeObserver
(window as any).ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
};

describe('Dashboard Integration Flow', () => {
    // Setup fetch mock
    const fetchMock = vi.fn()
    beforeAll(() => {
        (window as any).fetch = fetchMock
        vi.clearAllMocks()
    })

    it('Scenario: Full Flow - Empty State -> Add Class -> Verify Persistence', async () => {
        const user = userEvent.setup()

        // 1. Initial Load (Empty State)
        fetchMock.mockResolvedValueOnce({
            json: async () => ({ courses: [], sessions: [] }),
        })

        // Render App
        const { unmount } = render(<App />)

        // Verify "No data" message
        await waitFor(() => {
            expect(screen.getByText('common.no_data_to_display')).toBeInTheDocument()
        })

        // 2. Add Class Flow
        // Navigate to Management
        const managementTabs = screen.getAllByText('common.management')
        await user.click(managementTabs[0])

        // Check if we are on management page
        expect(await screen.findByText('management.title')).toBeInTheDocument()

        // Click Add Course
        const addBtn = screen.getByText('management.add_course_button')
        await user.click(addBtn)

        // Check if Dialog Opened
        expect(await screen.findByText('management.add_course')).toBeInTheDocument()

        // Fill Form
        // Name
        const nameInput = screen.getByLabelText(/management.course_name/i)
        await user.type(nameInput, 'Integration Class')

        // Start Date (using our mock input)
        // Use fireEvent.change to avoid intermediate invalid dates triggers by character-by-character typing in our mock
        const { fireEvent } = await import('@testing-library/react')
        const dateInputs = screen.getAllByTestId('mock-datepicker')
        const startDateInput = dateInputs[0]
        fireEvent.change(startDateInput, { target: { value: '2023-01-01' } })

        // Days of Week (Select Monday = value 1)
        const mondayBtn = screen.getByText('management.days_of_week_options.monday')
        await user.click(mondayBtn)

        // Total Lessons (Default tab is count)
        const lessonsInput = screen.getByPlaceholderText('management.total_lessons_placeholder')
        await user.type(lessonsInput, '5')

        // Click Save (Add Course)
        // Get all buttons with the add course text
        // The submit button is in the dialog
        const buttons = screen.getAllByText('management.add_course_button')
        // Click Save (Add Course)
        const saveBtn = buttons[buttons.length - 1]

        // Check if disabled - useful for debugging
        if (saveBtn.hasAttribute('disabled')) {
            console.log('Save button is disabled!')
        }
        await user.click(saveBtn)

        // Wait for Success Toast
        await waitFor(() => {
            expect(screen.getByText('management.toast.course_added_success')).toBeInTheDocument()
        }, { timeout: 3000 })

        // 3. Verify Persistence (Wait for Save API Call)
        // We must wait for the save that includes our new course.
        await waitFor(() => {
            const calls = fetchMock.mock.calls
            const saveCall = calls.find((call: any) =>
                call[0] === '/api/data' &&
                call[1] &&
                call[1].method === 'POST' &&
                call[1].body.includes('Integration Class')
            )
            expect(saveCall).toBeTruthy()
        }, { timeout: 3000 })

        // Get the saved data from the POST call
        const saveCalls = fetchMock.mock.calls.filter((call: any) => call[0] === '/api/data' && call[1] && call[1].method === 'POST')
        // We want the one with data
        const correctSave = saveCalls.find((call: any) => call[1].body.includes('Integration Class'))
        if (!correctSave) throw new Error('Save call not found')
        const savedData = JSON.parse((correctSave as any)[1].body)

        console.log('Saved Data Courses:', JSON.stringify(savedData.courses, null, 2))
        console.log('Saved Data Sessions count:', savedData.sessions?.length || 0)

        expect(savedData.courses).toHaveLength(1)
        expect(savedData.courses[0].name).toBe('Integration Class')
        // Verify sessions were generated
        expect(savedData.sessions).toBeDefined()
        expect(savedData.sessions.length).toBeGreaterThan(0)

        // Unmount to simulate reload/close
        unmount()

        // 4. Reload App with Persisted Data
        fetchMock.mockReset() // Clear previous calls/implementations
        fetchMock.mockResolvedValueOnce({
            json: async () => savedData
        })

        render(<App />)

        // Verify Dashboard Shows the Class
        // Default view is Dashboard
        // Should find "Integration Class"
        await waitFor(() => {
            expect(screen.getByText('Integration Class')).toBeInTheDocument()
        }, { timeout: 3000 })

        // The key verification is that the class persisted and appears on reload
        // This proves the full integration flow worked: Empty State -> Add Class -> Persist -> Reload -> Display
    })
})
