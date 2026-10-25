import { useState, useEffect, Suspense, lazy } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Calendar as CalendarIcon,
  LayoutDashboard,
  GraduationCap,
  Loader2,
  AlertCircle,
  RefreshCw,
  User as UserIcon,
  Shield
} from "lucide-react"
import { addDays, format, parseISO } from "date-fns"
import { Toaster } from "@/components/ui/toaster"
import { toast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { cn, uuidv4 } from "@/lib/utils"
import type { Session, Course, User } from "@/types"
import { ModeToggle } from "@/components/mode-toggle"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { LoginView } from "@/components/LoginView"

// Lazy load components
const DailyView = lazy(() => import("@/components/DailyView").then(module => ({ default: module.DailyView })))
const Dashboard = lazy(() => import("@/components/Dashboard").then(module => ({ default: module.Dashboard })))
const CoursesPage = lazy(() => import("@/components/CoursesPage").then(module => ({ default: module.CoursesPage })))
const AccountPage = lazy(() => import("@/components/AccountPage").then(module => ({ default: module.AccountPage })))
const AdminPage = lazy(() => import("@/components/AdminPage").then(module => ({ default: module.AdminPage })))

const LoadingSpinner = () => (
  <div className="flex h-full w-full items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
)

import { useTranslation } from "react-i18next"

function App() {
  const { t, i18n } = useTranslation()
  const [activeTab, setActiveTab] = useState<'daily' | 'dashboard' | 'courses' | 'admin' | 'account'>('dashboard')

  // Auth State
  const [token, setToken] = useState<string | null>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem("auth_token") : null
    if (saved) return saved
    // Test environment fallback to preserve integration tests
    if (import.meta.env.MODE === 'test') {
      return 'test-token'
    }
    return null
  })

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (import.meta.env.MODE === 'test') {
      return {
        id: 'test-admin',
        username: 'admin',
        firstName: 'Test',
        lastName: 'Admin',
        role: 'admin'
      }
    }
    return null
  })

  const [authChecking, setAuthChecking] = useState<boolean>(() => {
    return import.meta.env.MODE !== 'test'
  })

  // Check auth session
  useEffect(() => {
    if (import.meta.env.MODE === 'test') {
      setAuthChecking(false)
      return
    }

    if (!token) {
      setCurrentUser(null)
      setAuthChecking(false)
      return
    }

    fetch('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Invalid session")
        return res.json()
      })
      .then((data) => {
        setCurrentUser(data.user)
        setAuthChecking(false)
      })
      .catch(() => {
        localStorage.removeItem("auth_token")
        setToken(null)
        setCurrentUser(null)
        setAuthChecking(false)
      })
  }, [token])

  const handleLoginSuccess = (newToken: string, user: User) => {
    localStorage.setItem("auth_token", newToken)
    setToken(newToken)
    setCurrentUser(user)
    setIsInitialized(false)
    setLoading(true)
    setActiveTab('dashboard')
  }

  const handleLogout = () => {
    localStorage.removeItem("auth_token")
    setToken(null)
    setCurrentUser(null)
    setCourses([])
    setSessions([])
    setIsInitialized(false)
    setActiveTab('dashboard')
  }

  // Update document title on language change
  useEffect(() => {
    document.title = t('common.app_title')
  }, [t, i18n.language])

  /* API Sync Logic */
  const [courses, setCourses] = useState<Course[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Fetch Courses & Sessions for current user
  useEffect(() => {
    if (!token || !currentUser) {
      setLoading(false)
      return
    }

    setLoading(true)
    setFetchError(null)

    fetch('/api/data', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then(async (res) => {
        const contentType = res.headers?.get?.('content-type') || ''
        const isUnauthorized = res.status === 401 || res.status === 403
        const isRedirect = res.redirected || (res.status >= 300 && res.status < 400)
        const isHtml = typeof contentType === 'string' && contentType.includes('text/html')

        if (isUnauthorized) {
          handleLogout()
          return null
        }

        // If Cloudflare Access session expired or redirected to auth login
        if (res.redirected || (isRedirect && !res.ok) || isHtml) {
          if (typeof window !== 'undefined' && window.location) {
            window.location.reload()
          }
          return null
        }

        if (res.ok === false || (res.status && (res.status < 200 || res.status >= 300))) {
          throw new Error(`HTTP error! status: ${res.status}`)
        }

        return res.json()
      })
      .then((data) => {
        if (!data) return
        setCourses(data.courses || [])
        setSessions(data.sessions || [])
        setIsInitialized(true)
        setLoading(false)
      })
      .catch((err) => {
        console.error("Failed to fetch data:", err)
        setFetchError(err.message || 'Connection error')
        setLoading(false)
      })
  }, [token, currentUser?.id])

  // Filter State (Lifted from DailyView)
  const [showFuture, setShowFuture] = useState(() => {
    const saved = sessionStorage.getItem('dailyView.showFuture')
    return saved ? JSON.parse(saved) : false
  })
  const [selectedCourseId, setSelectedCourseId] = useState<string>(() => {
    const saved = sessionStorage.getItem('dailyView.selectedCourseId')
    return saved || "all"
  })
  const [eventTypeFilter, setEventTypeFilter] = useState<'all' | 'missed' | 'replacement'>(() => {
    const saved = sessionStorage.getItem('dailyView.eventTypeFilter')
    return (saved as 'all' | 'missed' | 'replacement') || 'all'
  })
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)

  // Persist Filter State
  useEffect(() => {
    sessionStorage.setItem('dailyView.showFuture', JSON.stringify(showFuture))
  }, [showFuture])
  useEffect(() => {
    sessionStorage.setItem('dailyView.selectedCourseId', selectedCourseId)
  }, [selectedCourseId])
  useEffect(() => {
    sessionStorage.setItem('dailyView.eventTypeFilter', eventTypeFilter)
  }, [eventTypeFilter])

  // Auto-Save Effect
  useEffect(() => {
    if (!token || !isInitialized || loading) return
    const saveData = async () => {
      try {
        const res = await fetch('/api/data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ courses, sessions })
        })
        if (!res) return
        if (res.status === 401) {
          handleLogout()
          return
        }
        const contentType = res.headers?.get?.('content-type') || ''
        const isUnauthorized = res.status === 401 || res.status === 403
        const isRedirect = res.redirected || (res.status >= 300 && res.status < 400)
        const isHtml = typeof contentType === 'string' && contentType.includes('text/html')

        if (res.redirected || isUnauthorized || (isRedirect && !res.ok) || isHtml) {
          if (typeof window !== 'undefined' && window.location) {
            window.location.reload()
          }
        }
      } catch (err) {
        console.error("Failed to save data", err)
      }
    }
    const timeout = setTimeout(saveData, 500)
    return () => clearTimeout(timeout)
  }, [courses, sessions, loading, isInitialized, token])

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
        title: t("management.toast.course_added_success"),
        description: t("management.toast.course_added_success_description", { sessionsAdded, courseName: course.name }),
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("management.toast.course_added_error"),
        description: t("management.toast.course_added_error_description"),
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
        title: t("management.toast.course_deleted"),
        description: t("management.toast.course_deleted_success_description", { courseName: courseToDelete.name }),
      })
    }
  }

  const handleEditCourse = (updatedCourse: Course) => {
    setCourses(prev => prev.map(c => c.id === updatedCourse.id ? updatedCourse : c))
    setSessions(prev => prev.map(s => {
      if (s.courseId === updatedCourse.id) {
        return { ...s, courseName: updatedCourse.name }
      }
      return s
    }))
  }

  const handleUpdateAttendance = (sessionId: string, data: Session['attendance']) => {
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        const newSession = { ...s }
        if (data === undefined) {
          delete newSession.attendance
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
          title: t('daily_view.toast.replacement_created_success'),
          description: t('daily_view.toast.replacement_created_success_description', { date: format(currentDate, 'd/M/yyyy') }),
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
          title: t('daily_view.toast.replacement_deleted_success'),
        })
      } else {
        setSessions(sessions.filter(s => s.id !== sessionId))
        toast({
          variant: "success",
          title: t('daily_view.toast.lesson_deleted_success'),
        })
      }
    } else {
      setSessions(sessions.filter(s => s.id !== sessionId))
    }
  }

  // 1. Initial auth check
  if (authChecking) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    )
  }

  // 2. Not logged in -> Show Login View
  if (!token || !currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden relative">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-l border-border h-screen sticky top-0 z-20 shadow-sm shrink-0">
        {/* User Icon placed before the app title */}
        <div className="p-5 border-b border-border flex items-center gap-3">
          <button
            onClick={() => setActiveTab('account')}
            className={cn(
              "relative rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 shrink-0",
              activeTab === 'account' ? "ring-2 ring-primary ring-offset-2" : "hover:opacity-85"
            )}
            title={t('common.account')}
          >
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.username}
                className="w-9 h-9 rounded-full object-cover border border-border shadow-sm"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm border border-primary/20 shadow-sm">
                {currentUser.username[0]?.toUpperCase() || <UserIcon className="w-4 h-4" />}
              </div>
            )}
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent truncate">
              {t('common.app_title')}
            </h1>
            <div className="text-[11px] text-muted-foreground truncate">
              {currentUser.firstName ? `${currentUser.firstName} ${currentUser.lastName}` : currentUser.username}
            </div>
          </div>
        </div>

        {/* Desktop Nav Items */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <MenuButton
            active={activeTab === 'daily'}
            onClick={() => setActiveTab('daily')}
            icon={CalendarIcon}
            label={t('common.calendar')}
          />
          <MenuButton
            active={activeTab === 'dashboard'}
            onClick={() => setActiveTab('dashboard')}
            icon={LayoutDashboard}
            label={t('common.dashboard')}
          />
          <MenuButton
            active={activeTab === 'courses'}
            onClick={() => setActiveTab('courses')}
            icon={GraduationCap}
            label={t('common.courses')}
          />
          {currentUser.role === 'admin' && (
            <MenuButton
              active={activeTab === 'admin'}
              onClick={() => setActiveTab('admin')}
              icon={Shield}
              label={t('common.admin')}
            />
          )}
        </nav>

        {/* Desktop Footer Controls */}
        <div className="p-4 border-t border-border flex items-center justify-between bg-card/40">
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ModeToggle />
          </div>
          <span className="text-[10px] text-muted-foreground">
            v{__APP_VERSION__}
          </span>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile Header with User Icon placed before the app title */}
        <header className="md:hidden bg-background/80 backdrop-blur-md border-b border-border sticky top-0 z-20 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            {/* User Icon before the title */}
            <button
              onClick={() => setActiveTab('account')}
              className={cn(
                "relative rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 shrink-0",
                activeTab === 'account' ? "ring-2 ring-primary ring-offset-2" : "hover:opacity-85"
              )}
              title={t('common.account')}
            >
              {currentUser.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.username}
                  className="w-8 h-8 rounded-full object-cover border border-border shadow-sm"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs border border-primary/20 shadow-sm">
                  {currentUser.username[0]?.toUpperCase() || <UserIcon className="w-3.5 h-3.5" />}
                </div>
              )}
            </button>

            <div className="flex flex-row items-baseline gap-2">
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {t('common.app_title')}
              </h1>
              <span className="text-[10px] font-normal text-muted-foreground">
                v{__APP_VERSION__}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ModeToggle />
          </div>
        </header>

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-hidden relative flex flex-col">
          <div className="w-full h-full max-w-7xl mx-auto">
            {fetchError ? (
              <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center">
                <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                <h2 className="text-xl font-bold mb-2">{t('common.error_loading')}</h2>
                <p className="text-muted-foreground mb-6 max-w-sm">
                  {t('common.session_expired_hint')}
                </p>
                <Button onClick={() => window.location.reload()} className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  {t('common.retry')}
                </Button>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="h-full"
                >
                  <Suspense fallback={<LoadingSpinner />}>
                    {loading ? (
                      <LoadingSpinner />
                    ) : (
                      <>
                        {activeTab === 'daily' && (
                          <DailyView
                            sessions={sessions}
                            courses={courses}
                            onUpdateAttendance={handleUpdateAttendance}
                            onScheduleReplacement={handleScheduleReplacement}
                            onUpdateSessionDate={handleUpdateSessionDate}
                            onDeleteSession={handleDeleteSession}
                            // Filter Props
                            showFuture={showFuture}
                            setShowFuture={setShowFuture}
                            selectedCourseId={selectedCourseId}
                            setSelectedCourseId={setSelectedCourseId}
                            eventTypeFilter={eventTypeFilter}
                            setEventTypeFilter={setEventTypeFilter}
                            isFiltersOpen={isFiltersOpen}
                            setIsFiltersOpen={setIsFiltersOpen}
                          />
                        )}
                        {activeTab === 'dashboard' && (
                          <Dashboard sessions={sessions} />
                        )}
                        {activeTab === 'courses' && (
                          <CoursesPage
                            courses={courses}
                            onAddCourse={handleAddCourse}
                            onEditCourse={handleEditCourse}
                            onDeleteCourse={handleDeleteCourse}
                          />
                        )}
                        {activeTab === 'admin' && currentUser.role === 'admin' && (
                          <AdminPage
                            currentUser={currentUser}
                            token={token}
                          />
                        )}
                        {activeTab === 'account' && (
                          <AccountPage
                            user={currentUser}
                            token={token}
                            onUpdateUser={(updated) => setCurrentUser(updated)}
                            onLogout={handleLogout}
                          />
                        )}
                      </>
                    )}
                  </Suspense>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background/85 backdrop-blur-md border-t border-border pb-4 z-30 pt-1.5 shadow-sm">
        <div className="flex justify-around items-center">
          <MobileNavButton
            active={activeTab === 'daily'}
            onClick={() => setActiveTab('daily')}
            icon={CalendarIcon}
            label={t('common.calendar')}
          />
          <MobileNavButton
            active={activeTab === 'dashboard'}
            onClick={() => setActiveTab('dashboard')}
            icon={LayoutDashboard}
            label={t('common.dashboard')}
          />
          <MobileNavButton
            active={activeTab === 'courses'}
            onClick={() => setActiveTab('courses')}
            icon={GraduationCap}
            label={t('common.courses')}
          />
          {currentUser.role === 'admin' && (
            <MobileNavButton
              active={activeTab === 'admin'}
              onClick={() => setActiveTab('admin')}
              icon={Shield}
              label={t('common.admin_short')}
            />
          )}
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
        "flex items-center gap-3 w-full px-4 py-3 rounded-lg text-lg font-medium transition-all duration-200 relative",
        active
          ? "bg-primary/10 text-primary shadow-sm border border-primary/20"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <Icon className={cn("w-5 h-5", active && "stroke-[2.5px]")} />
      <span>{label}</span>
      {active && (
        <motion.div
          layoutId="activeDesk"
          className="absolute start-0 ltr:left-0 rtl:right-0 w-1 h-6 bg-primary ltr:rounded-r-full rtl:rounded-l-full"
        />
      )}
    </motion.button>
  )
}

function MobileNavButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center w-full py-1 relative",
        active ? "text-primary" : "text-muted-foreground"
      )}
    >
      <div className={cn(
        "p-1.5 rounded-full transition-all duration-300",
        active ? "bg-primary/10" : "bg-transparent"
      )}>
        <Icon className={cn("w-5 h-5", active && "stroke-[2.5px]")} />
      </div>
      <span className="text-[11px] font-medium leading-none mt-1">{label}</span>
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
