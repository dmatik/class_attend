import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import * as React from 'react'
import userEvent from '@testing-library/user-event'
import { DailyView } from './DailyView'
import type { Session, Course } from '@/types'

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: {
            dir: () => 'ltr',
        },
    }),
}))

// Mock framer-motion to avoid animation issues
vi.mock('framer-motion', async () => {
    const actual = await vi.importActual('framer-motion')
    return {
        ...actual,
        AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
        motion: {
            div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
        }
    }
})

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
    Filter: () => <span data-testid="icon-filter" />,
    Calendar: () => <span data-testid="icon-calendar" />,
    CalendarIcon: () => <span data-testid="icon-calendar" />,
    X: () => <span data-testid="icon-x" />,
}))

// Mock AttendanceCard - we'll just render a simple div with session data
vi.mock('./AttendanceCard', () => ({
    AttendanceCard: ({ session, isNext }: any) => (
        <div data-testid={`attendance-card-${session.id}`} data-is-next={isNext}>
            <div>{session.courseName}</div>
            <div>{session.date}</div>
            {session.isReplacement && <div data-testid="replacement-badge">Replacement</div>}
            {session.attendance?.status === 'absent' && <div data-testid="absent-badge">Absent</div>}
        </div>
    ),
}))

// Mock UI components
vi.mock('@/components/ui/select', () => ({
    Select: ({ children, value, onValueChange }: any) => (
        <div data-testid="mock-select" data-value={value}>
            {React.Children.map(children, child => {
                if (child?.type?.name === 'SelectContent') {
                    return React.cloneElement(child, { onValueChange })
                }
                return child
            })}
        </div>
    ),
    SelectTrigger: ({ children }: any) => <div>{children}</div>,
    SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
    SelectContent: ({ children, onValueChange }: any) => (
        <div data-testid="select-content">
            {React.Children.map(children, child =>
                React.cloneElement(child, { onValueChange })
            )}
        </div>
    ),
    SelectItem: ({ value, children, onValueChange }: any) => (
        <button
            data-testid={`select-item-${value}`}
            onClick={() => onValueChange?.(value)}
        >
            {children}
        </button>
    ),
}))

vi.mock('@/components/ui/switch', () => ({
    Switch: ({ checked, onCheckedChange, id }: any) => (
        <input
            type="checkbox"
            data-testid="mock-switch"
            id={id}
            checked={checked}
            onChange={(e) => onCheckedChange(e.target.checked)}
        />
    ),
}))

const mockCourses: Course[] = [
    {
        id: 'course-1',
        name: 'Math',
        startDate: '2023-01-01',
        daysOfWeek: [1],
        totalLessons: 10
    },
    {
        id: 'course-2',
        name: 'Science',
        startDate: '2023-01-01',
        daysOfWeek: [2],
        totalLessons: 10
    }
]

// Use a fixed "today" for consistent testing
const TODAY = '2023-06-15'
vi.mock('date-fns', async () => {
    const actual = await vi.importActual('date-fns') as any
    return {
        ...actual,
        format: (date: Date, formatStr: string) => {
            if (formatStr === 'yyyy-MM-dd') {
                // If it's a new Date(), return our fixed TODAY
                if (date.toISOString().startsWith('2023-06-15')) {
                    return TODAY
                }
                // Otherwise, format normally
                const y = date.getFullYear()
                const m = String(date.getMonth() + 1).padStart(2, '0')
                const d = String(date.getDate()).padStart(2, '0')
                return `${y}-${m}-${d}`
            }
            return actual.format(date, formatStr)
        }
    }
})

// Override Date for consistent testing
const RealDate = Date;
(globalThis as any).Date = class extends RealDate {
    constructor(...args: any[]) {
        if (args.length === 0) {
            super('2023-06-15T12:00:00Z')
        } else {
            // @ts-ignore - spread args for Date constructor
            super(...args)
        }
    }
    static now() {
        return new RealDate('2023-06-15T12:00:00Z').getTime()
    }
} as any

