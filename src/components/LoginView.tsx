import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Lock, User as UserIcon, Loader2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ModeToggle } from "@/components/mode-toggle"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import type { User } from "@/types"

interface LoginViewProps {
  onLoginSuccess: (token: string, user: User) => void
}

export function LoginView({ onLoginSuccess }: LoginViewProps) {
  const { t } = useTranslation()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || t("auth.login_failed"))
      }

      onLoginSuccess(data.token, data.user)
    } catch (err: any) {
      setError(err.message || t("auth.login_failed"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-gradient-to-br from-background via-muted/30 to-background p-4 relative">
      {/* Top Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <LanguageSwitcher />
        <ModeToggle />
      </div>

      <Card className="w-full max-w-md shadow-xl border-border/60">
        <CardHeader className="text-center space-y-2 pb-6">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-2 shadow-inner">
            <UserIcon className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            {t("common.app_title")}
          </CardTitle>
          <CardDescription>
            {t("auth.login_subtitle")}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm rounded-lg bg-destructive/15 text-destructive border border-destructive/20 text-center animate-in fade-in">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">{t("auth.username")}</Label>
              <div className="relative">
                <UserIcon className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  className="ps-9"
                  placeholder={t("auth.username_placeholder")}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <div className="relative">
                <Lock className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  className="ps-9"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full mt-6" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("auth.logging_in")}
                </>
              ) : (
                t("auth.login_button")
              )}
            </Button>

            <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border/40">
              {t("auth.default_credentials_hint")}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

