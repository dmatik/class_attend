"use client"

import * as React from "react"
import { format } from "date-fns"
import { he } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
    date?: Date
    setDate: (date: Date | undefined) => void
    placeholder?: string
    className?: string
}

export function DatePicker({ date, setDate, placeholder = "בחר תאריך", className }: DatePickerProps) {
    const [isPopoverOpen, setIsPopoverOpen] = React.useState(false)

    const handleSelect = (newDate: Date | undefined) => {
        setDate(newDate)
        setIsPopoverOpen(false)
    }

    return (
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                        "w-full justify-start text-right font-normal",
                        !date && "text-muted-foreground",
                        className
                    )}
                >
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {date ? format(date, "EEEE, d בMMMM yyyy", { locale: he }) : <span>{placeholder}</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={handleSelect} // Auto-close on select
                    defaultMonth={date}
                    initialFocus
                />
            </PopoverContent>
        </Popover>
    )
}
