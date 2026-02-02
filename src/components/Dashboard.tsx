
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
                            <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-none shadow-lg">
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
                            <Card className="bg-white border-none shadow-sm">
                                <CardHeader className="p-4 pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">ממתינים</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-0">
                                    <div className="text-3xl font-bold text-gray-500">
                                        {pendingRegular}
                                        {pendingReplacements > 0 && <span className="text-lg opacity-80 font-normal"> (+{pendingReplacements})</span>}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="bg-emerald-50 border-none shadow-sm">
                                <CardHeader className="p-4 pb-2">
                                    <CardTitle className="text-sm font-medium text-emerald-600">נכחתי</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-0">
                                    <div className="text-3xl font-bold text-emerald-700">{present}</div>
                                </CardContent>
                            </Card>
                            <Card className="bg-rose-50 border-none shadow-sm">
                                <CardHeader className="p-4 pb-2">
                                    <CardTitle className="text-sm font-medium text-rose-600">החסרתי</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-0">
                                    <div className="text-3xl font-bold text-rose-700">{absent}</div>
                                </CardContent>
                            </Card>

                            {/* New Subscription Stats */}
                            <Card className="bg-blue-50 border-none shadow-sm ring-1 ring-blue-100">
                                <CardHeader className="p-4 pb-2">
                                    <CardTitle className="text-sm font-medium text-blue-600">נוצל מהמנוי</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-0">
                                    <div className="text-3xl font-bold text-blue-700">{used}</div>
                                </CardContent>
                            </Card>
                            <Card className="bg-orange-50 border-none shadow-sm ring-1 ring-orange-100">
                                <CardHeader className="p-4 pb-2">
                                    <CardTitle className="text-sm font-medium text-orange-600">זכאי להשלמה</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-0">
                                    <div className="text-3xl font-bold text-orange-700">
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
