import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShareCourseDialog } from './ShareCourseDialog'
import type { Course } from '@/types'

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, params?: any) => {
            if (key === 'management.sharing.title' && params?.courseName) {
                return `Sharing: ${params.courseName}`
            }
            if (key === 'management.sharing.members_count' && params?.count !== undefined) {
                return `${params.count} members`
            }
            return key
        },
        i18n: {
            dir: () => 'ltr',
        },
    }),
}))

// Mock Lucide icons
vi.mock('lucide-react', async (importOriginal) => {
    const actual: any = await importOriginal()
    return {
        ...actual,
        Users: () => <span data-testid="icon-users" />,
        UserPlus: () => <span data-testid="icon-user-plus" />,
        Trash2: () => <span data-testid="icon-trash" />,
        LogOut: () => <span data-testid="icon-logout" />,
        Loader2: () => <span data-testid="icon-loader" />,
        AlertCircle: () => <span data-testid="icon-alert" />,
        X: () => <span data-testid="icon-x" />,
    }
})

const mockCourse: Course = {
    id: 'course-1',
    name: 'Swimming Lessons',
    startDate: '2026-01-01',
    daysOfWeek: [0, 2],
    sharedWith: [
        { id: 'user-1', username: 'alice', firstName: 'Alice', lastName: 'Smith' },
        { id: 'user-2', username: 'bob', firstName: 'Bob', lastName: 'Jones' },
    ]
}

const mockSoleCourse: Course = {
    id: 'course-2',
    name: 'Piano Class',
    startDate: '2026-01-01',
    daysOfWeek: [1],
    sharedWith: [
        { id: 'user-1', username: 'alice', firstName: 'Alice', lastName: 'Smith' },
    ]
}

describe('ShareCourseDialog Component', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        global.fetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes('/api/users')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        users: [
                            { id: 'user-1', username: 'alice', firstName: 'Alice', lastName: 'Smith' },
                            { id: 'user-2', username: 'bob', firstName: 'Bob', lastName: 'Jones' },
                            { id: 'user-3', username: 'carol', firstName: 'Carol', lastName: 'Taylor' },
                        ]
                    })
                })
            }
            if (url.includes('/members')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        members: mockCourse.sharedWith
                    })
                })
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
        })
    })

    it('renders dialog title and members list', async () => {
        render(
            <ShareCourseDialog
                course={mockCourse}
                isOpen={true}
                onClose={vi.fn()}
                token="test-token"
                currentUserId="user-1"
            />
        )

        expect(screen.getByText('Sharing: Swimming Lessons')).toBeDefined()
        expect(screen.getByText('Alice Smith')).toBeDefined()
        expect(screen.getByText('Bob Jones')).toBeDefined()
        expect(screen.getByText('alice')).toBeDefined()
        expect(screen.getByText('bob')).toBeDefined()
        expect(screen.getByText('management.sharing.you')).toBeDefined()
    })

    it('enforces orphan guard: disables remove button when only 1 member remains', async () => {
        render(
            <ShareCourseDialog
                course={mockSoleCourse}
                isOpen={true}
                onClose={vi.fn()}
                token="test-token"
                currentUserId="user-1"
            />
        )

        expect(screen.getByText('management.sharing.cannot_remove_last_member')).toBeDefined()
        const removeButtons = screen.getAllByRole('button', { name: /management.sharing.leave_course|management.sharing.remove/ })
        expect(removeButtons[0]).toHaveProperty('disabled', true)
    })

    it('allows removing a member when multiple members exist', async () => {
        const onCourseUpdated = vi.fn()
        global.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
            if (opts?.method === 'DELETE') {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        success: true,
                        members: [{ id: 'user-1', username: 'alice', firstName: 'Alice', lastName: 'Smith' }]
                    })
                })
            }
            if (url.includes('/api/users')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ users: [] })
                })
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ members: mockCourse.sharedWith })
            })
        })

        const user = userEvent.setup()
        render(
            <ShareCourseDialog
                course={mockCourse}
                isOpen={true}
                onClose={vi.fn()}
                token="test-token"
                currentUserId="user-1"
                onCourseUpdated={onCourseUpdated}
            />
        )

        const removeButton = screen.getByRole('button', { name: 'management.sharing.remove' })
        expect(removeButton).toBeDefined()
        expect(removeButton).toHaveProperty('disabled', false)

        await user.click(removeButton)

        await waitFor(() => {
            expect(onCourseUpdated).toHaveBeenCalled()
        })
    })

    it('calls onLeaveCourse when current user leaves the course', async () => {
        const onLeaveCourse = vi.fn()
        const onClose = vi.fn()

        global.fetch = vi.fn().mockImplementation((_url: string, opts?: any) => {
            if (opts?.method === 'DELETE') {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ success: true, members: [] })
                })
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ members: mockCourse.sharedWith, users: [] })
            })
        })

        const user = userEvent.setup()
        render(
            <ShareCourseDialog
                course={mockCourse}
                isOpen={true}
                onClose={onClose}
                token="test-token"
                currentUserId="user-1"
                onLeaveCourse={onLeaveCourse}
            />
        )

        const leaveButton = screen.getByRole('button', { name: 'management.sharing.leave_course' })
        await user.click(leaveButton)

        await waitFor(() => {
            expect(onLeaveCourse).toHaveBeenCalledWith('course-1')
            expect(onClose).toHaveBeenCalled()
        })
    })
})
