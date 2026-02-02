import { useState, useEffect } from "react"
import { Calendar as CalendarIcon, LayoutDashboard, Settings } from "lucide-react"
import { addDays, format, parseISO } from "date-fns"
import { DailyView } from "@/components/DailyView"
import { CourseManager } from "@/components/CourseManager"
import { Dashboard } from "@/components/Dashboard"
import { Toaster } from "@/components/ui/toaster"
import { toast } from "@/hooks/use-toast"
import type { Session, Course } from "@/types"
import { cn, uuidv4 } from "@/lib/utils"

function App() {
  const [activeTab, setActiveTab] = useState<'daily' | 'dashboard' | 'courses'>('daily')
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

  // Auto-Save Effect (Debounced or on change)
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
        // Regular deletion
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
    <div className="min-h-screen bg-gray-50 text-foreground font-sans rtl md:flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-l h-screen sticky top-0 shrink-0 shadow-sm z-20">
        <div className="p-6 border-b">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            ניהול חוגים
          </h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab('daily')}
            className={cn("flex items-center gap-3 w-full px-4 py-3 rounded-lg text-lg font-medium transition-colors hover:bg-muted", activeTab === 'daily' ? "bg-primary/10 text-primary" : "text-muted-foreground")}
          >
            <CalendarIcon className="w-5 h-5" />
            <span>יומן</span>
          </button>

          <button
            onClick={() => setActiveTab('dashboard')}
            className={cn("flex items-center gap-3 w-full px-4 py-3 rounded-lg text-lg font-medium transition-colors hover:bg-muted", activeTab === 'dashboard' ? "bg-primary/10 text-primary" : "text-muted-foreground")}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>דשבורד</span>
          </button>

          <button
            onClick={() => setActiveTab('courses')}
            className={cn("flex items-center gap-3 w-full px-4 py-3 rounded-lg text-lg font-medium transition-colors hover:bg-muted", activeTab === 'courses' ? "bg-primary/10 text-primary" : "text-muted-foreground")}
          >
            <Settings className="w-5 h-5" />
            <span>ניהול</span>
          </button>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-h-0">
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b sticky top-0 z-10 px-4 py-3 flex items-center justify-center shadow-sm">
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            ניהול חוגים
          </h1>
        </header>

        {/* Main Content */}
        <main className="p-4 md:p-8 w-full max-w-7xl mx-auto min-h-[calc(100vh-140px)] md:min-h-screen overflow-y-auto">
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
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t safe-area-bottom pb-safe max-w-md mx-auto shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
        <div className="flex justify-around items-center h-16">
          <button
            onClick={() => setActiveTab('daily')}
            className={cn("flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors", activeTab === 'daily' ? "text-primary" : "text-muted-foreground")}
          >
            <CalendarIcon className="w-6 h-6" />
            <span className="text-xs font-medium">יומן</span>
          </button>

          <button
            onClick={() => setActiveTab('dashboard')}
            className={cn("flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors", activeTab === 'dashboard' ? "text-primary" : "text-muted-foreground")}
          >
            <LayoutDashboard className="w-6 h-6" />
            <span className="text-xs font-medium">דשבורד</span>
          </button>

          <button
            onClick={() => setActiveTab('courses')}
            className={cn("flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors", activeTab === 'courses' ? "text-primary" : "text-muted-foreground")}
          >
            <Settings className="w-6 h-6" />
            <span className="text-xs font-medium">ניהול</span>
          </button>
        </div>
      </nav>
      <Toaster />
    </div>
  )
}

export default App
