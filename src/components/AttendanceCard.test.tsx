import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AttendanceCard } from './AttendanceCard'
import type { Session } from '@/types'

// Mock UI components to simplify testing logic and avoid Radix UI portal issues
vi.mock('@/components/ui/select', () => ({
    Select: ({ children, onValueChange, value }: any) => (
        <select
            data-testid="mock-select"
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
        >
            {children}
        </select>
    ),
    SelectTrigger: ({ children }: any) => <div>{children}</div>,
    SelectValue: () => null,
    SelectContent: ({ children }: any) => <>{children}</>,
    SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}))

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', async () => {
    const actual = await vi.importActual('framer-motion')
    return {
        ...actual,
        AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
        motion: {
            div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
            button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
        }
    }
})

// Mock icons
vi.mock('lucide-react', () => ({
    Check: () => <span data-testid="icon-check" />,
    X: () => <span data-testid="icon-x" />,
    Calendar: () => <span data-testid="icon-calendar" />,
    Trash2: () => <span data-testid="icon-trash" />,
    ChevronDown: () => <span />,
    ChevronUp: () => <span />,
    ChevronLeft: () => <span />,
    ChevronRight: () => <span />,
}))

const mockSession: Session = {
    id: '1',
    courseId: 'c1',
    courseName: 'Test Course',
    date: '2023-10-10',
    attendance: {
        status: 'present'
    }
}

const mockSessions: Session[] = [mockSession]

describe('AttendanceCard', () => {
    const mockOnUpdate = vi.fn()
    const mockOnSchedule = vi.fn()
    const mockOnUpdateDate = vi.fn()
    const mockOnDelete = vi.fn()

    const defaultProps = {
        session: mockSession,
        sessions: mockSessions,
        onUpdate: mockOnUpdate,
        onScheduleReplacement: mockOnSchedule,
        onUpdateSessionDate: mockOnUpdateDate,
        onDeleteSession: mockOnDelete
    }

    it('Scenario 1: Render State - Verifies class name and date are correct', () => {
        render(<AttendanceCard {...defaultProps} />)

        // Verify Class Name
        expect(screen.getByText('Test Course')).toBeInTheDocument()

        // Verify Date
        // Based on setup.ts mock, t('common.date_format') returns 'yyyy-MM-dd'
        // So 2023-10-10 should be rendered as "2023-10-10"
        expect(screen.getByText('2023-10-10')).toBeInTheDocument()

        // Verify initial status (Present)
        const presentBtn = screen.getByRole('button', { name: 'attendance_card.i_was_there' })
        expect(presentBtn).toHaveClass('bg-emerald-50')
    })

    it('Scenario 2: Interaction (Happy Path) - Toggle Absent and verify Reason Form appears', async () => {
        const user = userEvent.setup()
        render(<AttendanceCard {...defaultProps} />)

        const absentBtn = screen.getByRole('button', { name: 'attendance_card.i_was_absent' })

        // Click Absent
        await user.click(absentBtn)

        // Verify onUpdate called with absent
        expect(mockOnUpdate).toHaveBeenCalledWith('1', expect.objectContaining({
            status: 'absent',
            reason: undefined
        }))

        // Verify Reason Form appears (waiting for animation)
        await waitFor(() => {
            expect(screen.getByText('common.reason')).toBeVisible()
        })
        expect(screen.getByText('attendance_card.details_label')).toBeVisible()
    })

    it('Scenario 3: Interaction (Form Fill) - Select reason and type in text area', async () => {
        const user = userEvent.setup()
        render(<AttendanceCard {...defaultProps} />)

        // 1. Click Absent
        await user.click(screen.getByRole('button', { name: 'attendance_card.i_was_absent' }))

        // Wait for form
        await waitFor(() => expect(screen.getByTestId('mock-select')).toBeVisible())

        // 2. Select "Reason" (Personal) using the mocked select
        const select = screen.getByTestId('mock-select')
        await user.selectOptions(select, 'personal')

        // Verify onUpdate called with reason
        expect(mockOnUpdate).toHaveBeenCalledWith('1', expect.objectContaining({
            status: 'absent',
            reason: 'personal' // 'value' from REASONS array
        }))

        // Verify local state update
        expect(select).toHaveValue('personal')

        // 3. Type in Textarea
        const textarea = screen.getByPlaceholderText('attendance_card.details_placeholder')
        await user.type(textarea, 'My extra details')

        // Verify onUpdate called with details
        expect(mockOnUpdate).toHaveBeenCalledWith('1', expect.objectContaining({
            status: 'absent',
            details: 'My extra details'
        }))

        // Verify value in textarea
        expect(textarea).toHaveValue('My extra details')
    })

    it('Scenario 4: Interaction (Toggle Back) - Click Present and verify Reason Form disappears', async () => {
        const user = userEvent.setup()
        const absentSession: Session = {
            ...mockSession,
            attendance: { status: 'absent', reason: 'personal' }
        }

        render(<AttendanceCard {...defaultProps} session={absentSession} />)

        // Verify Form is initially visible
        expect(screen.getByText('common.reason')).toBeVisible()

        // Click Present
        const presentBtn = screen.getByRole('button', { name: 'attendance_card.i_was_there' })
        await user.click(presentBtn)

        // Verify onUpdate
        expect(mockOnUpdate).toHaveBeenCalledWith('1', expect.objectContaining({
            status: 'present'
        }))

        // Verify Form disappears
        await waitFor(() => {
            expect(screen.queryByText('common.reason')).not.toBeInTheDocument()
        })
    })

    it('Scenario 5: Accessibility - Ensure buttons can be found by accessible roles', () => {
        render(<AttendanceCard {...defaultProps} />)

        // Present Button
        expect(screen.getByRole('button', { name: 'attendance_card.i_was_there' })).toBeInTheDocument()

        // Absent Button
        expect(screen.getByRole('button', { name: 'attendance_card.i_was_absent' })).toBeInTheDocument()

        // Date Picker (it's a button)
        // Note: The DatePicker button usually has the date text as its accessible name if date is selected
        expect(screen.getByRole('button', { name: '2023-10-10' })).toBeInTheDocument()
    })
})
