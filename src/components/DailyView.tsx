import * as React from "react"
import { Check, X, Calendar as CalendarIcon, Trash2 } from "lucide-react"
import { format, parseISO, isToday } from "date-fns"
import { he } from "date-fns/locale"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import type { Session, AbsenceReason, Course } from "@/types"
import { cn } from "@/lib/utils"
import { DatePicker } from "@/components/ui/date-picker"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

interface DailyViewProps {
    sessions: Session[]
    courses: Course[]
    onUpdateAttendance: (sessionId: string, data: Session['attendance']) => void
    onScheduleReplacement: (sessionId: string) => void
    onUpdateSessionDate: (sessionId: string, newDate: string) => void
    onDeleteSession: (sessionId: string) => void
}

const REASONS: { value: AbsenceReason; label: string }[] = [
    { value: "personal", label: "סיבה אישית" },
    { value: "provider", label: "ביטול מדריך/חוג" },
    { value: "holiday", label: "חג / חופשה" },
    { value: "external", label: "אילוץ חיצוני" },
    { value: "other", label: "אחר" },
]

export function DailyView({ sessions, courses, onUpdateAttendance, onScheduleReplacement, onUpdateSessionDate, onDeleteSession }: DailyViewProps) {
    const [showFuture, setShowFuture] = React.useState(false)
    const [selectedCourseId, setSelectedCourseId] = React.useState<string>("all")

    const todayStr = format(new Date(), 'yyyy-MM-dd')

    const nextSessionIds = React.useMemo(() => {
        const ids = new Set<string>()
        const seenCourses = new Set<string>()

        const futureSessions = sessions
            .filter(s => s.date >= todayStr)
            .sort((a, b) => a.date.localeCompare(b.date))

        for (const s of futureSessions) {
            if (!seenCourses.has(s.courseId)) {
                ids.add(s.id)
                seenCourses.add(s.courseId)
            }
        }
        return ids
    }, [sessions, todayStr])

    const sortedSessions = sessions
        .filter(s => {
            const isNext = nextSessionIds.has(s.id)
            const dateMatch = showFuture ? true : (s.date <= todayStr || isNext)
            const courseMatch = selectedCourseId === "all" || s.courseId === selectedCourseId
            return dateMatch && courseMatch
        })
        .sort((a, b) => b.date.localeCompare(a.date))

    return (
        <div className="space-y-4 pb-20">
            <div className="flex flex-col md:flex-row gap-4 mb-4 bg-white p-3 rounded-lg shadow-sm border md:items-center md:justify-start">
                <div className="w-full md:w-[200px]">
                    <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                        <SelectTrigger className="text-right" dir="rtl">
                            <SelectValue placeholder="סנן לפי חוג" />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                            <SelectItem value="all">כל החוגים</SelectItem>
                            {courses.map(course => (
                                <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center gap-2">
                    <Switch
                        id="future-mode"
                        checked={showFuture}
                        onCheckedChange={setShowFuture}
                    />
                    <Label htmlFor="future-mode" className="cursor-pointer whitespace-nowrap">הצג עתידיים</Label>
                </div>
            </div>

            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {sortedSessions.length === 0 ? (
                    <div className="col-span-full text-center py-10 text-muted-foreground">
                        <CalendarIcon className="w-12 h-12 mx-auto mb-2 opacity-20" />
                        No sessions found
                    </div>
                ) : (
                    sortedSessions.map((session) => (
                        <SessionCard
                            key={session.id}
                            session={session}
                            sessions={sessions}
                            isNext={nextSessionIds.has(session.id)}
                            onUpdate={onUpdateAttendance}
                            onScheduleReplacement={onScheduleReplacement}
                            onUpdateSessionDate={onUpdateSessionDate}
                            onDeleteSession={onDeleteSession}
                        />
                    ))
                )}
            </div>
        </div>
    )
}

function SessionCard({ session, sessions, isNext, onUpdate, onScheduleReplacement, onUpdateSessionDate, onDeleteSession }: { session: Session; sessions: Session[]; isNext?: boolean; onUpdate: (id: string, data: Session['attendance']) => void; onScheduleReplacement: (id: string) => void; onUpdateSessionDate: (id: string, d: string) => void; onDeleteSession: (id: string) => void }) {
    // Use local state for immediate UI updates
    const [localAttendance, setLocalAttendance] = React.useState(session.attendance)
    const [showDeleteReplacementAlert, setShowDeleteReplacementAlert] = React.useState(false)
    const [pendingStatusChange, setPendingStatusChange] = React.useState<'present' | 'clear' | null>(null)

    // Sync local state with prop changes
    React.useEffect(() => {
        setLocalAttendance(session.attendance)
    }, [session.attendance])

    const isPresent = localAttendance?.status === 'present'
    const isAbsent = localAttendance?.status === 'absent'

    // Calculate replacement limits for this course
    const courseSessions = sessions.filter(s => s.courseId === session.courseId)
    const personalAbsences = courseSessions.filter(s => s.attendance?.status === 'absent' && s.attendance.reason === 'personal').length
    const absent = courseSessions.filter(s => s.attendance?.status === 'absent').length
    const entitledReplacements = absent - personalAbsences
    const actualReplacements = courseSessions.filter(s => s.isReplacement).length
    const canAddReplacement = actualReplacements < entitledReplacements

    // Find linked replacement session if exists
    const replacementSession = session.replacementSessionId
        ? sessions.find(s => s.id === session.replacementSessionId)
        : undefined

    // Find original session if this is a replacement
    const originalSession = session.replacementForSessionId
        ? sessions.find(s => s.id === session.replacementForSessionId)
        : undefined

    const handleStatusChange = (status: 'present' | 'absent') => {
        // If clicking the same status, unselect it
        if (localAttendance?.status === status) {
            // If unselecting absent and there's a linked replacement, show confirmation
            if (status === 'absent' && session.replacementSessionId) {
                setPendingStatusChange('clear')
                setShowDeleteReplacementAlert(true)
                return
            }
            setLocalAttendance(undefined)
            onUpdate(session.id, undefined)
        } else {
            // If changing from absent to present and there's a linked replacement, show confirmation
            if (status === 'present' && localAttendance?.status === 'absent' && session.replacementSessionId) {
                setPendingStatusChange('present')
                setShowDeleteReplacementAlert(true)
                return
            }

            const newAttendance = {
                ...localAttendance,
                status,
                reason: status === 'present' ? undefined : localAttendance?.reason,
                details: status === 'present' ? undefined : localAttendance?.details,
            }
            setLocalAttendance(newAttendance)
            onUpdate(session.id, newAttendance)
        }
    }

    const confirmDeleteReplacement = () => {
        const replacementId = session.replacementSessionId

        // Delete the replacement session
        // handleDeleteSession will automatically clear the replacementSessionId from this session
        if (replacementId) {
            onDeleteSession(replacementId)
        }

        // Update attendance based on what action was pending
        if (pendingStatusChange === 'clear') {
            // User was trying to clear attendance
            setLocalAttendance(undefined)
            onUpdate(session.id, undefined)
        } else if (pendingStatusChange === 'present') {
            // User was trying to mark as present
            const newAttendance = {
                status: 'present' as const
            }
            setLocalAttendance(newAttendance)
            onUpdate(session.id, newAttendance)
        }

        setPendingStatusChange(null)
        setShowDeleteReplacementAlert(false)
    }

    const handleReasonChange = (val: string) => {
        if (!isAbsent) return
        const newAttendance = { ...localAttendance!, status: 'absent' as const, reason: val as AbsenceReason }
        setLocalAttendance(newAttendance)
        onUpdate(session.id, newAttendance)
    }

    const handleDetailsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (!isAbsent) return
        const newAttendance = { ...localAttendance!, status: 'absent' as const, details: e.target.value }
        setLocalAttendance(newAttendance)
        onUpdate(session.id, newAttendance)
    }

    const dateObj = parseISO(session.date)

    return (
        <Card className={cn(
            "overflow-hidden transition-all duration-300 border-l-4",
            session.isReplacement ? "border-l-orange-500 bg-orange-50/40" :
                isPresent ? "border-l-emerald-500 bg-emerald-50/30" :
                    isAbsent ? "border-l-rose-500 bg-rose-50/30" : "border-l-gray-300"
        )}>
            <CardContent className="p-5">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-lg text-primary">
                                {session.courseName}
                                {session.isReplacement && <span className="mr-2 text-xs font-normal text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">השלמה</span>}
                            </h3>
                            {isNext && (
                                <span className="text-[10px] font-extrabold bg-primary text-white px-2 py-0.5 rounded-full animate-pulse">
                                    השיעור הבא
                                </span>
                            )}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <DatePicker
                                date={dateObj}
                                setDate={(d) => {
                                    if (d) onUpdateSessionDate(session.id, format(d, 'yyyy-MM-dd'))
                                }}
                                className="h-auto p-0 text-muted-foreground border-none shadow-none hover:bg-transparent hover:text-primary w-auto font-normal justify-start"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {isToday(dateObj) && <span className="text-xs font-bold px-2 py-1 bg-blue-100 text-blue-700 rounded-full">היום</span>}
                        {session.isReplacement && (
                            <button
                                onClick={() => onDeleteSession(session.id)}
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 transition-colors"
                                title="מחק שיעור השלמה"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex gap-3 mb-4">
                    <button
                        onClick={() => handleStatusChange('present')}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all border-2",
                            isPresent
                                ? "bg-emerald-100 border-emerald-500 text-emerald-700 shadow-sm"
                                : "bg-white border-transparent text-gray-400 hover:bg-emerald-50 hover:text-emerald-600"
                        )}
                    >
                        <div className={cn("w-6 h-6 rounded-full flex items-center justify-center", isPresent ? "bg-emerald-500 text-white" : "bg-gray-200")}>
                            <Check className="w-4 h-4" />
                        </div>
                        הייתי
                    </button>

                    <button
                        onClick={() => handleStatusChange('absent')}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all border-2",
                            isAbsent
                                ? "bg-rose-100 border-rose-500 text-rose-700 shadow-sm"
                                : "bg-white border-transparent text-gray-400 hover:bg-rose-50 hover:text-rose-600"
                        )}
                    >
                        <div className={cn("w-6 h-6 rounded-full flex items-center justify-center", isAbsent ? "bg-rose-500 text-white" : "bg-gray-200")}>
                            <X className="w-4 h-4" />
                        </div>
                        חסרתי
                    </button>
                </div>

                {isAbsent && (
                    <>
                        <div className="animate-accordion-down space-y-3 pt-2 border-t border-gray-100 mt-2">
                            <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">סיבת היעדרות</Label>
                                <Select
                                    value={session.attendance?.reason}
                                    onValueChange={handleReasonChange}
                                >
                                    <SelectTrigger className="bg-white">
                                        <SelectValue placeholder="בחר סיבה..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {REASONS.map(r => (
                                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">פירוט (אופציונלי)</Label>
                                <Textarea
                                    value={session.attendance?.details || ""}
                                    onChange={handleDetailsChange}
                                    placeholder="הוסף פרטים..."
                                    className="resize-none bg-white font-sans"
                                    rows={2}
                                />
                            </div>
                        </div>

                        {/* Show replacement button or replacement info */}
                        {session.replacementSessionId ? (
                            <div className="w-full mt-2 py-2 px-3 text-sm font-medium text-orange-700 bg-orange-50 rounded-lg border border-orange-200 flex items-center justify-center gap-2">
                                <CalendarIcon className="w-4 h-4" />
                                השלמה נקבעה ל-{replacementSession && format(parseISO(replacementSession.date), 'd בMMMM yyyy', { locale: he })}
                            </div>
                        ) : (
                            <button
                                onClick={() => onScheduleReplacement(session.id)}
                                disabled={!canAddReplacement}
                                className={`w-full mt-2 py-2 text-sm font-medium rounded-lg border transition-colors flex items-center justify-center gap-2 ${canAddReplacement
                                    ? 'text-orange-600 bg-orange-50 hover:bg-orange-100 border-orange-200 cursor-pointer'
                                    : 'text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed opacity-60'
                                    }`}
                                title={canAddReplacement ? 'קבע שיעור השלמה' : `הגעת למגבלת ההשלמות (${actualReplacements}/${entitledReplacements})`}
                            >
                                <CalendarIcon className="w-4 h-4" />
                                קבע שיעור השלמה {!canAddReplacement && `(${actualReplacements}/${entitledReplacements})`}
                            </button>
                        )}
                    </>
                )}

                {/* Show original event info if this is a replacement */}
                {session.isReplacement && originalSession && (
                    <div className="mt-2 py-2 px-3 text-sm text-orange-700 bg-orange-50 rounded-lg border border-orange-200">
                        <div className="flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4" />
                            <span>השלמה עבור שיעור מ-{format(parseISO(originalSession.date), 'd בMMMM yyyy', { locale: he })}</span>
                        </div>
                    </div>
                )}
            </CardContent>

            {/* Confirmation dialog for deleting replacement */}
            <AlertDialog open={showDeleteReplacementAlert} onOpenChange={setShowDeleteReplacementAlert}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle>
                        <AlertDialogDescription>
                            שיעור ההשלמה שנקבע ל-{replacementSession && format(parseISO(replacementSession.date), 'd בMMMM yyyy', { locale: he })} יימחק.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => {
                            setPendingStatusChange(null)
                            setShowDeleteReplacementAlert(false)
                        }}>ביטול</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteReplacement}>אישור</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    )
}