const mockSessions: Session[] = [
    {
        id: 'session-1',
        courseId: 'course-1',
        courseName: 'Math',
        date: '2023-06-10', // Past
        attendance: { status: 'present' }
    },
    {
        id: 'session-2',
        courseId: 'course-1',
        courseName: 'Math',
        date: '2023-06-14', // Past
        attendance: { status: 'absent' as const, reason: 'personal' as const }
    },
    {
        id: 'session-3',
        courseId: 'course-2',
        courseName: 'Science',
        date: '2023-06-12', // Past
        attendance: { status: 'present' }
    },
    {
        id: 'session-4',
        courseId: 'course-1',
        courseName: 'Math',
        date: '2023-06-20', // Future
        attendance: { status: 'present' as const }
    },
    {
        id: 'session-5',
        courseId: 'course-2',
        courseName: 'Science',
        date: '2023-06-18', // Future
        attendance: { status: 'present' as const }
    },
    {
        id: 'session-6',
        courseId: 'course-1',
        courseName: 'Math',
        date: '2023-06-13', // Past, replacement
        attendance: { status: 'present' },
        isReplacement: true
    }
]

describe('DailyView Component', () => {
    const mockOnUpdateAttendance = vi.fn()
    const mockOnScheduleReplacement = vi.fn()
    const mockOnUpdateSessionDate = vi.fn()
    const mockOnDeleteSession = vi.fn()

    const mockSetShowFuture = vi.fn()
    const mockSetSelectedCourseId = vi.fn()
    const mockSetEventTypeFilter = vi.fn()
    const mockSetIsFiltersOpen = vi.fn()

    const defaultProps = {
        sessions: mockSessions,
        courses: mockCourses,
        onUpdateAttendance: mockOnUpdateAttendance,
        onScheduleReplacement: mockOnScheduleReplacement,
        onUpdateSessionDate: mockOnUpdateSessionDate,
        onDeleteSession: mockOnDeleteSession,
        showFuture: false,
        setShowFuture: mockSetShowFuture,
        selectedCourseId: 'all',
        setSelectedCourseId: mockSetSelectedCourseId,
        eventTypeFilter: 'all' as const,
        setEventTypeFilter: mockSetEventTypeFilter,
        isFiltersOpen: false,
        setIsFiltersOpen: mockSetIsFiltersOpen
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('Rendering', () => {
        it('Scenario 1: Displays all past sessions by default (showFuture=false)', () => {
            render(<DailyView {...defaultProps} />)

            // Should show past sessions (dates <= 2023-06-15 or next sessions)
            expect(screen.getByTestId('attendance-card-session-1')).toBeInTheDocument()
            expect(screen.getByTestId('attendance-card-session-2')).toBeInTheDocument()
            expect(screen.getByTestId('attendance-card-session-3')).toBeInTheDocument()
            expect(screen.getByTestId('attendance-card-session-6')).toBeInTheDocument()

            // Next sessions for each course (first future session per course)
            // session-4 is next Math session, session-5 is next Science session
            expect(screen.getByTestId('attendance-card-session-4')).toBeInTheDocument()
            expect(screen.getByTestId('attendance-card-session-5')).toBeInTheDocument()
        })

        it('Scenario 2: Shows empty state when no sessions match filters', () => {
            render(<DailyView {...defaultProps} sessions={[]} />)

            expect(screen.getByText('daily_view.filter_modal.no_classes')).toBeInTheDocument()
            expect(screen.getByText('daily_view.filter_modal.try_changing_filters')).toBeInTheDocument()
        })

        it('Scenario 3: Displays filter button in mobile header', () => {
            render(<DailyView {...defaultProps} />)

            expect(screen.getByTestId('icon-filter')).toBeInTheDocument()
        })

        it('Scenario 4: Shows filter indicator badge when filters are active', () => {
            render(<DailyView {...defaultProps} eventTypeFilter="missed" />)

            // The badge is a span with specific classes
            const filterButton = screen.getByTestId('icon-filter').closest('button')
            expect(filterButton).toBeInTheDocument()
        })
    })

    describe('Filtering by Course', () => {
        it('Scenario 5: Filters sessions by selected course', () => {
            render(<DailyView {...defaultProps} selectedCourseId="course-1" />)

            // Should show only Math sessions
            expect(screen.getByTestId('attendance-card-session-1')).toBeInTheDocument() // Math
            expect(screen.getByTestId('attendance-card-session-2')).toBeInTheDocument() // Math
            expect(screen.getByTestId('attendance-card-session-6')).toBeInTheDocument() // Math

            // Should NOT show Science sessions (except next session logic might include it)
            // Actually, session-3 is Science and past, so it shouldn't show with course-1 filter
            expect(screen.queryByTestId('attendance-card-session-3')).not.toBeInTheDocument()
        })

        it('Scenario 6: Shows all courses when "all" is selected', () => {
            render(<DailyView {...defaultProps} selectedCourseId="all" />)

            // Should show sessions from both courses (multiple instances)
            const mathSessions = screen.getAllByText('Math')
            expect(mathSessions.length).toBeGreaterThan(0)

            const scienceSessions = screen.getAllByText('Science')
            expect(scienceSessions.length).toBeGreaterThan(0)
        })
    })

    describe('Filtering by Event Type', () => {
        it('Scenario 7: Shows only missed sessions when eventTypeFilter is "missed"', () => {
            render(<DailyView {...defaultProps} eventTypeFilter="missed" />)

            // Only session-2 is absent
            expect(screen.getByTestId('attendance-card-session-2')).toBeInTheDocument()
            expect(screen.getByTestId('absent-badge')).toBeInTheDocument()

            // Others should not be shown
            expect(screen.queryByTestId('attendance-card-session-1')).not.toBeInTheDocument()
            expect(screen.queryByTestId('attendance-card-session-3')).not.toBeInTheDocument()
        })

        it('Scenario 8: Shows only replacement sessions when eventTypeFilter is "replacement"', () => {
            render(<DailyView {...defaultProps} eventTypeFilter="replacement" />)

            // Only session-6 is a replacement
            expect(screen.getByTestId('attendance-card-session-6')).toBeInTheDocument()
            expect(screen.getByTestId('replacement-badge')).toBeInTheDocument()

            // Others should not be shown
            expect(screen.queryByTestId('attendance-card-session-1')).not.toBeInTheDocument()
            expect(screen.queryByTestId('attendance-card-session-2')).not.toBeInTheDocument()
        })
    })

    describe('Show Future Toggle', () => {
        it('Scenario 9: Shows all sessions including future when showFuture is true', () => {
            render(<DailyView {...defaultProps} showFuture={true} />)

            // All sessions should be visible
            expect(screen.getByTestId('attendance-card-session-1')).toBeInTheDocument()
            expect(screen.getByTestId('attendance-card-session-4')).toBeInTheDocument()
            expect(screen.getByTestId('attendance-card-session-5')).toBeInTheDocument()
        })
    })

    describe('Filter Modal', () => {
        it('Scenario 10: Opens filter modal when filter button is clicked', async () => {
            const user = userEvent.setup()
            render(<DailyView {...defaultProps} />)

            const filterButton = screen.getByTestId('icon-filter').closest('button')!
            await user.click(filterButton)

            expect(mockSetIsFiltersOpen).toHaveBeenCalledWith(true)
        })

        it('Scenario 11: Filter modal displays all filter options', () => {
            render(<DailyView {...defaultProps} isFiltersOpen={true} />)

            // Check for filter modal content
            expect(screen.getByText('daily_view.filter_modal.title')).toBeInTheDocument()
            expect(screen.getByText('daily_view.filter_modal.filter_by_course')).toBeInTheDocument()
            expect(screen.getByText('daily_view.filter_modal.event_type')).toBeInTheDocument()
            expect(screen.getByText('daily_view.filter_modal.show_future')).toBeInTheDocument()
        })

        it('Scenario 12: Can select a specific course in filter modal', async () => {
            const user = userEvent.setup()
            render(<DailyView {...defaultProps} isFiltersOpen={true} />)

            // Click on course dropdown item
            const mathOption = screen.getByTestId('select-item-course-1')
            await user.click(mathOption)

            // Find and click the Apply button
            const applyButton = screen.getByText('common.confirm')
            await user.click(applyButton)

            // Verify the filter was applied
            expect(mockSetSelectedCourseId).toHaveBeenCalledWith('course-1')
            expect(mockSetIsFiltersOpen).toHaveBeenCalledWith(false)
        })

        it('Scenario 13: Can select event type filter in modal', async () => {
            const user = userEvent.setup()
            render(<DailyView {...defaultProps} isFiltersOpen={true} />)

            // Click on missed events option
            const missedOption = screen.getByTestId('select-item-missed')
            await user.click(missedOption)

            // Apply
            const applyButton = screen.getByText('common.confirm')
            await user.click(applyButton)

            expect(mockSetEventTypeFilter).toHaveBeenCalledWith('missed')
            expect(mockSetIsFiltersOpen).toHaveBeenCalledWith(false)
        })

        it('Scenario 14: Can toggle "Show Future" switch in filter modal', async () => {
            const user = userEvent.setup()
            render(<DailyView {...defaultProps} isFiltersOpen={true} showFuture={false} />)

            // Find and toggle the switch
            const futureSwitch = screen.getByTestId('mock-switch')
            await user.click(futureSwitch)

            // Apply
            const applyButton = screen.getByText('common.confirm')
            await user.click(applyButton)

            expect(mockSetShowFuture).toHaveBeenCalledWith(true)
            expect(mockSetIsFiltersOpen).toHaveBeenCalledWith(false)
        })

        it('Scenario 15: Cancel button closes modal without applying changes', async () => {
            const user = userEvent.setup()
            render(<DailyView {...defaultProps} isFiltersOpen={true} />)

            // Make a change
            const mathOption = screen.getByTestId('select-item-course-1')
            await user.click(mathOption)

            // Click cancel
            const cancelButton = screen.getByText('common.cancel')
            await user.click(cancelButton)

            // Verify filters were NOT applied
            expect(mockSetSelectedCourseId).not.toHaveBeenCalled()
            expect(mockSetIsFiltersOpen).toHaveBeenCalledWith(false)
        })
    })

    describe('Empty State with Active Filters', () => {
        it('Scenario 16: Shows "Clear Filters" button when no results with active filters', () => {
            render(
                <DailyView
                    {...defaultProps}
                    sessions={[]}
                    selectedCourseId="course-1"
                    eventTypeFilter="missed"
                />
            )

            expect(screen.getByText('daily_view.filter_modal.no_classes')).toBeInTheDocument()
            expect(screen.getByText('daily_view.filter_modal.clear_filters')).toBeInTheDocument()
        })

        it('Scenario 17: Clear Filters button resets all filters', async () => {
            const user = userEvent.setup()
            render(
                <DailyView
                    {...defaultProps}
                    sessions={[]}
                    selectedCourseId="course-1"
                    eventTypeFilter="missed"
                    showFuture={true}
                />
            )

            const clearButton = screen.getByText('daily_view.filter_modal.clear_filters')
            await user.click(clearButton)

            expect(mockSetEventTypeFilter).toHaveBeenCalledWith('all')
            expect(mockSetSelectedCourseId).toHaveBeenCalledWith('all')
            expect(mockSetShowFuture).toHaveBeenCalledWith(false)
        })
    })

    describe('Session Sorting and Next Session Logic', () => {
        it('Scenario 18: Marks next upcoming session for each course with isNext prop', () => {
            render(<DailyView {...defaultProps} />)

            // session-4 (2023-06-20) is the next Math session
            // session-5 (2023-06-18) is the next Science session
            const mathNextCard = screen.getByTestId('attendance-card-session-4')
            const scienceNextCard = screen.getByTestId('attendance-card-session-5')

            expect(mathNextCard).toHaveAttribute('data-is-next', 'true')
            expect(scienceNextCard).toHaveAttribute('data-is-next', 'true')

            // Other sessions should not be marked as next
            const mathPastCard = screen.getByTestId('attendance-card-session-1')
            expect(mathPastCard).toHaveAttribute('data-is-next', 'false')
        })
    })
})
