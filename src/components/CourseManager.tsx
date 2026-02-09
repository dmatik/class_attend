import * as React from "react"
import { useTranslation } from "react-i18next"
import { format, parseISO } from "date-fns"
import { DatePicker } from "@/components/ui/date-picker"
import { Trash2, Edit } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { uuidv4 } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Course } from "@/types"

interface CourseManagerProps {
    courses: Course[]
    onAddCourse: (course: Course) => void
    onEditCourse: (course: Course) => void
    onDeleteCourse: (id: string) => void
}



export function CourseManager({ courses, onAddCourse, onEditCourse, onDeleteCourse }: CourseManagerProps) {
    const { t, i18n } = useTranslation()

    const DAYS = [
        { label: t('management.days_of_week_options.sunday'), value: 0 },
        { label: t('management.days_of_week_options.monday'), value: 1 },
        { label: t('management.days_of_week_options.tuesday'), value: 2 },
        { label: t('management.days_of_week_options.wednesday'), value: 3 },
        { label: t('management.days_of_week_options.thursday'), value: 4 },
        { label: t('management.days_of_week_options.friday'), value: 5 },
        { label: t('management.days_of_week_options.saturday'), value: 6 },
    ]
    const DAYS_FULL = [
        { label: t('management.days_of_week_options_full.sunday'), value: 0 },
        { label: t('management.days_of_week_options_full.monday'), value: 1 },
        { label: t('management.days_of_week_options_full.tuesday'), value: 2 },
        { label: t('management.days_of_week_options_full.wednesday'), value: 3 },
        { label: t('management.days_of_week_options_full.thursday'), value: 4 },
        { label: t('management.days_of_week_options_full.friday'), value: 5 },
        { label: t('management.days_of_week_options_full.saturday'), value: 6 },
    ]
    const [isDialogOpen, setIsDialogOpen] = React.useState(false)
    const [editingCourse, setEditingCourse] = React.useState<Course | null>(null)
    const [courseToDelete, setCourseToDelete] = React.useState<Course | null>(null)
    const [name, setName] = React.useState("")
    const [startDate, setStartDate] = React.useState("")

    const [selectedDays, setSelectedDays] = React.useState<number[]>([])
    const [limitType, setLimitType] = React.useState<'date' | 'count'>('count')
    const [endDate, setEndDate] = React.useState("")
    const [lessonCount, setLessonCount] = React.useState<string>("")

    const isFormValid = React.useMemo(() => {
        if (!name.trim()) return false
        if (!startDate) return false
        if (selectedDays.length === 0) return false
        if (limitType === 'date' && !endDate) return false
        if (limitType === 'count' && !lessonCount) return false
        return true
    }, [name, startDate, selectedDays, limitType, endDate, lessonCount])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!name || !startDate || selectedDays.length === 0) return
        // Optional validation for limit
        if (limitType === 'date' && !endDate) return
        if (limitType === 'count' && !lessonCount) return

        if (editingCourse) {
            // Edit mode
            onEditCourse({
                id: editingCourse.id,
                name,
                startDate,
                daysOfWeek: selectedDays,
                endDate: limitType === 'date' ? endDate : undefined,
                totalLessons: limitType === 'count' ? parseInt(lessonCount) : undefined
            })
        } else {
            // Add mode
            onAddCourse({
                id: uuidv4(),
                name,
                startDate,
                daysOfWeek: selectedDays,
                endDate: limitType === 'date' ? endDate : undefined,
                totalLessons: limitType === 'count' ? parseInt(lessonCount) : undefined
            })
        }

        // Reset form
        setName("")
        setStartDate("")
        setSelectedDays([])
        setEndDate("")
        setLessonCount("")
        setEditingCourse(null)
        setIsDialogOpen(false)
    }

    const toggleDay = (day: number) => {
        setSelectedDays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
        )
    }

    const handleEditClick = (course: Course) => {
        setEditingCourse(course)
        setName(course.name)
        setStartDate(course.startDate)
        setSelectedDays(course.daysOfWeek)
        if (course.endDate) {
            setLimitType('date')
            setEndDate(course.endDate)
        } else if (course.totalLessons) {
            setLimitType('count')
            setLessonCount(course.totalLessons.toString())
        }
        setIsDialogOpen(true)
    }

    const handleDialogClose = (open: boolean) => {
        setIsDialogOpen(open)
        if (!open) {
            // Reset form when closing
            setEditingCourse(null)
            setName("")
            setStartDate("")
            setSelectedDays([])
            setEndDate("")
            setLessonCount("")
        }
    }

    const handleDeleteClick = (course: Course) => {
        setCourseToDelete(course)
    }

    const confirmDelete = () => {
        if (courseToDelete) {
            onDeleteCourse(courseToDelete.id)
            setCourseToDelete(null)
        }
    }

    return (
        <div className="h-full overflow-y-auto pb-24 space-y-6 p-4 md:p-8">
            <div className="space-y-4">
                <h3 className="font-semibold text-lg px-2">{t('management.title')}</h3>
                {courses.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">{t('management.no_courses')}</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {courses.map(course => (
                            <Card key={course.id} className="overflow-hidden bg-card border-border shadow-sm hover:shadow-md transition-shadow">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div>
                                        <h4 className="font-bold text-foreground">{course.name}</h4>
                                        <p className="text-sm text-muted-foreground">
                                            {t('management.days')} {course.daysOfWeek.map(d => DAYS_FULL.find(day => day.value === d)?.label).join(', ')}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(course)} className="bg-primary/10 dark:bg-muted/80 text-primary hover:bg-primary/20 dark:hover:bg-muted transition-colors">
                                            <Edit className="w-5 h-5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(course)} className="bg-destructive/10 dark:bg-muted/80 text-destructive dark:text-red-400 hover:bg-destructive/20 dark:hover:bg-muted transition-colors">
                                            <Trash2 className="w-5 h-5" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <Button
                onClick={() => setIsDialogOpen(true)}
                className="w-full md:w-auto text-base font-bold shadow-lg shadow-primary/20 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
                {t('management.add_course_button')}
            </Button>

            <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
                <DialogContent className="w-full h-full max-w-none max-h-none rounded-none p-4 gap-6 flex flex-col justify-start md:grid md:w-auto md:h-auto md:max-w-md md:max-h-[90vh] md:rounded-lg md:p-6 md:gap-4 overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl text-primary">{editingCourse ? t('management.edit_course') : t('management.add_course')}</DialogTitle>
                        <DialogDescription>{editingCourse ? t('management.edit_course_description') : t('management.add_course_description')}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">
                                {t('management.course_name')} <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={t('management.course_name_placeholder')}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="date">
                                {t('management.start_date')} <span className="text-destructive">*</span>
                            </Label>
                            <DatePicker
                                date={startDate ? parseISO(startDate) : undefined}
                                setDate={(d) => setStartDate(d ? format(d, 'yyyy-MM-dd') : "")}
                                placeholder={t('management.start_date_placeholder')}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>
                                {t('management.days_of_week')} <span className="text-destructive">*</span>
                            </Label>
                            <div className="flex flex-wrap gap-2 justify-start">
                                {DAYS.map((day) => (
                                    <button
                                        key={day.value}
                                        type="button"
                                        onClick={() => toggleDay(day.value)}
                                        className={`
                      w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all
                      ${selectedDays.includes(day.value)
                                                ? "bg-primary text-primary-foreground shadow-lg scale-105"
                                                : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"}
                    `}
                                    >
                                        {day.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>{t('management.course_duration')}</Label>
                            <Tabs dir={i18n.dir()} value={limitType} onValueChange={(v) => setLimitType(v as 'date' | 'count')} className="w-full">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="count">{t('management.total_lessons')}</TabsTrigger>
                                    <TabsTrigger value="date">{t('management.end_date')}</TabsTrigger>
                                </TabsList>
                                <TabsContent value="count">
                                    <Input
                                        type="number"
                                        placeholder={t('management.total_lessons_placeholder')}
                                        value={lessonCount}
                                        onChange={(e) => setLessonCount(e.target.value)}
                                        min="1"
                                        className={i18n.dir() === 'rtl' ? "text-right" : "text-left"}
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        <span className="text-destructive">*</span> {t('management.total_lessons_mandatory')}
                                    </p>
                                </TabsContent>
                                <TabsContent value="date">
                                    <DatePicker
                                        date={endDate ? parseISO(endDate) : undefined}
                                        setDate={(d) => setEndDate(d ? format(d, 'yyyy-MM-dd') : "")}
                                        placeholder={t('management.end_date_placeholder')}
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        <span className="text-destructive">*</span> {t('management.end_date_mandatory')}
                                    </p>
                                </TabsContent>
                            </Tabs>
                        </div>

                        <Button
                            type="submit"
                            className="w-full mt-4 text-base font-bold shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-primary-foreground hover:bg-primary/90"
                            disabled={!isFormValid}
                        >
                            {editingCourse ? t('management.save_course_button') : t('management.add_course_button')}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!courseToDelete} onOpenChange={(open) => !open && setCourseToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('management.are_you_sure')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('management.delete_course_description', { courseName: courseToDelete?.name })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setCourseToDelete(null)}>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete}>{t('common.delete')}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    )
}
