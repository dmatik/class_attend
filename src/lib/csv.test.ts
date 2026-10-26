import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    escapeCsvCell,
    generateCsvFilename,
    generateCourseCsv,
    downloadCsv,
    type CourseSummaryStats
} from './csv'
import type { Session } from '@/types'

describe('csv utility', () => {
    describe('escapeCsvCell', () => {
        it('returns empty string for null and undefined', () => {
            expect(escapeCsvCell(null)).toBe('')
            expect(escapeCsvCell(undefined)).toBe('')
        })

        it('returns plain string when no special characters are present', () => {
            expect(escapeCsvCell('hello')).toBe('hello')
            expect(escapeCsvCell(123)).toBe('123')
            expect(escapeCsvCell('Math 101')).toBe('Math 101')
        })

        it('quotes cell containing commas', () => {
            expect(escapeCsvCell('hello, world')).toBe('"hello, world"')
        })

        it('quotes cell containing double quotes and doubles the quotes', () => {
            expect(escapeCsvCell('He said "hello"')).toBe('"He said ""hello"""')
        })

        it('quotes cell containing newlines', () => {
            expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"')
            expect(escapeCsvCell("line1\r\nline2")).toBe('"line1\r\nline2"')
        })

        it('neutralizes CSV formula injection triggers (=, +, -, @, \\t, \\r)', () => {
            expect(escapeCsvCell('=1+1')).toBe("'=1+1")
            expect(escapeCsvCell('+2+2')).toBe("'+2+2")
            expect(escapeCsvCell('-5')).toBe("'-5")
            expect(escapeCsvCell('@SUM(A1:A5)')).toBe("'@SUM(A1:A5)")
            expect(escapeCsvCell('\t=cmd')).toBe("'\t=cmd")
            expect(escapeCsvCell('   =HYPERLINK("http://attacker.com")')).toBe('"\'   =HYPERLINK(""http://attacker.com"")"')
        })

        it('strips null bytes and non-printable control characters', () => {
            expect(escapeCsvCell("Hello\x00World\x07")).toBe("HelloWorld")
        })
    })

    describe('generateCsvFilename', () => {
        it('sanitizes illegal filename characters', () => {
            const filename = generateCsvFilename('Math / 101: Advanced*')
            expect(filename).not.toMatch(/[\\/:*?"<>|]/)
            expect(filename).toContain('Math _ 101_ Advanced_')
            expect(filename.endsWith('.csv')).toBe(true)
        })

        it('provides default fallback for empty, null, or undefined course name', () => {
            expect(generateCsvFilename('')).toMatch(/^course_\d{4}-\d{2}-\d{2}\.csv$/)
            expect(generateCsvFilename(null)).toMatch(/^course_\d{4}-\d{2}-\d{2}\.csv$/)
            expect(generateCsvFilename(undefined)).toMatch(/^course_\d{4}-\d{2}-\d{2}\.csv$/)
        })

        it('strips control characters and limits filename length', () => {
            const longName = 'A'.repeat(300)
            const filename = generateCsvFilename(longName)
            expect(filename.length).toBeLessThan(120)
        })
    })

    describe('generateCourseCsv', () => {
        const mockStats: CourseSummaryStats = {
            courseId: 'c1',
            courseName: 'Pilates',
            regularCount: 10,
            replacementsCount: 2,
            pendingRegular: 4,
            pendingReplacements: 1,
            present: 5,
            absent: 2,
            used: 6,
            makeups: 1
        }

        const mockSessions: Session[] = [
            {
                id: 's2',
                courseId: 'c1',
                courseName: 'Pilates',
                date: '2026-05-10',
                attendance: { status: 'absent', reason: 'personal', details: 'Doctor appointment, urgent' }
            },
            {
                id: 's1',
                courseId: 'c1',
                courseName: 'Pilates',
                date: '2026-05-03',
                attendance: { status: 'present' }
            },
            {
                id: 's3',
                courseId: 'c1',
                courseName: 'Pilates',
                date: '2026-05-17',
                isReplacement: true
                // Pending
            }
        ]

        const mockEnT = (key: string) => {
            const translations: Record<string, string> = {
                'dashboard.csv_export.course_name': 'Course',
                'dashboard.csv_export.export_date': 'Export Date',
                'dashboard.csv_export.summary_section': 'Summary',
                'dashboard.total': 'Total',
                'dashboard.remaining': 'Remaining',
                'dashboard.attended': 'Attended',
                'dashboard.absent': 'Absent',
                'dashboard.used_in_subscription': 'Used in subscription',
                'dashboard.entitled_for_replacement': 'Entitled for replacement',
                'dashboard.csv_export.classes_section': 'Classes',
                'dashboard.csv_export.lesson_number': '#',
                'dashboard.csv_export.date': 'Date',
                'dashboard.csv_export.day_of_week': 'Day',
                'dashboard.csv_export.type': 'Type',
                'dashboard.csv_export.status': 'Status',
                'dashboard.csv_export.reason': 'Reason',
                'dashboard.csv_export.notes': 'Notes',
                'dashboard.csv_export.regular_lesson': 'Regular',
                'dashboard.csv_export.replacement_lesson': 'Replacement',
                'dashboard.csv_export.pending_status': 'Pending',
                'common.present': 'Attended',
                'common.absent': 'Absent',
                'reasons.personal': 'Personal Reason'
            }
            return translations[key] || key
        }

        it('generates CSV with course metadata and summary metrics matching dashboard', () => {
            const csv = generateCourseCsv({
                stats: mockStats,
                sessions: mockSessions,
                t: mockEnT,
                language: 'en'
            })

            const lines = csv.split('\r\n')
            expect(lines[0]).toBe('Course,Pilates')
            expect(lines[1]).toMatch(/^Export Date,\d{4}-\d{2}-\d{2}$/)
            expect(lines[3]).toBe('Summary')
            expect(lines[4]).toBe('Total,Remaining,Attended,Absent,Used in subscription,Entitled for replacement')
            expect(lines[5]).toBe('10 (+2),4 (+1),5,2,6,1 (2)')
        })

        it('sorts sessions chronologically and formats class rows with details escaped', () => {
            const csv = generateCourseCsv({
                stats: mockStats,
                sessions: mockSessions,
                t: mockEnT,
                language: 'en'
            })

            const lines = csv.split('\r\n')
            expect(lines[7]).toBe('Classes')
            expect(lines[8]).toBe('#,Date,Day,Type,Status,Reason,Notes')

            // Row 1 should be s1 (2026-05-03)
            expect(lines[9]).toContain('1,2026-05-03,Sunday,Regular,Attended,,')

            // Row 2 should be s2 (2026-05-10) with escaped notes
            expect(lines[10]).toContain('2,2026-05-10,Sunday,Regular,Absent,Personal Reason,"Doctor appointment, urgent"')

            // Row 3 should be s3 (2026-05-17) replacement pending
            expect(lines[11]).toContain('3,2026-05-17,Sunday,Replacement,Pending,,')
        })

        it('supports Hebrew localization', () => {
            const mockHeT = (key: string) => {
                const translations: Record<string, string> = {
                    'dashboard.csv_export.course_name': 'שם החוג',
                    'dashboard.csv_export.export_date': 'תאריך ייצוא',
                    'dashboard.csv_export.summary_section': 'סיכום',
                    'dashboard.total': 'סה״כ',
                    'dashboard.remaining': 'ממתינים',
                    'dashboard.attended': 'נכחתי',
                    'dashboard.absent': 'החסרתי',
                    'dashboard.used_in_subscription': 'נוצל מהמנוי',
                    'dashboard.entitled_for_replacement': 'זכאות להשלמה',
                    'dashboard.csv_export.classes_section': 'שיעורים',
                    'dashboard.csv_export.lesson_number': '#',
                    'dashboard.csv_export.date': 'תאריך',
                    'dashboard.csv_export.day_of_week': 'יום',
                    'dashboard.csv_export.type': 'סוג',
                    'dashboard.csv_export.status': 'סטטוס',
                    'dashboard.csv_export.reason': 'סיבה',
                    'dashboard.csv_export.notes': 'הערות',
                    'dashboard.csv_export.regular_lesson': 'רגיל',
                    'dashboard.csv_export.replacement_lesson': 'השלמה',
                    'dashboard.csv_export.pending_status': 'ממתין',
                    'common.present': 'נוכח',
                    'common.absent': 'חסר',
                    'reasons.personal': 'סיבה אישית'
                }
                return translations[key] || key
            }

            const csv = generateCourseCsv({
                stats: mockStats,
                sessions: mockSessions,
                t: mockHeT,
                language: 'he'
            })

            expect(csv).toContain('שם החוג,Pilates')
            expect(csv).toContain('סה״כ,ממתינים,נכחתי,החסרתי,נוצל מהמנוי,זכאות להשלמה')
            expect(csv).toContain('10 (+2),4 (+1),5,2,6,1 (2)')
            expect(csv).toContain('שיעורים')
            expect(csv).toContain('יום ראשון') // Sunday in Hebrew
        })

        it('handles sessions with missing dates or undefined attendance gracefully', () => {
            const corruptedSessions: any[] = [
                { id: 'c1', courseId: 'c1', courseName: 'Test', date: undefined },
                { id: 'c2', courseId: 'c1', courseName: 'Test', date: '2026-06-01' }
            ]

            const csv = generateCourseCsv({
                stats: mockStats,
                sessions: corruptedSessions,
                t: mockEnT,
                language: 'en'
            })

            expect(csv).toContain('1,,')
            expect(csv).toContain('2,2026-06-01')
        })

        it('neutralizes formula injection in course name and session notes', () => {
            const maliciousStats = {
                ...mockStats,
                courseName: '=cmd|/C calc!A0'
            }
            const maliciousSessions: Session[] = [
                {
                    id: 'm1',
                    courseId: 'c1',
                    courseName: '=cmd|/C calc!A0',
                    date: '2026-06-01',
                    attendance: { status: 'absent', details: '=HYPERLINK("http://evil.com")' }
                }
            ]

            const csv = generateCourseCsv({
                stats: maliciousStats,
                sessions: maliciousSessions,
                t: mockEnT,
                language: 'en'
            })

            // Course name in metadata should be neutralized
            expect(csv).toContain("'=cmd|/C calc!A0")
            // Notes in session row should be neutralized
            expect(csv).toContain("'=HYPERLINK(\"\"http://evil.com\"\")")
        })
    })

    describe('downloadCsv', () => {
        let originalCreateObjectURL: typeof URL.createObjectURL
        let originalRevokeObjectURL: typeof URL.revokeObjectURL
        let mockBlob: any = null

        beforeEach(() => {
            vi.useFakeTimers()
            originalCreateObjectURL = URL.createObjectURL
            originalRevokeObjectURL = URL.revokeObjectURL

            URL.createObjectURL = vi.fn((blob: Blob) => {
                mockBlob = blob
                return 'blob:mock-url'
            })
            URL.revokeObjectURL = vi.fn()
        })

        afterEach(() => {
            vi.useRealTimers()
            URL.createObjectURL = originalCreateObjectURL
            URL.revokeObjectURL = originalRevokeObjectURL
            mockBlob = null
        })

        it('creates a download link with UTF-8 BOM, triggers click, and cleans up after delay', () => {
            const clickSpy = vi.fn()
            const appendChildSpy = vi.spyOn(document.body, 'appendChild')
            const removeChildSpy = vi.spyOn(document.body, 'removeChild')

            const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
                const el = document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as HTMLAnchorElement
                el.click = clickSpy
                return el
            })

            downloadCsv('test.csv', 'Col1,Col2\r\nVal1,Val2')

            expect(URL.createObjectURL).toHaveBeenCalled()
            expect(mockBlob).toBeInstanceOf(Blob)
            expect(mockBlob.type).toBe('text/csv;charset=utf-8;')

            expect(appendChildSpy).toHaveBeenCalled()
            expect(clickSpy).toHaveBeenCalled()
            expect(removeChildSpy).toHaveBeenCalled()

            // Object URL should NOT be revoked immediately (to protect async browser downloads)
            expect(URL.revokeObjectURL).not.toHaveBeenCalled()

            // Advance timers by 250ms
            vi.advanceTimersByTime(250)
            expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')

            createElementSpy.mockRestore()
            appendChildSpy.mockRestore()
            removeChildSpy.mockRestore()
        })
    })
})

