
import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslation } from "react-i18next"
import { LayoutDashboard } from "lucide-react"
import type { Session } from "@/types"

interface DashboardProps {
    sessions: Session[]
}

interface CourseStats {
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

export function Dashboard({ sessions }: DashboardProps) {
    const { t } = useTranslation()

    // Group sessions by course ID and compute stats memoized (P2-7 & P3-2)
    const courseStatsList = useMemo<CourseStats[]>(() => {
        const map = new Map<string, { courseId: string; courseName: string; sessions: Session[] }>()

        for (const session of sessions) {
            const key = session.courseId || session.courseName
            let entry = map.get(key)
            if (!entry) {
                entry = {
                    courseId: session.courseId || key,
                    courseName: session.courseName,
                    sessions: []
                }
                map.set(key, entry)
            }
            entry.sessions.push(session)
        }

        return Array.from(map.values()).map(({ courseId, courseName, sessions: courseSessions }) => {
            const total = courseSessions.length
            const replacementsCount = courseSessions.filter(s => s.isReplacement).length
            const regularCount = total - replacementsCount
            const present = courseSessions.filter(s => s.attendance?.status === 'present').length
            const absent = courseSessions.filter(s => s.attendance?.status === 'absent').length

            const pendingSessions = courseSessions.filter(s => !s.attendance?.status)
            const pendingReplacements = pendingSessions.filter(s => s.isReplacement).length
            const pendingRegular = pendingSessions.length - pendingReplacements

            // Subscription Logic
            const personalAbsences = courseSessions.filter(s => s.attendance?.status === 'absent' && s.attendance.reason === 'personal').length
            const used = present + personalAbsences

            // Only count absences with a valid reason (not personal, not undefined) as eligible for replacements
            const makeups = courseSessions.filter(s =>
                s.attendance?.status === 'absent' &&
                s.attendance.reason &&
                s.attendance.reason !== 'personal'
            ).length

            return {
                courseId,
                courseName,
                regularCount,
                replacementsCount,
                pendingRegular,
                pendingReplacements,
                present,
                absent,
                used,
                makeups
            }
        })
    }, [sessions])

    return (
        <div className="h-full overflow-y-auto overscroll-y-contain space-y-6 p-4 md:p-8 pb-8">
            {/* Page Header */}
            <div className="flex flex-row justify-between items-center gap-3 border-b pb-3 sm:pb-4">
                <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <LayoutDashboard className="w-5 h-5 text-primary shrink-0" />
                        <span className="truncate">{t('common.dashboard')}</span>
                    </h2>
                    <p className="text-muted-foreground text-xs truncate">{t('dashboard.subtitle')}</p>
                </div>
            </div>

            {courseStatsList.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                    {t('common.no_data_to_display')}
                </div>
            ) : (
                <div className="space-y-8">
                    {courseStatsList.map((stats) => {
                        return (
                            <div key={stats.courseId} className="space-y-3">
                                <h3 className="font-bold text-xl border-b pb-2 mx-1 select-none">
                                    {stats.courseName}
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                    <Card className="bg-gradient-to-br from-indigo-400 to-purple-500 dark:from-indigo-600 dark:to-purple-700 text-white border-none shadow-lg">
                                        <CardHeader className="p-4 pb-2">
                                            <CardTitle className="text-sm font-medium opacity-90">{t('dashboard.total')}</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-4 pt-0">
                                            <div className="text-3xl font-bold">
                                                {stats.regularCount}
                                                {stats.replacementsCount > 0 && <span className="text-lg opacity-80 font-normal"> (+{stats.replacementsCount})</span>}
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
                                        <CardHeader className="p-4 pb-2">
                                            <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.remaining')}</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-4 pt-0">
                                            <div className="text-3xl font-bold text-foreground">
                                                {stats.pendingRegular}
                                                {stats.pendingReplacements > 0 && <span className="text-lg opacity-80 font-normal"> (+{stats.pendingReplacements})</span>}
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900 shadow-sm hover:shadow-md transition-shadow">
                                        <CardHeader className="p-4 pb-2">
                                            <CardTitle className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{t('dashboard.attended')}</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-4 pt-0">
                                            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{stats.present}</div>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-rose-50 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900 shadow-sm hover:shadow-md transition-shadow">
                                        <CardHeader className="p-4 pb-2">
                                            <CardTitle className="text-sm font-medium text-rose-600 dark:text-rose-400">{t('dashboard.absent')}</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-4 pt-0">
                                            <div className="text-3xl font-bold text-rose-600 dark:text-rose-400">{stats.absent}</div>
                                        </CardContent>
                                    </Card>

                                    {/* Subscription Stats */}
                                    <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900 shadow-sm hover:shadow-md transition-shadow">
                                        <CardHeader className="p-4 pb-2">
                                            <CardTitle className="text-sm font-medium text-blue-600 dark:text-blue-400">{t('dashboard.used_in_subscription')}</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-4 pt-0">
                                            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.used}</div>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-orange-50 dark:bg-orange-950/30 border-orange-100 dark:border-orange-900 shadow-sm hover:shadow-md transition-shadow">
                                        <CardHeader className="p-4 pb-2">
                                            <CardTitle className="text-sm font-medium text-orange-600 dark:text-orange-400">{t('dashboard.entitled_for_replacement')}</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-4 pt-0">
                                            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                                                {stats.makeups}
                                                {stats.replacementsCount > 0 && <span className="text-lg opacity-80 font-normal"> ({stats.replacementsCount})</span>}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
