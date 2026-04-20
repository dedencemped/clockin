import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/AuthContext"
import { Link } from "react-router-dom"
import { Mail, Lock, LogIn } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { getApiBase } from "@/lib/utils"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const { login } = useAuth()
  const [forgotOpen, setForgotOpen] = useState(false)
  const [fpStep, setFpStep] = useState("request") // "request" | "reset"
  const [fpEmail, setFpEmail] = useState("")
  const [fpToken, setFpToken] = useState("")
  const [fpNewPwd, setFpNewPwd] = useState("")
  const [fpLoading, setFpLoading] = useState(false)

  const onSubmit = async () => {
    if (!email) {
      toast({ title: "Email diperlukan", description: "Masukkan email Anda" })
      return
    }
    setLoading(true)
    try {
      const u = await login(email, password)
      toast({ title: "Masuk berhasil", description: "Anda telah login" })
      const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640
      const isPreview = typeof window !== 'undefined' && window.location && window.location.port === '4173'
      if ((u?.role === 'karyawan' || u?.role === 'hrd') && u?.must_change_password) {
        window.location.href = "/ChangePassword"
        return
      }
      if (u?.role === 'karyawan' || isMobile) {
        window.location.href = isPreview ? "/#/MobileHome" : "/MobileHome"
      } else {
        window.location.href = "/Dashboard"
      }
    } catch (e) {
      toast({ title: "Gagal login", description: e.message || "Periksa email" })
    } finally {
      setLoading(false)
    }
  }

  const onFormSubmit = (e) => {
    e.preventDefault()
    if (!loading) onSubmit()
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-50 p-4">
      <div className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full blur-3xl" style={{ background: "linear-gradient(135deg, rgba(20,184,166,0.25), rgba(30,64,175,0.18))" }} />
      <div className="pointer-events-none absolute -bottom-24 -right-24 w-72 h-72 rounded-full blur-3xl" style={{ background: "linear-gradient(135deg, rgba(30,58,138,0.25), rgba(20,184,166,0.18))" }} />
      <Card className="w-full max-w-md border border-gray-100 shadow-xl rounded-2xl backdrop-blur">
        <CardContent className="p-6 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center text-white shadow-md" style={{ background: "linear-gradient(135deg, #1e3a8a, #14b8a6)" }}>
              <LogIn className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Masuk ke Clockin</h1>
            <p className="text-sm text-muted-foreground">Kelola absensi dan aktivitas harian Anda</p>
          </div>
          <form onSubmit={onFormSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@perusahaan.com" className="pl-9" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="pl-9" />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11">
              {loading ? "Memproses..." : "Masuk"}
            </Button>
            <div className="text-xs text-muted-foreground text-center">
              <span>Belum punya akun perusahaan? </span>
              <Link to="/RegisterCompany" className="text-primary underline">Daftarkan Perusahaan</Link>
            </div>
          </form>
          <div className="text-xs text-center">
            <button
              type="button"
              className="text-primary underline"
              onClick={() => { setForgotOpen(true); setFpEmail(email || ""); setFpStep("request"); }}
            >
              Lupa password?
            </button>
          </div>
        </CardContent>
      </Card>
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{fpStep === "request" ? "Reset Password" : "Setel Password Baru"}</DialogTitle>
          </DialogHeader>
          {fpStep === "request" ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={fpEmail} onChange={e => setFpEmail(e.target.value)} placeholder="nama@perusahaan.com" />
              </div>
              <p className="text-xs text-muted-foreground">
                Masukkan email Anda untuk meminta token reset. Token dikirim ke Admin/HRD perusahaan (berlaku 30 menit).
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Token Reset</Label>
                <Input value={fpToken} onChange={e => setFpToken(e.target.value)} placeholder="Tempel token di sini" />
              </div>
              <div className="space-y-1">
                <Label>Password Baru</Label>
                <Input type="password" value={fpNewPwd} onChange={e => setFpNewPwd(e.target.value)} placeholder="********" />
              </div>
              <p className="text-xs text-muted-foreground">
                Minta token dari Admin/HRD Anda, lalu setel password baru.
              </p>
            </div>
          )}
          <DialogFooter>
            {fpStep === "request" ? (
              <>
                <Button variant="outline" onClick={() => setForgotOpen(false)}>Batal</Button>
                <Button
                  onClick={async () => {
                    if (!fpEmail) { toast({ title: "Email diperlukan", description: "Masukkan email" }); return; }
                    setFpLoading(true);
                    try {
                      const base = getApiBase();
                      const r = await fetch(`${base}/api/auth/request-reset`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email: fpEmail }),
                      });
                      if (!r.ok) {
                        const d = await r.json().catch(()=>({}));
                        throw new Error(d.error || "Gagal meminta token");
                      }
                    const d = await r.json();
                // Selalu kosongkan field token pada form setel password baru
                setFpToken("");
                    setFpStep("reset");
                    toast({ title: "Permintaan diterima", description: "Silahkan hubungi Admin/HRD untuk mendapatkan token !!!" });
                    } catch (e) {
                      toast({ title: "Gagal", description: e.message || "Terjadi kesalahan" });
                    } finally {
                      setFpLoading(false);
                    }
                  }}
                  disabled={fpLoading}
                >
                  {fpLoading ? "Memproses..." : "Minta Token"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setForgotOpen(false)}>Batal</Button>
                <Button
                  onClick={async () => {
                    if (!fpToken || !fpNewPwd) { toast({ title: "Lengkapi data", description: "Isi token dan password baru" }); return; }
                    setFpLoading(true);
                    try {
                      const base = getApiBase();
                      const r = await fetch(`${base}/api/auth/reset-password`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ token: fpToken, password: fpNewPwd }),
                      });
                      if (!r.ok) {
                        const d = await r.json().catch(()=>({}));
                        throw new Error(d.error || "Gagal reset password");
                      }
                      toast({ title: "Berhasil", description: "Password telah direset, silakan login" });
                      setForgotOpen(false);
                      setFpStep("request");
                      setFpEmail("");
                      setFpToken("");
                      setFpNewPwd("");
                    } catch (e) {
                      toast({ title: "Gagal", description: e.message || "Terjadi kesalahan" });
                    } finally {
                      setFpLoading(false);
                    }
                  }}
                  disabled={fpLoading}
                >
                  {fpLoading ? "Menyimpan..." : "Setel Password"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
