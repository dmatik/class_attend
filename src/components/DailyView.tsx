import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Calendar as CalendarIcon, Filter, ChevronDown, ChevronUp } from "lucide-react"
import { format } from "date-fns"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import type { Session, Course } from "@/types"
import { cn } from "@/lib/utils"
import { AttendanceCard } from "@/components/AttendanceCard"

interface DailyViewProps {
    sessions: Session[]
    courses: Course[]
    onUpdateAttendance: (sessionId: string, data: Session['attendance']) => void
    onScheduleReplacement: (sessionId: string) => void
    onUpdateSessionDate: (sessionId: string, newDate: string) => void
    onDeleteSession: (sessionId: string) => void
}


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

    // New state for mobile filters
    const [isFiltersOpen, setIsFiltersOpen] = React.useState(false)

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
            {/* Filter Section */}
            <div className="sticky top-0 z-10 mb-4">
                {/* Mobile Toggle */}
                <button
                    onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                    className="md:hidden w-full flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-slate-200 mb-2 transition-colors active:bg-slate-50"
                >
                    <div className="flex items-center gap-2 font-medium text-slate-700">
                        <Filter className="w-4 h-4" />
                        <span>סינון ותצוגה</span>
                    </div>
                    {isFiltersOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>

                {/* Collapsible Container */}
                <div className={cn(
                    "bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-300 ease-in-out",
                    !isFiltersOpen ? "max-h-0 opacity-0 border-none md:max-h-[200px] md:opacity-100 md:border-slate-200 md:border" : "max-h-[500px] opacity-100"
                )}>
                    <div className="p-4 flex flex-col md:flex-row gap-4 md:items-center md:justify-start">
                        <div className="w-full md:w-[200px]">
                            <Select value={selectedCourseId} onValueChange={setSelectedCourseId} dir="rtl">
                                <SelectTrigger className="text-right bg-slate-50 border-slate-200 focus:ring-slate-200">
                                    <SelectValue placeholder="סנן לפי חוג" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all" className="text-right pr-8">כל החוגים</SelectItem>
                                    {courses.map(course => (
                                        <SelectItem key={course.id} value={course.id} className="text-right pr-8">{course.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-full md:w-[200px]">
                            <Select value={eventTypeFilter} onValueChange={(value) => setEventTypeFilter(value as 'all' | 'missed' | 'replacement')} dir="rtl">
                                <SelectTrigger className="text-right bg-slate-50 border-slate-200 focus:ring-slate-200">
                                    <SelectValue placeholder="סנן לפי סוג" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all" className="text-right pr-8">כל האירועים</SelectItem>
                                    <SelectItem value="missed" className="text-right pr-8">רק חיסורים</SelectItem>
                                    <SelectItem value="replacement" className="text-right pr-8">רק השלמות</SelectItem>
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
                    </div>
                </div>
            </div>

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
    )
}

