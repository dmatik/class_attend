"use client"

import * as React from "react"
import { format } from "date-fns"
import { he, enUS } from "date-fns/locale"
import { useTranslation } from "react-i18next"
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

export function DatePicker({ date, setDate, placeholder, className }: DatePickerProps) {
    const { t, i18n } = useTranslation()
    const isRtl = i18n.dir() === 'rtl'
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
                        "w-full justify-start text-left font-normal gap-2",
                        isRtl && "text-right",
                        !date && "text-muted-foreground",
                        className
                    )}
                >
                    <CalendarIcon className="h-4 w-4" />
                    {date ? format(date, isRtl ? "EEEE, d בMMMM yyyy" : "PPP", { locale: isRtl ? he : enUS }) : <span>{placeholder || t('common.select_date')}</span>}
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
