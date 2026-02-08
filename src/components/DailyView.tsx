import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Calendar as CalendarIcon, Filter } from "lucide-react"
import { format } from "date-fns"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { Session, Course } from "@/types"
import { AttendanceCard } from "@/components/AttendanceCard"

interface DailyViewProps {
    sessions: Session[]
    courses: Course[]
    onUpdateAttendance: (sessionId: string, data: Session['attendance']) => void
    onScheduleReplacement: (sessionId: string) => void
    onUpdateSessionDate: (sessionId: string, newDate: string) => void
    onDeleteSession: (sessionId: string) => void

    // Filter Props
    showFuture: boolean
    setShowFuture: (v: boolean) => void
    selectedCourseId: string
    setSelectedCourseId: (v: string) => void
    eventTypeFilter: 'all' | 'missed' | 'replacement'
    setEventTypeFilter: (v: 'all' | 'missed' | 'replacement') => void
    isFiltersOpen: boolean
    setIsFiltersOpen: (v: boolean) => void
}


export function DailyView({
    sessions,
    courses,
    onUpdateAttendance,
    onScheduleReplacement,
    onUpdateSessionDate,
    onDeleteSession,
    showFuture,
    setShowFuture,
    selectedCourseId,
    setSelectedCourseId,
    eventTypeFilter,
    setEventTypeFilter,
    isFiltersOpen,
    setIsFiltersOpen
}: DailyViewProps) {

    // Draft state for filter modal (using props as initial)
    const [draftShowFuture, setDraftShowFuture] = React.useState(showFuture)
    const [draftSelectedCourseId, setDraftSelectedCourseId] = React.useState(selectedCourseId)
    const [draftEventTypeFilter, setDraftEventTypeFilter] = React.useState(eventTypeFilter)

    // Sync draft state when modal opens
    React.useEffect(() => {
        if (isFiltersOpen) {
            setDraftShowFuture(showFuture)
            setDraftSelectedCourseId(selectedCourseId)
            setDraftEventTypeFilter(eventTypeFilter)
        }
    }, [isFiltersOpen, showFuture, selectedCourseId, eventTypeFilter])

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
        <div className="h-full flex flex-col bg-background">
            {/* Header */}
            <header className="flex-none relative z-20 flex items-center justify-between px-3 py-1 bg-background border-b border-border shadow-[0_1px_2px_0_rgba(0,0,0,0.05)] md:hidden">
                <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg px-2">יומן שיעורים</h3>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsFiltersOpen(true)}
                    className="hover:bg-accent/50 transition-colors relative h-8 w-8"
                >
                    <div className="relative">
                        <Filter className="w-5 h-5" />
                        {(eventTypeFilter !== 'all' || selectedCourseId !== 'all' || showFuture) && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-background" />
                        )}
                    </div>
                </Button>
            </header>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 space-y-6">
                <motion.div layout className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    <AnimatePresence mode="popLayout">
                        {sortedSessions.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="col-span-full text-center py-10 text-muted-foreground flex flex-col items-center justify-center gap-4"
                            >
                                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-2">
                                    <CalendarIcon className="w-8 h-8 opacity-40" />
                                </div>
                                <div className="space-y-1">
                                    <p className="font-medium text-lg">לא נמצאו שיעורים</p>
                                    <p className="text-sm opacity-60">נסה לשנות את סינון החיפוש</p>
                                </div>
                                {(eventTypeFilter !== 'all' || selectedCourseId !== 'all') && (
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setEventTypeFilter('all')
                                            setSelectedCourseId('all')
                                            setShowFuture(false)
                                        }}
                                        className="mt-2"
                                    >
                                        נקה סינון
                                    </Button>
                                )}
                            </motion.div>
                        ) : (
                            sortedSessions.map((session) => (
                                <AttendanceCard
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

            {/* Filter Modal */}
            <Dialog open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
                <DialogContent className="w-full h-full max-w-none max-h-none rounded-none p-4 gap-6 flex flex-col justify-start md:grid md:w-auto md:h-auto md:max-w-xl md:max-h-[90vh] md:rounded-lg md:p-6 md:gap-4 overflow-y-auto" dir="rtl">
                    <DialogHeader className="text-right space-y-2">
                        <DialogTitle className="text-xl">סינון ותצוגה</DialogTitle>
                    </DialogHeader>

                    <FilterContent
                        courses={courses}
                        draftShowFuture={draftShowFuture}
                        setDraftShowFuture={setDraftShowFuture}
                        draftSelectedCourseId={draftSelectedCourseId}
                        setDraftSelectedCourseId={setDraftSelectedCourseId}
                        draftEventTypeFilter={draftEventTypeFilter}
                        setDraftEventTypeFilter={setDraftEventTypeFilter}
                        onApply={() => {
                            setShowFuture(draftShowFuture)
                            setSelectedCourseId(draftSelectedCourseId)
                            setEventTypeFilter(draftEventTypeFilter)
                            setIsFiltersOpen(false)
                        }}
                        onCancel={() => setIsFiltersOpen(false)}
                    />
                </DialogContent>
            </Dialog>
        </div>
    )
}

function FilterContent({
    courses,
    draftShowFuture,
    setDraftShowFuture,
    draftSelectedCourseId,
    setDraftSelectedCourseId,
    draftEventTypeFilter,
    setDraftEventTypeFilter,
    onApply,
    onCancel
}: {
    courses: Course[],
    draftShowFuture: boolean,
    setDraftShowFuture: (v: boolean) => void,
    draftSelectedCourseId: string,
    setDraftSelectedCourseId: (v: string) => void,
    draftEventTypeFilter: 'all' | 'missed' | 'replacement',
    setDraftEventTypeFilter: (v: 'all' | 'missed' | 'replacement') => void,
    onApply: () => void,
    onCancel: () => void
}) {
    return (
        <div className="grid gap-6 py-4">
            {/* Course Filter */}
            <div className="space-y-2">
                <Label className="text-right block">סינון לפי חוג</Label>
                <Select value={draftSelectedCourseId} onValueChange={setDraftSelectedCourseId} dir="rtl">
                    <SelectTrigger className="text-right bg-muted/30">
                        <SelectValue placeholder="בחר חוג" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all" className="text-right pr-8">כל החוגים</SelectItem>
                        {courses.map(course => (
                            <SelectItem key={course.id} value={course.id} className="text-right pr-8">{course.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Event Type Filter */}
            <div className="space-y-2">
                <Label className="text-right block">סוג אירוע</Label>
                <Select value={draftEventTypeFilter} onValueChange={(value) => setDraftEventTypeFilter(value as 'all' | 'missed' | 'replacement')} dir="rtl">
                    <SelectTrigger className="text-right bg-muted/30">
                        <SelectValue placeholder="בחר סוג" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all" className="text-right pr-8">כל האירועים</SelectItem>
                        <SelectItem value="missed" className="text-right pr-8">רק חיסורים</SelectItem>
                        <SelectItem value="replacement" className="text-right pr-8">רק השלמות</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Future Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 gap-4">
                <Label htmlFor="future-mode" className="cursor-pointer">הצג שיעורים עתידיים</Label>
                <Switch
                    id="future-mode"
                    checked={draftShowFuture}
                    onCheckedChange={setDraftShowFuture}
                />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-4">
                <Button variant="outline" className="flex-1" onClick={onCancel}>
                    ביטול
                </Button>
                <Button className="flex-1 font-bold" onClick={onApply}>
                    אישור
                </Button>
            </div>
        </div>
    )
}

