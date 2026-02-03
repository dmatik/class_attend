import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
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
    // Initialize state from sessionStorage
    const [showFuture, setShowFuture] = React.useState(() => {
        const saved = sessionStorage.getItem('dailyView.showFuture')
        return saved ? JSON.parse(saved) : false
    })
    const [selectedCourseId, setSelectedCourseId] = React.useState<string>(() => {
        const saved = sessionStorage.getItem('dailyView.selectedCourseId')
        return saved || "all"
    })
    const [eventTypeFilter, setEventTypeFilter] = React.useState<'all' | 'missed' | 'replacement'>(() => {
        const saved = sessionStorage.getItem('dailyView.eventTypeFilter')
        return (saved as 'all' | 'missed' | 'replacement') || 'all'
    })

    // Persist showFuture to sessionStorage
    React.useEffect(() => {
        sessionStorage.setItem('dailyView.showFuture', JSON.stringify(showFuture))
    }, [showFuture])

    // Persist selectedCourseId to sessionStorage
    React.useEffect(() => {
        sessionStorage.setItem('dailyView.selectedCourseId', selectedCourseId)
    }, [selectedCourseId])

    // Persist eventTypeFilter to sessionStorage
    React.useEffect(() => {
        sessionStorage.setItem('dailyView.eventTypeFilter', eventTypeFilter)
    }, [eventTypeFilter])

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

            // Event type filter
            let eventTypeMatch = true
            if (eventTypeFilter === 'missed') {
                eventTypeMatch = s.attendance?.status === 'absent'
            } else if (eventTypeFilter === 'replacement') {
                eventTypeMatch = s.isReplacement === true
            }

            return dateMatch && courseMatch && eventTypeMatch
        })
        .sort((a, b) => b.date.localeCompare(a.date))

    return (
        <div className="space-y-6 pb-20">
            {/* Filter Bar */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row gap-4 mb-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200 md:items-center md:justify-start sticky top-0 z-10"
            >
                <div className="w-full md:w-[200px]">
                    <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                        <SelectTrigger className="text-right bg-slate-50 border-slate-200 focus:ring-slate-200" dir="rtl">
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
                <div className="w-full md:w-[200px]">
                    <Select value={eventTypeFilter} onValueChange={(value) => setEventTypeFilter(value as 'all' | 'missed' | 'replacement')}>
                        <SelectTrigger className="text-right bg-slate-50 border-slate-200 focus:ring-slate-200" dir="rtl">
                            <SelectValue placeholder="סנן לפי סוג" />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                            <SelectItem value="all">כל האירועים</SelectItem>
                            <SelectItem value="missed">רק חיסורים</SelectItem>
                            <SelectItem value="replacement">רק השלמות</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center gap-2">
                    <Switch
                        id="future-mode"
                        checked={showFuture}
                        onCheckedChange={setShowFuture}
                    />
                    <Label htmlFor="future-mode" className="cursor-pointer whitespace-nowrap text-slate-600">הצג עתידיים</Label>
                </div>
            </motion.div>

            {/* Session List */}
            <motion.div layout className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <AnimatePresence mode="popLayout">
                    {sortedSessions.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="col-span-full text-center py-10 text-slate-400"
                        >
                            <CalendarIcon className="w-12 h-12 mx-auto mb-2 opacity-20" />
                            <p>לא נמצאו שיעורים</p>
                        </motion.div>
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
                </AnimatePresence>
            </motion.div>
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

    // Only count absences with a valid reason (not personal, not undefined) as eligible for replacements
    // Exclude the current session from this count to get the "other" eligible absences
    const otherEligibleAbsences = courseSessions.filter(s =>
        s.id !== session.id &&
        s.attendance?.status === 'absent' &&
        s.attendance.reason &&
        s.attendance.reason !== 'personal'
    ).length

    const actualReplacements = courseSessions.filter(s => s.isReplacement).length

    // Check if THIS session is eligible for a replacement (has a valid reason)
    const thisSessionEligible = isAbsent && localAttendance?.reason && localAttendance.reason !== 'personal'

    // Total eligible absences includes this session if it's eligible
    const totalEligibleAbsences = otherEligibleAbsences + (thisSessionEligible ? 1 : 0)

    // Can add replacement if: under the limit AND this specific session is eligible
    const canAddReplacement = actualReplacements < totalEligibleAbsences && thisSessionEligible

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
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2 }}
        >
            <Card className={cn(
                "overflow-hidden transition-all duration-300 border-l-4 shadow-sm hover:shadow-md",
                "bg-white border-slate-200", // Light mode base
                session.isReplacement ? "border-l-orange-500" :
                    isPresent ? "border-l-emerald-500" :
                        isAbsent ? "border-l-rose-500" : "border-l-slate-300"
            )}>
                <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className={cn("font-bold text-lg",
                                    session.isReplacement ? "text-orange-700" : "text-slate-900"
                                )}>
                                    {session.courseName}
                                    {session.isReplacement && <span className="mr-2 text-xs font-normal text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">השלמה</span>}
                                </h3>
                                {isNext && (
                                    <span className="text-[10px] font-extrabold bg-blue-600 text-white px-2 py-0.5 rounded-full animate-pulse shadow-sm">
                                        השיעור הבא
                                    </span>
                                )}
                            </div>
                            <div className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                                <DatePicker
                                    date={dateObj}
                                    setDate={(d) => {
                                        if (d) onUpdateSessionDate(session.id, format(d, 'yyyy-MM-dd'))
                                    }}
                                    className="h-auto p-0 text-slate-500 border-none shadow-none hover:bg-transparent hover:text-blue-600 w-auto font-normal justify-start"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {isToday(dateObj) && <span className="text-xs font-bold px-2 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-full">היום</span>}
                            {session.isReplacement && (
                                <button
                                    onClick={() => onDeleteSession(session.id)}
                                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                                    title="מחק שיעור השלמה"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3 mb-4">
                        <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={() => handleStatusChange('present')}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all border",
                                isPresent
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm"
                                    : "bg-slate-50 border-transparent text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-100"
                            )}
                        >
                            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center", isPresent ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400")}>
                                <Check className="w-4 h-4" />
                            </div>
                            הייתי
                        </motion.button>

                        <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={() => handleStatusChange('absent')}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all border",
                                isAbsent
                                    ? "bg-rose-50 border-rose-200 text-rose-700 shadow-sm"
                                    : "bg-slate-50 border-transparent text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100"
                            )}
                        >
                            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center", isAbsent ? "bg-rose-500 text-white" : "bg-slate-200 text-slate-400")}>
                                <X className="w-4 h-4" />
                            </div>
                            חסרתי
                        </motion.button>
                    </div>

                    <AnimatePresence>
                        {isAbsent && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: "easeInOut" }}
                                className="overflow-hidden"
                            >
                                <div className="space-y-3 pt-4 border-t border-slate-100 mt-2">
                                    <div>
                                        <Label className="text-xs text-slate-500 mb-1.5 block font-medium">סיבת היעדרות</Label>
                                        <Select
                                            value={session.attendance?.reason}
                                            onValueChange={handleReasonChange}
                                            dir="rtl"
                                        >
                                            <SelectTrigger className="bg-slate-50 border-slate-200 focus:ring-slate-200 h-9 text-right">
                                                <SelectValue placeholder="בחר סיבה..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {REASONS.map(r => (
                                                    <SelectItem key={r.value} value={r.value} className="text-right pr-8" style={{ direction: "rtl" }}>{r.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-slate-500 mb-1.5 block font-medium">פירוט (אופציונלי)</Label>
                                        <Textarea
                                            value={session.attendance?.details || ""}
                                            onChange={handleDetailsChange}
                                            placeholder="הוסף פרטים..."
                                            className="resize-none bg-slate-50 border-slate-200 focus:ring-slate-200 min-h-[60px]"
                                            rows={2}
                                        />
                                    </div>
                                </div>

                                {/* Show replacement button or replacement info */}
                                <div className="pt-3 pb-1">
                                    {session.replacementSessionId ? (
                                        <div className="w-full py-2 px-3 text-sm font-medium text-orange-700 bg-orange-50 rounded-lg border border-orange-200 flex items-center justify-center gap-2">
                                            <CalendarIcon className="w-4 h-4" />
                                            השלמה נקבעה ל-{replacementSession && format(parseISO(replacementSession.date), 'd בMMMM yyyy', { locale: he })}
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => onScheduleReplacement(session.id)}
                                            disabled={!canAddReplacement}
                                            className={`w-full py-2.5 text-sm font-medium rounded-lg border transition-all flex items-center justify-center gap-2 ${canAddReplacement
                                                ? 'text-orange-700 bg-orange-50 hover:bg-orange-100 border-orange-200 cursor-pointer shadow-sm'
                                                : 'text-slate-400 bg-slate-100 border-slate-200 cursor-not-allowed opacity-70'
                                                }`}
                                            title={
                                                canAddReplacement
                                                    ? 'קבע שיעור השלמה'
                                                    : !thisSessionEligible
                                                        ? 'יש לבחור סיבת היעדרות (לא אישית) כדי לקבוע השלמה'
                                                        : 'הגעת למגבלת ההשלמות'
                                            }
                                        >
                                            <CalendarIcon className="w-4 h-4" />
                                            קבע שיעור השלמה
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Show original event info if this is a replacement */}
                    {session.isReplacement && originalSession && (
                        <div className="mt-3 py-2 px-3 text-xs font-medium text-orange-700 bg-orange-50 rounded-lg border border-orange-200 flex items-center gap-2">
                            <CalendarIcon className="w-3.5 h-3.5" />
                            <span>השלמה עבור שיעור מ-{format(parseISO(originalSession.date), 'd בMMMM yyyy', { locale: he })}</span>
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
                            <AlertDialogAction onClick={confirmDeleteReplacement} className="bg-red-600 hover:bg-red-700 text-white">אישור</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </Card>
        </motion.div>
    )
}
