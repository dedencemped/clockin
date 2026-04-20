import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/AuthContext"
import { getApiBase } from "@/lib/utils"
import { Lock } from "lucide-react"

export default function ChangePassword() {
  const { user, logout } = useAuth()
  const { toast } = useToast()
  const [currentPwd, setCurrentPwd] = useState("")
  const [newPwd, setNewPwd] = useState("")
  const [confirmPwd, setConfirmPwd] = useState("")
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!user?.email) return
    if (!currentPwd || !newPwd || !confirmPwd) {
      toast({ title: "Lengkapi data", description: "Isi semua kolom" })
      return
    }
    if (newPwd !== confirmPwd) {
      toast({ title: "Tidak cocok", description: "Konfirmasi password tidak sama" })
      return
    }
    setSaving(true)
    try {
      const base = getApiBase()
      const r = await fetch(`${base}/api/auth/change-password-self`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, current_password: currentPwd, new_password: newPwd }),
      })
      if (!r.ok) {
        const d = await r.json().catch(()=>({}))
        throw new Error(d.error || "Gagal mengubah password")
      }
      logout(true)
    } catch (e) {
      toast({ title: "Gagal menyimpan", description: e.message || "Terjadi kesalahan" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-50 p-4">
      <div className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full blur-3xl" style={{ background: "linear-gradient(135deg, rgba(20,184,166,0.25), rgba(30,64,175,0.18))" }} />
      <div className="pointer-events-none absolute -bottom-24 -right-24 w-72 h-72 rounded-full blur-3xl" style={{ background: "linear-gradient(135deg, rgba(30,58,138,0.25), rgba(20,184,166,0.18))" }} />
      <Card className="w-full max-w-md border border-gray-100 shadow-xl rounded-2xl backdrop-blur">
        <CardContent className="p-6 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center text-white shadow-md" style={{ background: "linear-gradient(135deg, #1e3a8a, #14b8a6)" }}>
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Ubah Password</h1>
            <p className="text-sm text-muted-foreground">Demi keamanan, silakan ganti password Anda</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1">
              <Label>Password Saat Ini</Label>
              <Input type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} placeholder="********" />
            </div>
            <div className="space-y-1">
              <Label>Password Baru</Label>
              <Input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="********" />
            </div>
            <div className="space-y-1">
              <Label>Konfirmasi Password Baru</Label>
              <Input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} placeholder="********" />
            </div>
            <Button type="submit" className="w-full h-11" disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
