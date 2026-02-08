import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Check, X, Calendar as CalendarIcon, Trash2 } from "lucide-react"
import { format, parseISO, isToday } from "date-fns"
import { he, enUS } from "date-fns/locale"
import { useTranslation } from "react-i18next"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { DatePicker } from "@/components/ui/date-picker"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import type { Session, AbsenceReason } from "@/types"

const REASONS: { value: AbsenceReason; labelKey: string }[] = [
    { value: "personal", labelKey: "reasons.personal" },
    { value: "provider", labelKey: "reasons.provider" },
    { value: "holiday", labelKey: "reasons.holiday" },
    { value: "external", labelKey: "reasons.external" },
    { value: "other", labelKey: "reasons.other" },
]

interface AttendanceCardProps {
    session: Session
    sessions: Session[]
    isNext?: boolean
    onUpdate: (id: string, data: Session['attendance']) => void
    onScheduleReplacement: (id: string) => void
    onUpdateSessionDate: (id: string, d: string) => void
    onDeleteSession: (id: string) => void
}

export function AttendanceCard({ session, sessions, isNext, onUpdate, onScheduleReplacement, onUpdateSessionDate, onDeleteSession }: AttendanceCardProps) {
    const { t, i18n } = useTranslation()
    const dateLocale = i18n.language === 'en' ? enUS : he
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
                "bg-card border-border",
                session.isReplacement ? "border-l-orange-500" :
                    isPresent ? "border-l-emerald-500" :
                        isAbsent ? "border-l-rose-500" : "border-l-slate-300 dark:border-l-slate-700"
            )}>
                <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className={cn("font-bold text-lg",
                                    session.isReplacement ? "text-orange-700 dark:text-orange-400" : "text-foreground"
                                )}>
                                    {session.courseName}
                                    {session.isReplacement && <span className="mr-2 text-xs font-normal text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-950/50 px-2 py-0.5 rounded-full">{t('attendance_card.replacement')}</span>}
                                </h3>
                                {isNext && (
                                    <span className="text-[10px] font-extrabold bg-blue-600 text-white px-2 py-0.5 rounded-full animate-pulse shadow-sm">
                                        {t('attendance_card.next_lesson')}
                                    </span>
                                )}
                            </div>
                            <div className="text-sm text-slate-500 flex items-center gap-1 mt-1">
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
                            {isToday(dateObj) && <span className="text-xs font-bold px-2 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-full">{t('attendance_card.today')}</span>}
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
                                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 shadow-sm"
                                    : "bg-muted/50 border-transparent text-muted-foreground hover:bg-emerald-50 dark:hover:bg-emerald-950/20 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-100 dark:hover:border-emerald-900"
                            )}
                        >
                            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center", isPresent ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground")}>
                                <Check className="w-4 h-4" />
                            </div>
                            {t('attendance_card.i_was_there')}
                        </motion.button>

                        <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={() => handleStatusChange('absent')}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all border",
                                isAbsent
                                    ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 shadow-sm"
                                    : "bg-muted/50 border-transparent text-muted-foreground hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-100 dark:hover:border-rose-900"
                            )}
                        >
                            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center", isAbsent ? "bg-rose-500 text-white" : "bg-muted text-muted-foreground")}>
                                <X className="w-4 h-4" />
                            </div>
                            {t('attendance_card.i_was_absent')}
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
                                <div className="space-y-3 pt-4 border-t border-border mt-2">
                                    <div>
                                        <Label className="text-xs text-muted-foreground mb-1.5 block font-medium">{t('common.reason')}</Label>
                                        <Select
                                            value={session.attendance?.reason || ""}
                                            onValueChange={handleReasonChange}
                                            dir={i18n.dir()}
                                        >
                                            <SelectTrigger className="bg-muted/50 border-input focus:ring-ring h-9 text-start">
                                                <SelectValue placeholder={t('reasons.placeholder')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {REASONS.map(r => (
                                                    <SelectItem key={r.value} value={r.value} className="text-start ps-8 pe-2" style={{ direction: i18n.dir() }}>{t(r.labelKey)}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground mb-1.5 block font-medium">{t('attendance_card.details_label')}</Label>
                                        <Textarea
                                            value={session.attendance?.details || ""}
                                            onChange={handleDetailsChange}
                                            placeholder={t('attendance_card.details_placeholder')}
                                            className="resize-none bg-muted/50 border-input focus:ring-ring min-h-[60px]"
                                            rows={2}
                                        />
                                    </div>
                                </div>

                                {/* Show replacement button or replacement info */}
                                <div className="pt-3 pb-1">
                                    {session.replacementSessionId ? (
                                        <div className="w-full py-2 px-3 text-sm font-medium text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-900 flex items-center justify-center gap-2">
                                            <CalendarIcon className="w-4 h-4" />
                                            {t('attendance_card.replacement_scheduled', { date: replacementSession ? format(parseISO(replacementSession.date), 'd MMMM yyyy', { locale: dateLocale }) : '' })}
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => onScheduleReplacement(session.id)}
                                            disabled={!canAddReplacement}
                                            className={`w-full py-2.5 text-sm font-medium rounded-lg border transition-all flex items-center justify-center gap-2 ${canAddReplacement
                                                ? 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 hover:bg-orange-100 dark:hover:bg-orange-900/40 border-orange-200 dark:border-orange-900 cursor-pointer shadow-sm'
                                                : 'text-muted-foreground bg-muted border-input cursor-not-allowed opacity-70'
                                                }`}
                                            title={
                                                canAddReplacement
                                                    ? t('attendance_card.schedule_replacement')
                                                    : !thisSessionEligible
                                                        ? t('attendance_card.replacement_requirement')
                                                        : t('attendance_card.replacement_limit')
                                            }
                                        >
                                            <CalendarIcon className="w-4 h-4" />
                                            {t('attendance_card.schedule_replacement')}
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Show original event info if this is a replacement */}
                    {session.isReplacement && originalSession && (
                        <div className="mt-3 py-2 px-3 text-xs font-medium text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-900 flex items-center gap-2">
                            <CalendarIcon className="w-3.5 h-3.5" />
                            <span>{t('attendance_card.replacement_for', { date: format(parseISO(originalSession.date), 'd MMMM yyyy', { locale: dateLocale }) })}</span>
                        </div>
                    )}
                </CardContent>

                {/* Confirmation dialog for deleting replacement */}
                <AlertDialog open={showDeleteReplacementAlert} onOpenChange={setShowDeleteReplacementAlert}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t('attendance_card.delete_replacement_title')}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {t('attendance_card.delete_replacement_desc', { date: replacementSession ? format(parseISO(replacementSession.date), 'd MMMM yyyy', { locale: dateLocale }) : '' })}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => {
                                setPendingStatusChange(null)
                                setShowDeleteReplacementAlert(false)
                            }}>{t('common.cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDeleteReplacement} className="bg-red-600 hover:bg-red-700 text-white">{t('common.confirm')}</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </Card>
        </motion.div>
    )
}
