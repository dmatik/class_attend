import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AttendanceCard } from './AttendanceCard'
import type { Session } from '@/types'

// Mock icons to avoid rendering issues if any (though usually fine with shallow rendering or jsdom)
// But lucide-react should be fine.

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

    it('Test Case 1: Renders correctly with the class name and initial status', () => {
        render(<AttendanceCard {...defaultProps} />)

        // Check course name
        expect(screen.getByText('Test Course')).toBeInTheDocument()

        // Check initial status (Present)
        // usage of "הייתי" button should have specific class/style or we can check the icon container bg
        const presentBtn = screen.getByRole('button', { name: /הייתי/i })
        expect(presentBtn).toHaveClass('bg-emerald-50') // Active state class

        const absentBtn = screen.getByRole('button', { name: /חסרתי/i })
        expect(absentBtn).toHaveClass('bg-muted/50') // Inactive state
    })

    it('Test Case 2: Toggling status to Absent', async () => {
        const user = userEvent.setup()
        render(<AttendanceCard {...defaultProps} />)

        const absentBtn = screen.getByRole('button', { name: /חסרתי/i })

        await user.click(absentBtn)

        // onUpdate should be called with status: 'absent'
        expect(mockOnUpdate).toHaveBeenCalledWith('1', expect.objectContaining({
            status: 'absent',
            reason: undefined
        }))

        // Wait for reason select to appear (it's in AnimatePresence/motion.div)
        await waitFor(() => {
            expect(screen.getByText('סיבת היעדרות')).toBeInTheDocument()
        })

        // Check input/select is visible
        expect(screen.getByRole('combobox')).toBeInTheDocument() // Select trigger
    })

    it('Test Case 3: Toggling back to Present', async () => {
        const user = userEvent.setup()

        // Start with absent state
        const absentSession: Session = {
            ...mockSession,
            attendance: { status: 'absent', reason: 'personal' }
        }

        render(<AttendanceCard {...defaultProps} session={absentSession} />)

        // Form should be visible initially
        expect(screen.getByText('סיבת היעדרות')).toBeInTheDocument()

        // Click Present
        const presentBtn = screen.getByRole('button', { name: /הייתי/i })
        await user.click(presentBtn)

        // onUpdate called
        expect(mockOnUpdate).toHaveBeenCalledWith('1', expect.objectContaining({
            status: 'present'
        }))

        // Form should disappear
        await waitFor(() => {
            expect(screen.queryByText('סיבת היעדרות')).not.toBeInTheDocument()
        })
    })
})
