
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Session } from "@/types"

interface DashboardProps {
    sessions: Session[]
}

export function Dashboard({ sessions }: DashboardProps) {
    // Group sessions by course
    const grouped = sessions.reduce((acc, session) => {
        const name = session.courseName
        if (!acc[name]) acc[name] = []
        acc[name].push(session)
        return acc
    }, {} as Record<string, Session[]>)

    if (Object.keys(grouped).length === 0) {
        return (
            <div className="text-center text-muted-foreground py-10">
                אין נתונים להצגה
            </div>
        )
    }

    return (
        <div className="space-y-8 pb-20">
            {Object.entries(grouped).map(([name, courseSessions]) => {
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

                return (
                    <div key={name} className="space-y-3">
                        <h3 className="font-bold text-xl text-primary border-b pb-2 mx-1 select-none">
                            {name}
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            <Card className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white border-none shadow-lg">
                                <CardHeader className="p-4 pb-2">
                                    <CardTitle className="text-sm font-medium opacity-90">סה״כ</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-0">
                                    <div className="text-3xl font-bold">
                                        {regularCount}
                                        {replacementsCount > 0 && <span className="text-lg opacity-80 font-normal"> (+{replacementsCount})</span>}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="bg-slate-50/50 border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                <CardHeader className="p-4 pb-2">
                                    <CardTitle className="text-sm font-medium text-slate-500">ממתינים</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-0">
                                    <div className="text-3xl font-bold text-slate-700">
                                        {pendingRegular}
                                        {pendingReplacements > 0 && <span className="text-lg opacity-80 font-normal"> (+{pendingReplacements})</span>}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="bg-emerald-50 border-emerald-100 shadow-sm hover:shadow-md transition-shadow">
                                <CardHeader className="p-4 pb-2">
                                    <CardTitle className="text-sm font-medium text-emerald-600">נכחתי</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-0">
                                    <div className="text-3xl font-bold text-emerald-600">{present}</div>
                                </CardContent>
                            </Card>
                            <Card className="bg-rose-50 border-rose-100 shadow-sm hover:shadow-md transition-shadow">
                                <CardHeader className="p-4 pb-2">
                                    <CardTitle className="text-sm font-medium text-rose-600">החסרתי</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-0">
                                    <div className="text-3xl font-bold text-rose-600">{absent}</div>
                                </CardContent>
                            </Card>

                            {/* New Subscription Stats */}
                            <Card className="bg-blue-50 border-blue-100 shadow-sm hover:shadow-md transition-shadow">
                                <CardHeader className="p-4 pb-2">
                                    <CardTitle className="text-sm font-medium text-blue-600">נוצל מהמנוי</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-0">
                                    <div className="text-3xl font-bold text-blue-600">{used}</div>
                                </CardContent>
                            </Card>
                            <Card className="bg-orange-50 border-orange-100 shadow-sm hover:shadow-md transition-shadow">
                                <CardHeader className="p-4 pb-2">
                                    <CardTitle className="text-sm font-medium text-orange-600">זכאי להשלמה</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-0">
                                    <div className="text-3xl font-bold text-orange-600">
                                        {makeups}
                                        {replacementsCount > 0 && <span className="text-lg opacity-80 font-normal"> ({replacementsCount})</span>}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
