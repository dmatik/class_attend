import { format, parseISO } from "date-fns"
import { he, enUS } from "date-fns/locale"
import type { Session } from "@/types"

export interface CourseSummaryStats {
    courseId: string
    courseName: string
    regularCount: number
    replacementsCount: number
    pendingRegular: number
    pendingReplacements: number
    present: number
    absent: number
    used: number
    makeups: number
}

export interface GenerateCourseCsvParams {
    stats: CourseSummaryStats
    sessions: Session[]
    t: (key: string) => string
    language: string
}

/**
 * Escapes a cell value according to RFC 4180 CSV standard.
 */
export function escapeCsvCell(cell: unknown): string {
    if (cell === null || cell === undefined) return ""
    const str = String(cell)
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`
    }
    return str
}

/**
 * Generates a formatted CSV string with UTF-8 support including:
 * 1. Course Metadata
 * 2. Dashboard KPI Summary
 * 3. Chronological Sessions Detail Table
 */
export function generateCourseCsv({ stats, sessions, t, language }: GenerateCourseCsvParams): string {
    const rows: string[][] = []

    // 1. Metadata
    rows.push([t('dashboard.csv_export.course_name'), stats.courseName])
    rows.push([t('dashboard.csv_export.export_date'), format(new Date(), 'yyyy-MM-dd')])
    rows.push([]) // Blank line

    // 2. Summary Section
    rows.push([t('dashboard.csv_export.summary_section')])
    rows.push([
        t('dashboard.total'),
        t('dashboard.remaining'),
        t('dashboard.attended'),
        t('dashboard.absent'),
        t('dashboard.used_in_subscription'),
        t('dashboard.entitled_for_replacement')
    ])

    const totalVal = `${stats.regularCount}${stats.replacementsCount > 0 ? ` (+${stats.replacementsCount})` : ''}`
    const remainingVal = `${stats.pendingRegular}${stats.pendingReplacements > 0 ? ` (+${stats.pendingReplacements})` : ''}`
    const presentVal = String(stats.present)
    const absentVal = String(stats.absent)
    const usedVal = String(stats.used)
    const makeupsVal = `${stats.makeups}${stats.replacementsCount > 0 ? ` (${stats.replacementsCount})` : ''}`

    rows.push([totalVal, remainingVal, presentVal, absentVal, usedVal, makeupsVal])
    rows.push([]) // Blank line

    // 3. Classes Table Section
    rows.push([t('dashboard.csv_export.classes_section')])
    rows.push([
        t('dashboard.csv_export.lesson_number'),
        t('dashboard.csv_export.date'),
        t('dashboard.csv_export.day_of_week'),
        t('dashboard.csv_export.type'),
        t('dashboard.csv_export.status'),
        t('dashboard.csv_export.reason'),
        t('dashboard.csv_export.notes')
    ])

    // Sort sessions chronologically ascending
    const sortedSessions = [...sessions].sort((a, b) => a.date.localeCompare(b.date))
    const dateLocale = language === 'he' ? he : enUS

    sortedSessions.forEach((s, idx) => {
        let dayOfWeek = ""
        try {
            dayOfWeek = format(parseISO(s.date), 'EEEE', { locale: dateLocale })
        } catch {
            dayOfWeek = ""
        }

        const typeStr = s.isReplacement
            ? t('dashboard.csv_export.replacement_lesson')
            : t('dashboard.csv_export.regular_lesson')

        let statusStr = t('dashboard.csv_export.pending_status')
        if (s.attendance?.status === 'present') {
            statusStr = t('common.present')
        } else if (s.attendance?.status === 'absent') {
            statusStr = t('common.absent')
        }

        let reasonStr = ""
        if (s.attendance?.status === 'absent' && s.attendance.reason) {
            reasonStr = t(`reasons.${s.attendance.reason}`)
        }

        const notesStr = s.attendance?.details || ""

        rows.push([
            String(idx + 1),
            s.date,
            dayOfWeek,
            typeStr,
            statusStr,
            reasonStr,
            notesStr
        ])
    })

    return rows.map(row => row.map(escapeCsvCell).join(",")).join("\r\n")
}

/**
 * Creates a sanitized filename for CSV export.
 */
export function generateCsvFilename(courseName: string): string {
    const safeName = courseName.replace(/[\\/:*?"<>|]/g, "_").trim() || "course"
    return `${safeName}_${format(new Date(), 'yyyy-MM-dd')}.csv`
}

/**
 * Triggers a client-side download of the CSV content with a UTF-8 BOM.
 */
export function downloadCsv(filename: string, csvContent: string): void {
    // Prepend UTF-8 BOM (\uFEFF) to guarantee Excel properly renders Hebrew & Unicode characters
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

