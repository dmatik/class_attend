export type AbsenceReason = 'personal' | 'holiday' | 'external' | 'provider' | 'other';

export interface AttendanceRecord {
    status: 'present' | 'absent';
    reason?: AbsenceReason;
    details?: string;
}

export interface Course {
    id: string
    name: string
    startDate: string
    daysOfWeek: number[]
    endDate?: string
    totalLessons?: number
}

export interface Session {
    id: string
    courseId: string
    courseName: string
    date: string // ISO date string YYYY-MM-DD
    attendance?: AttendanceRecord
    isReplacement?: boolean
    replacementForSessionId?: string // If this is a replacement, ID of the original missed session
    replacementSessionId?: string // If this session was missed, ID of the replacement session
}
