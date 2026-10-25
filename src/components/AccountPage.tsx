import { useState, useRef, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { User, Lock, Upload, LogOut, Check, Shield, Loader2, Camera, Trash2, Fingerprint, Plus, Smartphone, Laptop, Key } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { toast } from "@/hooks/use-toast"
import { isPasskeySupported, registerPasskey, fetchUserPasskeys, deletePasskey, type PasskeyInfo } from "@/lib/webauthn"
import type { User as UserType } from "@/types"

interface AccountPageProps {
  user: UserType
  token: string
  onUpdateUser: (updated: UserType) => void
  onLogout: () => void
}

export function AccountPage({ user, token, onUpdateUser, onLogout }: AccountPageProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Profile Form State
  const [firstName, setFirstName] = useState(user.firstName || "")
  const [lastName, setLastName] = useState(user.lastName || "")
  const [avatar, setAvatar] = useState(user.avatar || "")
  const [savingProfile, setSavingProfile] = useState(false)

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [savingPassword, setSavingPassword] = useState(false)

  // Passkeys State
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([])
  const [loadingPasskeys, setLoadingPasskeys] = useState(false)
  const [addingPasskey, setAddingPasskey] = useState(false)
  const [showAddPasskeyDialog, setShowAddPasskeyDialog] = useState(false)
  const [newPasskeyName, setNewPasskeyName] = useState("")
  const [passkeyToDelete, setPasskeyToDelete] = useState<PasskeyInfo | null>(null)
  const [deletingPasskey, setDeletingPasskey] = useState(false)
  const [passkeySupported, setPasskeySupported] = useState(false)

  useEffect(() => {
    setPasskeySupported(isPasskeySupported())
    loadPasskeys()
  }, [])

  const loadPasskeys = async () => {
    setLoadingPasskeys(true)
    try {
      const list = await fetchUserPasskeys(token)
      setPasskeys(list)
    } catch (err) {
      console.error("Failed to load passkeys:", err)
    } finally {
      setLoadingPasskeys(false)
    }
  }

  const handleStartAddPasskey = () => {
    if (!passkeySupported) {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t("account.passkey_not_supported")
      })
      return
    }

    const ua = navigator.userAgent
    let defaultName = t("account.passkey_default_name")
    if (/iPhone|iPad/i.test(ua)) defaultName = t("account.passkey_device_iphone")
    else if (/Macintosh|Mac OS/i.test(ua)) defaultName = t("account.passkey_device_mac")
    else if (/Android/i.test(ua)) defaultName = t("account.passkey_device_android")
    else if (/Windows/i.test(ua)) defaultName = t("account.passkey_device_windows")

    setNewPasskeyName(defaultName)
    setShowAddPasskeyDialog(true)
  }

  const handleConfirmAddPasskey = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddingPasskey(true)
    try {
      const created = await registerPasskey(token, newPasskeyName || "Passkey")
      setPasskeys(prev => [created, ...prev])
      setShowAddPasskeyDialog(false)
      toast({
        variant: "success",
        title: t("account.passkey_created_title"),
        description: t("account.passkey_created_desc")
      })
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        toast({
          variant: "destructive",
          title: t("common.error"),
          description: err.message || t("account.passkey_failed")
        })
      }
    } finally {
      setAddingPasskey(false)
    }
  }

  const handleDeletePasskey = async () => {
    if (!passkeyToDelete) return
    setDeletingPasskey(true)
    try {
      await deletePasskey(token, passkeyToDelete.id)
      setPasskeys(prev => prev.filter(p => p.id !== passkeyToDelete.id))
      setPasskeyToDelete(null)
      toast({
        variant: "success",
        title: t("account.passkey_deleted_title"),
        description: t("account.passkey_deleted_desc")
      })
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: err.message || "Failed to remove passkey"
      })
    } finally {
      setDeletingPasskey(false)
    }
  }

  // Handle avatar file selection
  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Limit file size to 2MB
    if (file.size > 2 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: t("account.avatar_too_large"),
        description: t("account.avatar_size_limit_desc")
      })
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result as string
      setAvatar(result)
    }
    reader.readAsDataURL(file)
  }

  // Save Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)

    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          firstName,
          lastName,
          avatar
        })
      })

      const isJson = res.headers.get("content-type")?.includes("application/json")
      const data = isJson ? await res.json().catch(() => null) : null
      if (!res.ok) {
        throw new Error(data?.error || t("account.update_failed"))
      }

      onUpdateUser(data.user)
      toast({
        variant: "success",
        title: t("account.profile_updated_title"),
        description: t("account.profile_updated_desc")
      })
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: err.message || t("account.update_failed")
      })
    } finally {
      setSavingProfile(false)
    }
  }

  // Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: t("account.password_mismatch_title"),
        description: t("account.password_mismatch_desc")
      })
      return
    }

    if (newPassword.length < 4) {
      toast({
        variant: "destructive",
        title: t("account.password_too_short_title"),
        description: t("account.password_too_short_desc")
      })
      return
    }

    setSavingPassword(true)

    try {
      const res = await fetch("/api/auth/password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      })

      const isJson = res.headers.get("content-type")?.includes("application/json")
      const data = isJson ? await res.json().catch(() => null) : null
      if (!res.ok) {
        throw new Error(data?.error || t("account.password_change_failed"))
      }

      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")

      toast({
        variant: "success",
        title: t("account.password_changed_title"),
        description: t("account.password_changed_desc")
      })
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: err.message || t("account.password_change_failed")
      })
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 max-w-4xl mx-auto space-y-6 pb-28">
      {/* Page Header */}
      <div className="flex flex-row justify-between items-center gap-3 border-b pb-3 sm:pb-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold truncate">{t("account.title")}</h2>
          <p className="text-muted-foreground text-xs truncate">{t("account.subtitle")}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onLogout}
          className="text-destructive hover:text-destructive flex items-center gap-1.5 shrink-0 h-9 px-3"
        >
          <LogOut className="w-4 h-4" />
          <span>{t("auth.logout")}</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Card */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              {t("account.personal_info")}
            </CardTitle>
            <CardDescription>{t("account.personal_info_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Avatar Selector */}
              <div className="flex flex-col items-center justify-center gap-3 pb-4 border-b">
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  {avatar ? (
                    <img
                      src={avatar}
                      alt={user.username}
                      className="w-24 h-24 rounded-full object-cover border-2 border-primary/20 shadow-md"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary border-2 border-dashed border-primary/30">
                      <User className="w-10 h-10" />
                    </div>
                  )}
                  <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                    <Camera className="w-6 h-6" />
                  </div>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleAvatarFile}
                />

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs"
                  >
                    <Upload className="w-3.5 h-3.5 me-1" />
                    {t("account.change_photo")}
                  </Button>
                  {avatar && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAvatar("")}
                      className="text-xs text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5 me-1" />
                      {t("account.remove_photo")}
                    </Button>
                  )}
                </div>
              </div>

              {/* Username & Role (Read only) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t("auth.username")}</Label>
                  <div className="text-sm font-semibold bg-muted/50 p-2 rounded-md border text-foreground">
                    {user.username}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t("account.role")}</Label>
                  <div className="flex items-center gap-1.5 text-sm font-medium bg-muted/50 p-2 rounded-md border">
                    <Shield className={`w-4 h-4 ${user.role === 'admin' ? 'text-amber-500' : 'text-blue-500'}`} />
                    <span>{user.role === 'admin' ? t("account.role_admin") : t("account.role_user")}</span>
                  </div>
                </div>
              </div>

              {/* Name & Family Name */}
              <div className="space-y-2">
                <Label htmlFor="firstName">{t("account.first_name")}</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={t("account.first_name_placeholder")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">{t("account.last_name")}</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder={t("account.last_name_placeholder")}
                />
              </div>

              <Button type="submit" disabled={savingProfile} className="w-full">
                {savingProfile ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin me-2" />
                    {t("common.saving")}
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 me-2" />
                    {t("common.save")}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Change Password Card */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              {t("account.change_password")}
            </CardTitle>
            <CardDescription>{t("account.change_password_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">{t("account.current_password")}</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">{t("account.new_password")}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t("account.confirm_password")}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" variant="secondary" disabled={savingPassword} className="w-full">
                {savingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin me-2" />
                    {t("common.saving")}
                  </>
                ) : (
                  t("account.update_password_button")
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Passkeys Card */}
        <Card className="shadow-sm md:col-span-2">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4">
            <div className="space-y-1 min-w-0">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Fingerprint className="w-5 h-5 text-primary shrink-0" />
                <span>{t("account.passkeys_title")}</span>
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {t("account.passkeys_desc")}
              </CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleStartAddPasskey}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 shrink-0 h-9"
            >
              <Plus className="w-4 h-4" />
              <span>{t("account.add_passkey")}</span>
            </Button>
          </CardHeader>
          <CardContent>
            {loadingPasskeys ? (
              <div className="flex items-center justify-center p-8 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : passkeys.length === 0 ? (
              <div className="text-center py-6 sm:py-8 px-4 border border-dashed rounded-xl bg-muted/20">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2 sm:mb-3">
                  <Fingerprint className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <p className="font-semibold text-sm">{t("account.no_passkeys")}</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  {t("account.no_passkeys_desc")}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleStartAddPasskey}
                  className="mt-3 sm:mt-4 text-xs"
                >
                  <Plus className="w-3.5 h-3.5 me-1.5" />
                  {t("account.add_passkey")}
                </Button>
              </div>
            ) : (
              <div className="divide-y border rounded-xl overflow-hidden">
                {passkeys.map((p) => {
                  const lower = p.deviceName.toLowerCase()
                  const IconComponent = (lower.includes('phone') || lower.includes('android') || lower.includes('ios'))
                    ? Smartphone
                    : (lower.includes('mac') || lower.includes('windows') || lower.includes('pc') || lower.includes('laptop'))
                      ? Laptop
                      : Fingerprint

                  return (
                    <div key={p.id} className="p-3 sm:p-3.5 flex items-center justify-between gap-2.5 sm:gap-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <IconComponent className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold truncate flex items-center gap-1.5">
                            <span className="truncate">{p.deviceName}</span>
                            {p.backedUp ? (
                              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                                {t("account.synced")}
                              </span>
                            ) : null}
                          </div>
                          <div className="text-[11px] sm:text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                            <span>{t("account.created_on", { date: new Date(p.createdAt).toLocaleDateString() })}</span>
                            {p.lastUsedAt && (
                              <>
                                <span className="opacity-40">•</span>
                                <span>{t("account.last_used", { date: new Date(p.lastUsedAt).toLocaleDateString() })}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setPasskeyToDelete(p)}
                        className="text-muted-foreground hover:text-destructive shrink-0 h-8 w-8"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Passkey Dialog */}
      <Dialog open={showAddPasskeyDialog} onOpenChange={setShowAddPasskeyDialog}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleConfirmAddPasskey}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Fingerprint className="w-5 h-5 text-primary" />
                {t("account.add_passkey")}
              </DialogTitle>
              <DialogDescription>
                {t("account.passkeys_desc")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="passkeyName">{t("account.passkey_name_prompt")}</Label>
                <Input
                  id="passkeyName"
                  value={newPasskeyName}
                  onChange={(e) => setNewPasskeyName(e.target.value)}
                  placeholder={t("account.passkey_name_placeholder")}
                  required
                  autoFocus
                />
              </div>
            </div>

            <DialogFooter className="flex-row items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddPasskeyDialog(false)}
                disabled={addingPasskey}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={addingPasskey}>
                {addingPasskey ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin me-2" />
                    {t("account.adding_passkey")}
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4 me-2" />
                    {t("common.confirm")}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Passkey Confirmation Dialog */}
      <AlertDialog open={!!passkeyToDelete} onOpenChange={(open) => !open && setPasskeyToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("account.passkey_deleted_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("account.delete_passkey_confirm")}
              {passkeyToDelete && (
                <span className="block mt-2 font-medium text-foreground">
                  "{passkeyToDelete.deviceName}"
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row items-center justify-end gap-2 pt-2">
            <AlertDialogCancel disabled={deletingPasskey}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePasskey}
              disabled={deletingPasskey}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingPasskey ? <Loader2 className="w-4 h-4 animate-spin" /> : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
