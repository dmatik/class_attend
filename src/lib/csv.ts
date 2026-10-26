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
 * Dangerous characters that trigger spreadsheet formula execution in Excel/Calc/Sheets (CWE-1236).
 */
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r']

/**
 * Escapes a cell value according to RFC 4180 and protects against CSV formula injection (CWE-1236).
 */
export function escapeCsvCell(cell: unknown): string {
    if (cell === null || cell === undefined) return ""
    let str = String(cell)

    // Strip null bytes and non-printable control characters (preserving newline/tab/carriage return)
    str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")

    // Neutralize formula injection if trimmed cell starts with a trigger character
    const trimmed = str.trimStart()
    if (FORMULA_TRIGGERS.some(trigger => trimmed.startsWith(trigger))) {
        str = `'${str}`
    }

    // RFC 4180 escaping
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
    rows.push([t('dashboard.csv_export.course_name'), stats?.courseName || ""])
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

    const totalVal = `${stats?.regularCount || 0}${(stats?.replacementsCount || 0) > 0 ? ` (+${stats.replacementsCount})` : ''}`
    const remainingVal = `${stats?.pendingRegular || 0}${(stats?.pendingReplacements || 0) > 0 ? ` (+${stats.pendingReplacements})` : ''}`
    const presentVal = String(stats?.present || 0)
    const absentVal = String(stats?.absent || 0)
    const usedVal = String(stats?.used || 0)
    const makeupsVal = `${stats?.makeups || 0}${(stats?.replacementsCount || 0) > 0 ? ` (${stats.replacementsCount})` : ''}`

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

    // Sort sessions chronologically ascending with null-safety
    const sortedSessions = [...(sessions || [])].sort((a, b) => (a?.date || "").localeCompare(b?.date || ""))
    const dateLocale = language === 'he' ? he : enUS

    sortedSessions.forEach((s, idx) => {
        let dayOfWeek = ""
        if (s?.date) {
            try {
                dayOfWeek = format(parseISO(s.date), 'EEEE', { locale: dateLocale })
            } catch {
                dayOfWeek = ""
            }
        }

        const typeStr = s?.isReplacement
            ? t('dashboard.csv_export.replacement_lesson')
            : t('dashboard.csv_export.regular_lesson')

        let statusStr = t('dashboard.csv_export.pending_status')
        if (s?.attendance?.status === 'present') {
            statusStr = t('common.present')
        } else if (s?.attendance?.status === 'absent') {
            statusStr = t('common.absent')
        }

        let reasonStr = ""
        if (s?.attendance?.status === 'absent' && s.attendance.reason) {
            reasonStr = t(`reasons.${s.attendance.reason}`)
        }

        const notesStr = s?.attendance?.details || ""

        rows.push([
            String(idx + 1),
            s?.date || "",
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
 * Creates a sanitized, safe filename for CSV export.
 */
export function generateCsvFilename(courseName?: string | null): string {
    const raw = typeof courseName === "string" ? courseName : ""
    // Strip illegal filename characters, control chars, and BIDI override characters
    const sanitized = raw
        .replace(/[\\/:*?"<>|]/g, "_")
        .replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e]/g, "")
        .trim()
        .slice(0, 80) // Prevent OS filesystem path limit exhaustion

    const safeName = sanitized || "course"
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
    try {
        link.click()
    } finally {
        document.body.removeChild(link)
        // Delay revocation to ensure background download manager completes stream acquisition
        setTimeout(() => URL.revokeObjectURL(url), 250)
    }
}

