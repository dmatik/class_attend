import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import {
  UserPlus,
  Shield,
  Key,
  Trash2,
  Edit2,
  Search,
  Loader2,
  AlertTriangle
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import type { User, UserRole } from "@/types"

interface AdminPageProps {
  currentUser: User
  token: string
}

export function AdminPage({ currentUser, token }: AdminPageProps) {
  const { t } = useTranslation()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isPasswordOpen, setIsPasswordOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [activeUser, setActiveUser] = useState<User | null>(null)

  // Form states for Create User
  const [createUsername, setCreateUsername] = useState("")
  const [createPassword, setCreatePassword] = useState("")
  const [createFirstName, setCreateFirstName] = useState("")
  const [createLastName, setCreateLastName] = useState("")
  const [createRole, setCreateRole] = useState<UserRole>("user")
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false)

  // Form states for Edit User
  const [editFirstName, setEditFirstName] = useState("")
  const [editLastName, setEditLastName] = useState("")
  const [editRole, setEditRole] = useState<UserRole>("user")
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false)

  // Form states for Reset Password
  const [resetPassword, setResetPassword] = useState("")
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false)

  // Fetch Users
  const fetchUsers = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/users", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t("admin.fetch_failed"))
      setUsers(data.users || [])
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: err.message || t("admin.fetch_failed")
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  // Handle Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmittingCreate(true)

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          username: createUsername,
          password: createPassword,
          firstName: createFirstName,
          lastName: createLastName,
          role: createRole
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t("admin.create_failed"))

      toast({
        variant: "success",
        title: t("admin.user_created_title"),
        description: t("admin.user_created_desc", { username: createUsername })
      })

      setIsCreateOpen(false)
      setCreateUsername("")
      setCreatePassword("")
      setCreateFirstName("")
      setCreateLastName("")
      setCreateRole("user")
      fetchUsers()
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: err.message || t("admin.create_failed")
      })
    } finally {
      setIsSubmittingCreate(false)
    }
  }

  // Open Edit User Dialog
  const openEditDialog = (u: User) => {
    setActiveUser(u)
    setEditFirstName(u.firstName || "")
    setEditLastName(u.lastName || "")
    setEditRole(u.role)
    setIsEditOpen(true)
  }

  // Handle Edit User
  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeUser) return
    setIsSubmittingEdit(true)

    try {
      const res = await fetch(`/api/admin/users/${activeUser.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          firstName: editFirstName,
          lastName: editLastName,
          role: editRole
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t("admin.update_failed"))

      toast({
        variant: "success",
        title: t("admin.user_updated_title"),
        description: t("admin.user_updated_desc", { username: activeUser.username })
      })

      setIsEditOpen(false)
      fetchUsers()
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: err.message || t("admin.update_failed")
      })
    } finally {
      setIsSubmittingEdit(false)
    }
  }

  // Open Reset Password Dialog
  const openPasswordDialog = (u: User) => {
    setActiveUser(u)
    setResetPassword("")
    setIsPasswordOpen(true)
  }

  // Handle Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeUser) return

    if (resetPassword.length < 4) {
      toast({
        variant: "destructive",
        title: t("account.password_too_short_title"),
        description: t("account.password_too_short_desc")
      })
      return
    }

    setIsSubmittingPassword(true)

    try {
      const res = await fetch(`/api/admin/users/${activeUser.id}/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          password: resetPassword
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t("admin.password_reset_failed"))

      toast({
        variant: "success",
        title: t("admin.password_reset_title"),
        description: t("admin.password_reset_desc", { username: activeUser.username })
      })

      setIsPasswordOpen(false)
      setResetPassword("")
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: err.message || t("admin.password_reset_failed")
      })
    } finally {
      setIsSubmittingPassword(false)
    }
  }

  // Handle Delete User
  const handleDeleteUser = async () => {
    if (!userToDelete) return

    try {
      const res = await fetch(`/api/admin/users/${userToDelete.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t("admin.delete_failed"))

      toast({
        variant: "success",
        title: t("admin.user_deleted_title"),
        description: t("admin.user_deleted_desc", { username: userToDelete.username })
      })

      setUserToDelete(null)
      fetchUsers()
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: err.message || t("admin.delete_failed")
      })
    }
  }

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase()
    return (
      u.username.toLowerCase().includes(q) ||
      (u.firstName && u.firstName.toLowerCase().includes(q)) ||
      (u.lastName && u.lastName.toLowerCase().includes(q))
    )
  })

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 max-w-5xl mx-auto space-y-6 pb-28">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-500" />
            {t("admin.title")}
          </h2>
          <p className="text-muted-foreground text-sm">{t("admin.subtitle")}</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          {t("admin.add_user_button")}
        </Button>
      </div>

      {/* Search & Stats */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("admin.search_placeholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ps-9"
          />
        </div>
        <div className="text-sm text-muted-foreground self-end sm:self-center">
          {t("admin.total_users", { count: users.length })}
        </div>
      </div>

      {/* Users List */}
      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery ? t("admin.no_users_found") : t("admin.no_users")}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredUsers.map((u) => {
                const isSelf = u.id === currentUser.id
                const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ")

                return (
                  <div
                    key={u.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {u.avatar ? (
                        <img
                          src={u.avatar}
                          alt={u.username}
                          className="w-10 h-10 rounded-full object-cover border"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {u.username[0]?.toUpperCase() || "U"}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {fullName || u.username}
                          </span>
                          {fullName && (
                            <span className="text-xs text-muted-foreground">(@{u.username})</span>
                          )}
                          {isSelf && (
                            <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-medium">
                              {t("admin.you")}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span
                            className={`inline-flex items-center gap-1 font-medium ${
                              u.role === "admin" ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400"
                            }`}
                          >
                            <Shield className="w-3 h-3" />
                            {u.role === "admin" ? t("account.role_admin") : t("account.role_user")}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(u)}
                        title={t("admin.edit_user")}
                        className="h-8 px-2 text-xs flex items-center gap-1"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">{t("common.edit")}</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openPasswordDialog(u)}
                        title={t("admin.reset_password")}
                        className="h-8 px-2 text-xs flex items-center gap-1"
                      >
                        <Key className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">{t("admin.reset_password_short")}</span>
                      </Button>

                      {!isSelf && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setUserToDelete(u)}
                          title={t("admin.delete_user")}
                          className="h-8 px-2 text-xs text-destructive hover:text-destructive flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden md:inline">{t("common.delete")}</span>
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("admin.create_user_modal_title")}</DialogTitle>
            <DialogDescription>{t("admin.create_user_modal_desc")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="create-username">{t("auth.username")}</Label>
              <Input
                id="create-username"
                value={createUsername}
                onChange={(e) => setCreateUsername(e.target.value)}
                placeholder="username"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-password">{t("auth.password")}</Label>
              <Input
                id="create-password"
                type="password"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="create-fn">{t("account.first_name")}</Label>
                <Input
                  id="create-fn"
                  value={createFirstName}
                  onChange={(e) => setCreateFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-ln">{t("account.last_name")}</Label>
                <Input
                  id="create-ln"
                  value={createLastName}
                  onChange={(e) => setCreateLastName(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-role">{t("account.role")}</Label>
              <Select value={createRole} onValueChange={(val: UserRole) => setCreateRole(val)}>
                <SelectTrigger id="create-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">{t("account.role_user")}</SelectItem>
                  <SelectItem value="admin">{t("account.role_admin")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={isSubmittingCreate}>
                {isSubmittingCreate ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : null}
                {t("admin.create_button")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("admin.edit_user_modal_title", { username: activeUser?.username })}
            </DialogTitle>
            <DialogDescription>{t("admin.edit_user_modal_desc")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-fn">{t("account.first_name")}</Label>
                <Input
                  id="edit-fn"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-ln">{t("account.last_name")}</Label>
                <Input
                  id="edit-ln"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">{t("account.role")}</Label>
              <Select value={editRole} onValueChange={(val: UserRole) => setEditRole(val)}>
                <SelectTrigger id="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">{t("account.role_user")}</SelectItem>
                  <SelectItem value="admin">{t("account.role_admin")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={isSubmittingEdit}>
                {isSubmittingEdit ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : null}
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("admin.reset_password_modal_title", { username: activeUser?.username })}
            </DialogTitle>
            <DialogDescription>{t("admin.reset_password_modal_desc")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="reset-pass">{t("admin.new_password")}</Label>
              <Input
                id="reset-pass"
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsPasswordOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={isSubmittingPassword}>
                {isSubmittingPassword ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : null}
                {t("admin.confirm_reset_password")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete User Alert Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              {t("admin.delete_user_title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.delete_user_desc", { username: userToDelete?.username })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
