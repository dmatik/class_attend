import * as React from "react"
import { format, parseISO } from "date-fns"
import { DatePicker } from "@/components/ui/date-picker"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"


import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Course } from "@/types"

interface CourseManagerProps {
    courses: Course[]
    onAddCourse: (course: Course) => void
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

export function CourseManager({ courses, onAddCourse, onDeleteCourse }: CourseManagerProps) {
    const [name, setName] = React.useState("")
    const [startDate, setStartDate] = React.useState("")

    const [selectedDays, setSelectedDays] = React.useState<number[]>([])
    const [limitType, setLimitType] = React.useState<'date' | 'count'>('count')
    const [endDate, setEndDate] = React.useState("")
    const [lessonCount, setLessonCount] = React.useState<string>("")

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!name || !startDate || selectedDays.length === 0) return
        // Optional validation for limit
        if (limitType === 'date' && !endDate) return
        if (limitType === 'count' && !lessonCount) return

        onAddCourse({
            id: crypto.randomUUID(),
            name,
            startDate,
            daysOfWeek: selectedDays,
            endDate: limitType === 'date' ? endDate : undefined,
            totalLessons: limitType === 'count' ? parseInt(lessonCount) : undefined
        })

        setName("")
        setStartDate("")
        setSelectedDays([])
        setEndDate("")
        setLessonCount("")
    }

    const toggleDay = (day: number) => {
        setSelectedDays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
        )
    }

    return (
        <div className="pb-20 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <Card className="border-none shadow-md bg-white/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="text-xl text-primary">הוספת חוג חדש</CardTitle>
                    <CardDescription>הזן את פרטי החוג כדי להתחיל במעקב</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">שם החוג</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="לדוגמה: שחייה"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="date">תאריך התחלה</Label>
                            <DatePicker
                                date={startDate ? parseISO(startDate) : undefined}
                                setDate={(d) => setStartDate(d ? format(d, 'yyyy-MM-dd') : "")}
                                placeholder="בחר תאריך התחלה"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>ימי פעילות</Label>
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
                                </TabsContent>
                                <TabsContent value="date">
                                    <DatePicker
                                        date={endDate ? parseISO(endDate) : undefined}
                                        setDate={(d) => setEndDate(d ? format(d, 'yyyy-MM-dd') : "")}
                                        placeholder="בחר תאריך סיום"
                                    />
                                </TabsContent>
                            </Tabs>
                        </div>

                        <Button type="submit" className="w-full mt-4 text-base font-bold shadow-lg shadow-primary/20 gap-2">
                            <Plus className="w-5 h-5" />
                            הוסף חוג
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <div className="space-y-4">
                <h3 className="font-semibold text-lg px-2">החוגים שלי</h3>
                {courses.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">עדיין לא הוספת חוגים</p>
                ) : (
                    courses.map(course => (
                        <Card key={course.id} className="overflow-hidden">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div>
                                    <h4 className="font-bold">{course.name}</h4>
                                    <p className="text-sm text-muted-foreground">
                                        ימי {course.daysOfWeek.map(d => DAYS.find(day => day.value === d)?.label).join(', ')}
                                    </p>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => onDeleteCourse(course.id)} className="text-destructive hover:bg-destructive/10">
                                    <Trash2 className="w-5 h-5" />
                                </Button>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div >
    )
}
