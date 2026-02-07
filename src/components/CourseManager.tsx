import * as React from "react"
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

const DAYS = [
    { label: "א", value: 0 },
    { label: "ב", value: 1 },
    { label: "ג", value: 2 },
    { label: "ד", value: 3 },
    { label: "ה", value: 4 },
    { label: "ו", value: 5 },
    { label: "ש", value: 6 },
]

export function CourseManager({ courses, onAddCourse, onEditCourse, onDeleteCourse }: CourseManagerProps) {
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
        <div className="pb-20 space-y-6">
            <div className="space-y-4">
                <h3 className="font-semibold text-lg px-2">החוגים שלי</h3>
                {courses.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">עדיין לא הוספת חוגים</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {courses.map(course => (
                            <Card key={course.id} className="overflow-hidden bg-card border-border shadow-sm hover:shadow-md transition-shadow">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div>
                                        <h4 className="font-bold text-foreground">{course.name}</h4>
                                        <p className="text-sm text-muted-foreground">
                                            ימי {course.daysOfWeek.map(d => DAYS.find(day => day.value === d)?.label).join(', ')}
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
                className="w-full md:w-auto text-base font-bold shadow-lg shadow-blue-500/30 dark:shadow-blue-900/50 gap-2 bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:text-white dark:hover:bg-blue-800"
            >
                הוסף חוג חדש
            </Button>

            <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
                <DialogContent className="w-full h-full max-w-none max-h-none rounded-none md:w-auto md:h-auto md:max-w-md md:max-h-[90vh] md:rounded-lg overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl text-primary">{editingCourse ? 'עריכת חוג' : 'הוספת חוג חדש'}</DialogTitle>
                        <DialogDescription>{editingCourse ? 'ערוך את פרטי החוג' : 'הזן את פרטי החוג כדי להתחיל במעקב'}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">
                                שם החוג <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="לדוגמה: שחייה"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="date">
                                תאריך התחלה <span className="text-destructive">*</span>
                            </Label>
                            <DatePicker
                                date={startDate ? parseISO(startDate) : undefined}
                                setDate={(d) => setStartDate(d ? format(d, 'yyyy-MM-dd') : "")}
                                placeholder="בחר תאריך התחלה"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>
                                ימי פעילות <span className="text-destructive">*</span>
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
                            <Label>משך הקורס</Label>
                            <Tabs value={limitType} onValueChange={(v) => setLimitType(v as 'date' | 'count')} className="w-full">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="count">מספר שיעורים</TabsTrigger>
                                    <TabsTrigger value="date">תאריך סיום</TabsTrigger>
                                </TabsList>
                                <TabsContent value="count">
                                    <Input
                                        type="number"
                                        placeholder="סה״כ שיעורים (לדוגמה: 10)"
                                        value={lessonCount}
                                        onChange={(e) => setLessonCount(e.target.value)}
                                        min="1"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        <span className="text-destructive">*</span> חובה להזין מספר שיעורים
                                    </p>
                                </TabsContent>
                                <TabsContent value="date">
                                    <DatePicker
                                        date={endDate ? parseISO(endDate) : undefined}
                                        setDate={(d) => setEndDate(d ? format(d, 'yyyy-MM-dd') : "")}
                                        placeholder="בחר תאריך סיום"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        <span className="text-destructive">*</span> חובה לבחור תאריך סיום
                                    </p>
                                </TabsContent>
                            </Tabs>
                        </div>

                        <Button
                            type="submit"
                            className="w-full mt-4 text-base font-bold shadow-lg shadow-blue-500/30 dark:shadow-blue-900/50 disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:text-white dark:hover:bg-blue-800"
                            disabled={!isFormValid}
                        >
                            {editingCourse ? 'שמור שינויים' : 'הוסף חוג'}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!courseToDelete} onOpenChange={(open) => !open && setCourseToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle>
                        <AlertDialogDescription>
                            פעולה זו תמחק את החוג "{courseToDelete?.name}" וכל השיעורים הקשורים אליו. לא ניתן לבטל פעולה זו.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setCourseToDelete(null)}>ביטול</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete}>מחק</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    )
}
