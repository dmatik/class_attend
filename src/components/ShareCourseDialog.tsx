import * as React from "react"
import { useTranslation } from "react-i18next"
import { Users, UserPlus, Trash2, LogOut, Loader2, AlertCircle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import type { Course, CourseMember } from "@/types"

export interface ShareCourseDialogProps {
    course: Course | null
    isOpen: boolean
    onClose: () => void
    token: string | null
    currentUserId: string
    onCourseUpdated?: (updatedCourse: Course) => void
    onLeaveCourse?: (courseId: string) => void
}

export function ShareCourseDialog({
    course,
    isOpen,
    onClose,
    token,
    currentUserId,
    onCourseUpdated,
    onLeaveCourse
}: ShareCourseDialogProps) {
    const { t, i18n } = useTranslation()
    const { toast } = useToast()

    const [members, setMembers] = React.useState<CourseMember[]>([])
    const [allUsers, setAllUsers] = React.useState<CourseMember[]>([])
    const [selectedUserId, setSelectedUserId] = React.useState<string>("")
    const [isLoadingUsers, setIsLoadingUsers] = React.useState(false)
    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const [removingUserId, setRemovingUserId] = React.useState<string | null>(null)

    // Sync members when course changes or dialog opens
    React.useEffect(() => {
        if (!isOpen || !course) return

        setMembers(course.sharedWith || [])
        setSelectedUserId("")

        // Fetch fresh members for this course
        if (token) {
            fetch(`/api/courses/${course.id}/members`, {
                headers: { Authorization: `Bearer ${token}` }
            })
                .then(res => res.ok ? res.json() : null)
                .then(data => {
                    if (data?.members) {
                        setMembers(data.members)
                    }
                })
                .catch(err => console.error("Failed to fetch fresh course members:", err))
        }

        // Fetch all users for sharing selection
        if (token) {
            setIsLoadingUsers(true)
            fetch('/api/users', {
                headers: { Authorization: `Bearer ${token}` }
            })
                .then(res => res.ok ? res.json() : null)
                .then(data => {
                    if (data?.users) {
                        setAllUsers(data.users)
                    }
                })
                .catch(err => console.error("Failed to fetch users:", err))
                .finally(() => setIsLoadingUsers(false))
        }
    }, [isOpen, course, token])

    const availableUsers = React.useMemo(() => {
        const memberIds = new Set(members.map(m => m.id))
        return allUsers.filter(u => !memberIds.has(u.id))
    }, [allUsers, members])

    if (!course) return null

    const handleAddMember = async () => {
        if (!selectedUserId || !token) return

        setIsSubmitting(true)
        try {
            const res = await fetch(`/api/courses/${course.id}/members`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ userId: selectedUserId })
            })

            const data = await res.json()
            if (!res.ok) {
                throw new Error(data.error || 'Failed to add member')
            }

            const updatedMembers = data.members || []
            setMembers(updatedMembers)
            setSelectedUserId("")

            if (onCourseUpdated) {
                onCourseUpdated({
                    ...course,
                    sharedWith: updatedMembers
                })
            }

            toast({
                variant: "success",
                title: t('management.sharing.member_added_success')
            })
        } catch (err: any) {
            toast({
                variant: "destructive",
                title: err.message || t('common.error')
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleRemoveMember = async (targetUserId: string) => {
        if (!token) return
        if (members.length <= 1) {
            toast({
                variant: "destructive",
                title: t('management.sharing.cannot_remove_last_member')
            })
            return
        }

        setRemovingUserId(targetUserId)
        try {
            const res = await fetch(`/api/courses/${course.id}/members/${targetUserId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            })

            const data = await res.json()
            if (!res.ok) {
                throw new Error(data.message || data.error || 'Failed to remove member')
            }

            const isSelf = targetUserId === currentUserId

            if (isSelf) {
                toast({
                    variant: "success",
                    title: t('management.sharing.left_course_success')
                })
                onClose()
                if (onLeaveCourse) {
                    onLeaveCourse(course.id)
                }
            } else {
                const updatedMembers = data.members || []
                setMembers(updatedMembers)
                if (onCourseUpdated) {
                    onCourseUpdated({
                        ...course,
                        sharedWith: updatedMembers
                    })
                }
                toast({
                    variant: "success",
                    title: t('management.sharing.member_removed_success')
                })
            }
        } catch (err: any) {
            toast({
                variant: "destructive",
                title: err.message || t('common.error')
            })
        } finally {
            setRemovingUserId(null)
        }
    }

    const isOnlyMember = members.length <= 1

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="w-full max-w-lg p-5 sm:p-6">
                <DialogHeader className="text-start">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2 text-primary text-start">
                        <Users className="w-5 h-5 shrink-0" />
                        <span className="truncate">{t('management.sharing.title', { courseName: course.name })}</span>
                    </DialogTitle>
                    <DialogDescription className="text-start">
                        {t('management.sharing.share_course_description')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 pt-2">
                    {/* Add Member Section */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">
                            {t('management.sharing.add_member')}
                        </label>
                        <div className="flex gap-2">
                            <div className="flex-1 min-w-0">
                                <Select
                                    dir={i18n.dir()}
                                    value={selectedUserId}
                                    onValueChange={setSelectedUserId}
                                    disabled={isLoadingUsers || isSubmitting || availableUsers.length === 0}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue
                                            placeholder={
                                                isLoadingUsers
                                                    ? t('management.sharing.loading_users')
                                                    : availableUsers.length === 0
                                                        ? t('management.sharing.no_available_users')
                                                        : t('management.sharing.select_user_placeholder')
                                            }
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableUsers.map(user => {
                                            const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ')
                                            return (
                                                <SelectItem key={user.id} value={user.id}>
                                                    <span className="font-medium">{fullName || user.username}</span>
                                                    {fullName && <span className="text-muted-foreground ms-1.5 text-xs">({user.username})</span>}
                                                </SelectItem>
                                            )
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button
                                onClick={handleAddMember}
                                disabled={!selectedUserId || isSubmitting}
                                className="shrink-0 gap-1.5"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <UserPlus className="w-4 h-4" />
                                )}
                                <span>{t('management.sharing.add_button')}</span>
                            </Button>
                        </div>
                    </div>

                    {/* Current Members Section */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-foreground">
                                {t('management.sharing.current_members')}
                            </span>
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                {t('management.sharing.members_count', { count: members.length })}
                            </span>
                        </div>

                        {isOnlyMember && (
                            <div className="flex items-center gap-2 p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{t('management.sharing.cannot_remove_last_member')}</span>
                            </div>
                        )}

                        <div className="space-y-2 max-h-60 overflow-y-auto pe-1">
                            {members.map(member => {
                                const isSelf = member.id === currentUserId
                                const fullName = [member.firstName, member.lastName].filter(Boolean).join(' ')
                                const isRemoving = removingUserId === member.id

                                return (
                                    <div
                                        key={member.id}
                                        className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card/60 hover:bg-muted/40 transition-colors gap-3"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            {member.avatar ? (
                                                <img
                                                    src={member.avatar}
                                                    alt={member.username}
                                                    className="w-9 h-9 rounded-full object-cover border shrink-0"
                                                />
                                            ) : (
                                                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                                                    {(member.firstName?.[0] || member.username?.[0] || "U").toUpperCase()}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="font-semibold text-sm truncate">
                                                        {fullName || member.username}
                                                    </span>
                                                    {isSelf && (
                                                        <span className="text-xs px-1.5 py-0.2 rounded bg-primary/15 text-primary font-medium">
                                                            {t('management.sharing.you')}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-xs text-muted-foreground truncate block">
                                                    {member.username}
                                                </span>
                                            </div>
                                        </div>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={isOnlyMember || isRemoving}
                                            onClick={() => handleRemoveMember(member.id)}
                                            title={isSelf ? t('management.sharing.leave_course') : t('management.sharing.remove')}
                                            className={`shrink-0 h-8 px-2.5 text-xs gap-1.5 ${
                                                isSelf
                                                    ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                                    : "text-destructive hover:text-destructive hover:bg-destructive/10"
                                            }`}
                                        >
                                            {isRemoving ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : isSelf ? (
                                                <LogOut className="w-3.5 h-3.5" />
                                            ) : (
                                                <Trash2 className="w-3.5 h-3.5" />
                                            )}
                                            <span>{isSelf ? t('management.sharing.leave_course') : t('management.sharing.remove')}</span>
                                        </Button>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

