import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Calendar as CalendarIcon, LayoutDashboard, Settings } from "lucide-react"
import { addDays, format, parseISO } from "date-fns"
import { DailyView } from "@/components/DailyView"
import { Dashboard } from "@/components/Dashboard"
import { CourseManager } from "@/components/CourseManager"
import { Toaster } from "@/components/ui/toaster"
import { toast } from "@/hooks/use-toast"
import { cn, uuidv4 } from "@/lib/utils"
import type { Session, Course } from "@/types"
import { ModeToggle } from "@/components/mode-toggle"

function App() {
  const [activeTab, setActiveTab] = useState<'daily' | 'dashboard' | 'courses'>('dashboard')

  /* API Sync Logic */
  const [courses, setCourses] = useState<Course[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  // Initial Fetch
  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .then(data => {
        setCourses(data.courses || [])
        setSessions(data.sessions || [])
        setLoading(false)
      })
      .catch(err => {
        console.error("Failed to fetch data:", err)
        setLoading(false)
      })
  }, [])

  // Auto-Save Effect
  useEffect(() => {
    if (loading) return
    const saveData = async () => {
      try {
        await fetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courses, sessions })
        })
      } catch (err) {
        console.error("Failed to save data", err)
      }
    }
    const timeout = setTimeout(saveData, 500)
    return () => clearTimeout(timeout)
  }, [courses, sessions, loading])

  const handleAddCourse = (course: Course) => {
    try {
      setCourses([...courses, course])
      const newSessions: Session[] = []
      const start = parseISO(course.startDate)

      let currentDate = start
      let sessionsAdded = 0
      let safetyCounter = 0
      const maxIterations = 365

      while (safetyCounter < maxIterations) {
        if (course.totalLessons && sessionsAdded >= course.totalLessons) break
        if (course.endDate && format(currentDate, 'yyyy-MM-dd') > course.endDate) break

        if (course.daysOfWeek.includes(currentDate.getDay())) {
          newSessions.push({
            id: uuidv4(),
            courseId: course.id,
            courseName: course.name,
            date: format(currentDate, 'yyyy-MM-dd'),
          })
          sessionsAdded++
        }
        currentDate = addDays(currentDate, 1)
        safetyCounter++
      }
      setSessions(prev => [...prev, ...newSessions])

      toast({
        variant: "success",
        title: "החוג נוצר בהצלחה",
        description: `נוצרו ${sessionsAdded} שיעורים עבור ${course.name}`,
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "שגיאה ביצירת חוג",
        description: "אירעה שגיאה בעת יצירת החוג. נסה שוב.",
      })
    }
  }

  const handleDeleteCourse = (id: string) => {
    const courseToDelete = courses.find(c => c.id === id)
    setCourses(courses.filter(c => c.id !== id))
    setSessions(sessions.filter(s => s.courseId !== id))

    if (courseToDelete) {
      toast({
        variant: "success",
        title: "החוג נמחק",
        description: `${courseToDelete.name} נמחק בהצלחה`,
      })
    }
  }

  const handleEditCourse = (updatedCourse: Course) => {
    const oldCourse = courses.find(c => c.id === updatedCourse.id)
    if (!oldCourse) return

    // Update the course
    setCourses(courses.map(c => c.id === updatedCourse.id ? updatedCourse : c))

    const today = format(new Date(), 'yyyy-MM-dd')

    // Check what changed
    const daysChanged = JSON.stringify(oldCourse.daysOfWeek.sort()) !== JSON.stringify(updatedCourse.daysOfWeek.sort())
    const lessonsChanged = oldCourse.totalLessons !== updatedCourse.totalLessons
    const endDateChanged = oldCourse.endDate !== updatedCourse.endDate

    if (lessonsChanged && updatedCourse.totalLessons) {
      // Rebuild all events (excluding replacement events)
      const newSessions: Session[] = []
      const start = parseISO(updatedCourse.startDate)

      let currentDate = start
      let sessionsAdded = 0
      let safetyCounter = 0
      const maxIterations = 365

      while (safetyCounter < maxIterations && sessionsAdded < updatedCourse.totalLessons) {
        if (updatedCourse.daysOfWeek.includes(currentDate.getDay())) {
          newSessions.push({
            id: uuidv4(),
            courseId: updatedCourse.id,
            courseName: updatedCourse.name,
            date: format(currentDate, 'yyyy-MM-dd'),
          })
          sessionsAdded++
        }
        currentDate = addDays(currentDate, 1)
        safetyCounter++
      }

      // Replace all non-replacement sessions with new ones
      setSessions(prev => [
        ...prev.filter(s => s.courseId !== updatedCourse.id || s.isReplacement),
        ...newSessions
      ])
    } else if (daysChanged) {
      // Rebuild events from today forward, keep past events unchanged
      const pastSessions = sessions.filter(s => s.courseId === updatedCourse.id && s.date < today)
      const newSessions: Session[] = []

      let currentDate = parseISO(today)
      let sessionsAdded = 0
      let safetyCounter = 0
      const maxIterations = 365

      while (safetyCounter < maxIterations) {
        if (updatedCourse.totalLessons && (sessionsAdded + pastSessions.length) >= updatedCourse.totalLessons) break
        if (updatedCourse.endDate && format(currentDate, 'yyyy-MM-dd') > updatedCourse.endDate) break

        if (updatedCourse.daysOfWeek.includes(currentDate.getDay())) {
          newSessions.push({
            id: uuidv4(),
            courseId: updatedCourse.id,
            courseName: updatedCourse.name,
            date: format(currentDate, 'yyyy-MM-dd'),
          })
          sessionsAdded++
        }
        currentDate = addDays(currentDate, 1)
        safetyCounter++
      }

      // Keep past sessions, replacement sessions, and add new future sessions
      setSessions(prev => [
        ...prev.filter(s => s.courseId !== updatedCourse.id || s.date < today || s.isReplacement),
        ...newSessions
      ])
    } else if (endDateChanged && updatedCourse.endDate) {
      // Delete all events after the new end date (except replacement events)
      setSessions(prev => prev.filter(s =>
        s.courseId !== updatedCourse.id ||
        s.date <= updatedCourse.endDate! ||
        s.isReplacement
      ))

      // Update course name in remaining sessions if it changed
      if (oldCourse.name !== updatedCourse.name) {
        setSessions(prev => prev.map(s =>
          s.courseId === updatedCourse.id ? { ...s, courseName: updatedCourse.name } : s
        ))
      }
    } else {
      // Only name changed, update session names
      if (oldCourse.name !== updatedCourse.name) {
        setSessions(prev => prev.map(s =>
          s.courseId === updatedCourse.id ? { ...s, courseName: updatedCourse.name } : s
        ))
      }
    }
  }

  const handleUpdateAttendance = (sessionId: string, data: Session['attendance']) => {
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        const newSession = { ...s }
        if (data === undefined) {
          delete newSession.attendance
          // Preserve replacementSessionId even when clearing attendance
        } else {
          newSession.attendance = data
        }
        return newSession
      }
      return s
    }))
  }

  const handleScheduleReplacement = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId)
    if (!session) return

    const course = courses.find(c => c.id === session.courseId)
    if (!course) return

    // Find the latest session for this course
    const courseSessions = sessions.filter(s => s.courseId === session.courseId)
    const sortedDates = courseSessions.map(s => s.date).sort((a, b) => b.localeCompare(a))
    const lastDateStr = sortedDates[0]
    let currentDate = addDays(parseISO(lastDateStr), 1)

    // Find next valid day
    let found = false
    let safetyCounter = 0
    while (!found && safetyCounter < 100) {
      if (course.daysOfWeek.includes(currentDate.getDay())) {
        const replacementId = uuidv4()
        const newSession: Session = {
          id: replacementId,
          courseId: course.id,
          courseName: course.name,
          date: format(currentDate, 'yyyy-MM-dd'),
          isReplacement: true,
          replacementForSessionId: sessionId
        }

        // Update the original session to link to the replacement
        setSessions(prev => [
          ...prev.map(s => s.id === sessionId ? { ...s, replacementSessionId: replacementId } : s),
          newSession
        ])

        toast({
          variant: "success",
          title: "שיעור השלמה נקבע",
          description: `שיעור ההשלמה נקבע ל-${format(currentDate, 'd/M/yyyy')}`,
        })
        found = true
      }
      currentDate = addDays(currentDate, 1)
      safetyCounter++
    }
  }

  const handleUpdateSessionDate = (sessionId: string, newDate: string) => {
    setSessions(sessions.map(s => s.id === sessionId ? { ...s, date: newDate } : s))
  }

  const handleDeleteSession = (sessionId: string) => {
    const sessionToDelete = sessions.find(s => s.id === sessionId)

    if (sessionToDelete) {
      // If deleting a replacement, clear the link from the original session
      if (sessionToDelete.replacementForSessionId) {
        setSessions(prev =>
          prev
            .filter(s => s.id !== sessionId)
            .map(s => s.id === sessionToDelete.replacementForSessionId
              ? { ...s, replacementSessionId: undefined }
              : s
            )
        )
        toast({
          variant: "success",
          title: "שיעור ההשלמה נמחק",
        })
      } else {
        setSessions(sessions.filter(s => s.id !== sessionId))
        toast({
          variant: "success",
          title: "השיעור נמחק",
        })
      }
    } else {
      setSessions(sessions.filter(s => s.id !== sessionId))
    }
  }


  return (
    <div className="flex bg-background text-foreground font-sans rtl min-h-screen">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-l border-border h-screen sticky top-0 z-20 shadow-sm">
        <div className="p-6 border-b border-border">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            ניהול חוגים
          </h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <MenuButton
            active={activeTab === 'daily'}
            onClick={() => setActiveTab('daily')}
            icon={CalendarIcon}
            label="יומן"
          />
          <MenuButton
            active={activeTab === 'dashboard'}
            onClick={() => setActiveTab('dashboard')}
            icon={LayoutDashboard}
            label="דשבורד"
          />
          <MenuButton
            active={activeTab === 'courses'}
            onClick={() => setActiveTab('courses')}
            icon={Settings}
            label="ניהול"
          />
        </nav>
        <div className="p-4 border-t border-border flex flex-col items-center gap-4">
          <ModeToggle />
          <span className="text-xs text-muted-foreground">v{__APP_VERSION__}</span>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden bg-background/80 backdrop-blur-md border-b border-border sticky top-0 z-20 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="w-10" /> {/* Spacer for centering if needed, or simply justify-between */}
          <div className="flex flex-row items-baseline gap-2">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              ניהול חוגים
            </h1>
            <span className="text-[10px] font-normal text-muted-foreground">
              v{__APP_VERSION__}
            </span>
          </div>
          <ModeToggle />
        </header>

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto scrollbar-hide p-4 md:p-8 pb-24 md:pb-8">
          <div className="max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'daily' && (
                  <DailyView
                    sessions={sessions}
                    courses={courses}
                    onUpdateAttendance={handleUpdateAttendance}
                    onScheduleReplacement={handleScheduleReplacement}
                    onUpdateSessionDate={handleUpdateSessionDate}
                    onDeleteSession={handleDeleteSession}
                  />
                )}
                {activeTab === 'dashboard' && (
                  <Dashboard sessions={sessions} />
                )}
                {activeTab === 'courses' && (
                  <CourseManager courses={courses} onAddCourse={handleAddCourse} onEditCourse={handleEditCourse} onDeleteCourse={handleDeleteCourse} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-md border-t border-border safe-area-bottom pb-safe z-30">
        <div className="flex justify-around items-center h-16">
          <MobileNavButton
            active={activeTab === 'daily'}
            onClick={() => setActiveTab('daily')}
            icon={CalendarIcon}
            label="יומן"
          />
          <MobileNavButton
            active={activeTab === 'dashboard'}
            onClick={() => setActiveTab('dashboard')}
            icon={LayoutDashboard}
            label="דשבורד"
          />
          <MobileNavButton
            active={activeTab === 'courses'}
            onClick={() => setActiveTab('courses')}
            icon={Settings}
            label="ניהול"
          />
        </div>
      </nav>
      <Toaster />
    </div>
  )
}

function MenuButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full px-4 py-3 rounded-lg text-lg font-medium transition-all duration-200",
        active
          ? "bg-primary/10 text-primary shadow-sm border border-primary/20"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <Icon className={cn("w-5 h-5", active && "stroke-[2.5px]")} />
      <span>{label}</span>
      {active && <motion.div layoutId="activeDesk" className="absolute left-0 w-1 h-6 bg-primary rounded-r-full" />}
    </motion.button>
  )
}

function MobileNavButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center w-full h-full space-y-1 relative",
        active ? "text-primary" : "text-muted-foreground"
      )}
    >
      <div className={cn(
        "p-1.5 rounded-full transition-all duration-300",
        active ? "bg-primary/10" : "bg-transparent"
      )}>
        <Icon className={cn("w-6 h-6", active && "stroke-2")} />
      </div>
      <span className="text-[10px] font-medium">{label}</span>
      {active && (
        <motion.div
          layoutId="activeTabMobile"
          className="absolute -top-1 w-1 h-1 bg-primary rounded-full"
        />
      )}
    </motion.button>
  )
}

export default App
