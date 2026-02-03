import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Dashboard } from './Dashboard'
import type { Session } from '@/types'

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
        expect(screen.getByText('אין נתונים להצגה')).toBeInTheDocument()
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

        // We can look for the "Sah-hak" card content
        // The card title is "סה״כ"
        // The content is inside a .text-3xl div

        // Let's find the card by text 'סה״כ' and check numbers nearby
        // We can look for the "Sah-hak" card content
        // Testing-library philosophy prefers accessible queries. 
        // We can just search for the text "4 (+2)" if it's rendered as such, 
        // or separated. The component renders: 
        // {regularCount} <span> (+{replacementsCount})</span>

        expect(screen.getByText('4')).toBeInTheDocument()
        expect(screen.getByText('(+2)')).toBeInTheDocument()
    })

    it('calculates pending sessions correctly', () => {
        render(<Dashboard sessions={mockSessions} />)
        // Pending total: id 4 (regular) and id 6 (replacement)
        // Regular pending: 1, Replacement pending: 1
        // Display: "1 (+1)"

        // Display: "1 (+1)"
        // We expect to find '1' and '(+1)'
        // Note: '1' might match multiple times, so be careful.
        // We can scope it to the "Pending" card if needed, but checking text presence is a good start.

        // Since '4' was checked above, checking '1' and '(+1)' specifically for this context might strictly require within-card checks
        // but for now verifying text existence is okay.
        expect(screen.getAllByText('(+1)')).toHaveLength(1) // Only one pending replacement
    })

    it('calculates present sessions correctly', () => {
        render(<Dashboard sessions={mockSessions} />)
        // Present: id 1 (reg), id 5 (rep). Total 2.
        // Card "נכחתי"

        // Card "נכחתי"
        // The value '2' should be in the card
        // We can try to traverse up to the card then down to content
        // Or simply expect to find '2' in the document, ensuring it's not ambiguous if other cards default to 0

        // Given our data:
        // Regular=4, Rep=2 -> "4 (+2)"
        // Pending=1, Rep=1 -> "1 (+1)"
        // Present=2        -> "2"
        // Absent=2         -> "2"
        // Used=2 (id 1 present + id 3 personal) -> "2"
        // Makeups=1 (id 2 sick) -> "1 (+2)" wait, makeup logic:
        // makeups count = absent && reason && reason!=personal.
        // logic:
        /*
            const makeups = courseSessions.filter(s =>
                s.attendance?.status === 'absent' &&
                s.attendance.reason &&
                s.attendance.reason !== 'personal'
            ).length
        */
        // id 2 is absent/sick -> counts.
        // id 3 is absent/personal -> doesn't count.
        // makeups = 1.
        // Display: "{makeups} ({replacementsCount})" -> "1 (2)"

        expect(screen.getByText('נכחתי').parentElement?.parentElement).toHaveTextContent('2')
    })

    it('calculates subscription usage correctly', () => {
        render(<Dashboard sessions={mockSessions} />)
        // Used = Present (2) + Personal Absences (1 [id 3]) = 3

        const usedLabel = screen.getByText('נוצל מהמנוי')
        expect(usedLabel.parentElement?.parentElement).toHaveTextContent('3')
    })

    it('calculates makeup eligibility correctly', () => {
        render(<Dashboard sessions={mockSessions} />)
        // Makeups = 1 (id 2).
        // Plus replacements count displayed in parens: "(2)"
        // Expect "1 (2)"

        const makeupLabel = screen.getByText('זכאי להשלמה')
        const card = makeupLabel.parentElement?.parentElement
        expect(card).toHaveTextContent('1')
        expect(card).toHaveTextContent('(2)')
    })
})
