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
}
