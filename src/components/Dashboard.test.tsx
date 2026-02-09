import { describe, it, expect, beforeAll, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Dashboard } from './Dashboard'
import type { Session } from '@/types'

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}))

// Setup window.scrollTo mock to avoid jsdom errors
beforeAll(() => {
    Object.defineProperty(window, 'scrollTo', {
        value: () => { },
        writable: true
    })
})

describe('Dashboard Component', () => {
    const mockSessions: Session[] = [
        {
            id: '1',
            courseId: 'c1',
            courseName: 'Math 101',
            date: '2023-01-01',
            attendance: { status: 'present' }
        },
        {
            id: '2',
            courseId: 'c1',
            courseName: 'Math 101',
            date: '2023-01-08',
            attendance: { status: 'absent', reason: 'other' } // Eligible for makeup
        },
        {
            id: '3',
            courseId: 'c1',
            courseName: 'Math 101',
            date: '2023-01-15',
            attendance: { status: 'absent', reason: 'personal' } // Counting towards subscription usage
        },
        {
            id: '4',
            courseId: 'c1',
            courseName: 'Math 101',
            date: '2023-01-22',
            // Pending
        },
        {
            id: '5',
            courseId: 'c1',
            courseName: 'Math 101',
            date: '2023-01-25',
            isReplacement: true,
            attendance: { status: 'present' }
        },
        {
            id: '6',
            courseId: 'c1',
            courseName: 'Math 101',
            date: '2023-01-29',
            isReplacement: true,
            // Pending replacement
        }
    ]

    it('renders "No data" message when sessions list is empty', () => {
        render(<Dashboard sessions={[]} />)
        expect(screen.getByText('common.no_data_to_display')).toBeInTheDocument()
    })

    it('groups sessions by course name', () => {
        render(<Dashboard sessions={mockSessions} />)
        expect(screen.getByText('Math 101')).toBeInTheDocument()
    })

    it('calculates total sessions correctly (regular + replacements)', () => {
        render(<Dashboard sessions={mockSessions} />)
        // Total sessions in the group is 6.
        // Regulars = 4 (ids 1,2,3,4). Replacements = 2 (ids 5,6).
        // Display format: "{regularCount} (+{replacementsCount})"
        // Should see "4" and "(+2)"

        // We can just search for the text "4" and "(+2)"
        expect(screen.getByText('4')).toBeInTheDocument()
        expect(screen.getByText('(+2)')).toBeInTheDocument()
    })

    it('calculates pending sessions correctly', () => {
        render(<Dashboard sessions={mockSessions} />)
        // Pending total: id 4 (regular) and id 6 (replacement)
        // Regular pending: 1, Replacement pending: 1
        // Display: "1 (+1)"

        expect(screen.getAllByText('(+1)')).toHaveLength(1) // Only one pending replacement
    })

    it('calculates attended sessions correctly', () => {
        render(<Dashboard sessions={mockSessions} />)
        // Present: id 1 (reg), id 5 (rep). Total 2.
        // Card "dashboard.attended"

        expect(screen.getByText('dashboard.attended').parentElement?.parentElement).toHaveTextContent('2')
    })

    it('calculates subscription usage correctly', () => {
        render(<Dashboard sessions={mockSessions} />)
        // Used = Present (2) + Personal Absences (1 [id 3]) = 3

        const usedLabel = screen.getByText('dashboard.used_in_subscription')
        expect(usedLabel.parentElement?.parentElement).toHaveTextContent('3')
    })

    it('calculates makeup eligibility correctly', () => {
        render(<Dashboard sessions={mockSessions} />)
        // Makeups = 1 (id 2).
        // Plus replacements count displayed in parens: "(2)"
        // Expect "1 (2)"

        const makeupLabel = screen.getByText('dashboard.entitled_for_replacement')
        const card = makeupLabel.parentElement?.parentElement
        expect(card).toHaveTextContent('1')
        expect(card).toHaveTextContent('(2)')
    })
})
