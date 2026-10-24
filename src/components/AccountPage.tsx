import { useState, useRef } from "react"
import { useTranslation } from "react-i18next"
import { User, Lock, Upload, LogOut, Check, Shield, Loader2, Camera, Trash2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
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

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || t("account.update_failed"))
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

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || t("account.password_change_failed"))
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
        <div>
          <h2 className="text-xl font-bold">{t("account.title")}</h2>
          <p className="text-muted-foreground text-sm">{t("account.subtitle")}</p>
        </div>
        <Button variant="outline" onClick={onLogout} className="text-destructive hover:text-destructive flex items-center gap-2">
          <LogOut className="w-4 h-4" />
          {t("auth.logout")}
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
                    @{user.username}
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
      </div>
    </div>
  )
}
