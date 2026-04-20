import React, { useState, useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/AuthContext"
import moment from "moment"
import { Clipboard, RefreshCw } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"

export default function ResetTokens() {
  const { user, selectedCompanyId } = useAuth()
  const isPrivileged = user?.role === "admin" || user?.role === "hrd" || user?.role === "superadmin"
  const companyId = user?.role === "superadmin" ? (selectedCompanyId ?? null) : (user?.company_id || null)
  const [activeOnly, setActiveOnly] = useState(true)
  const [requestEmail, setRequestEmail] = useState("")
  const [requesting, setRequesting] = useState(false)
  const { toast } = useToast()
  const [autoRefreshUntil, setAutoRefreshUntil] = useState(null)
  const intervalRef = useRef(null)
  const { data: tokens = [], refetch, isFetching } = useQuery({
    queryKey: ["password-resets", companyId, activeOnly],
    queryFn: async () => {
      if (!isPrivileged) return []
      const qs = [
        companyId ? `company_id=${companyId}` : "",
        `active_only=${activeOnly ? "true" : "false"}`
      ].filter(Boolean).join("&")
      const r = await fetch(`/api/password-resets${qs ? `?${qs}` : ""}`)
      if (!r.ok) return []
      return r.json()
    },
    enabled: isPrivileged,
  })

  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text) } catch {}
  }

  useEffect(() => {
    if (!autoRefreshUntil) return
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    const doRefetch = () => { refetch().catch(()=>{}) }
    doRefetch()
    intervalRef.current = setInterval(doRefetch, 10000) // 10 detik
    const timeout = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = null
      setAutoRefreshUntil(null)
    }, Math.max(autoRefreshUntil - Date.now(), 0))
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      clearTimeout(timeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefreshUntil])

  const secondsLeft = autoRefreshUntil ? Math.max(Math.ceil((autoRefreshUntil - Date.now()) / 1000), 0) : 0

  if (!isPrivileged) {
    return (
      <div className="p-4">
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Hanya Admin/HRD yang dapat mengakses halaman ini.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Filter</Label>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={e => setActiveOnly(e.target.checked)}
              />
              Tampilkan hanya token aktif
            </label>
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Buat Token Baru (email karyawan)</Label>
            <Input
              placeholder="nama@perusahaan.com"
              value={requestEmail}
              onChange={e => setRequestEmail(e.target.value)}
              className="w-72"
            />
          </div>
          <Button
            onClick={async () => {
              if (!requestEmail) { toast({ title: "Email diperlukan", description: "Masukkan email karyawan" }); return; }
              setRequesting(true)
              try {
                const r = await fetch(`/api/auth/request-reset`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email: requestEmail })
                })
                if (!r.ok) {
                  const d = await r.json().catch(()=>({}))
                  throw new Error(d.error || "Gagal membuat token")
                }
                toast({ title: "Token dibuat", description: "Token telah dikirim ke Admin/HRD dan tercatat di daftar" })
                setRequestEmail("")
                refetch()
                setAutoRefreshUntil(Date.now() + 3 * 60 * 1000) // auto-refresh 3 menit
              } catch (e) {
                toast({ title: "Gagal", description: e.message || "Terjadi kesalahan" })
              } finally {
                setRequesting(false)
              }
            }}
            disabled={requesting}
          >
            {requesting ? "Memproses..." : "Buat Token"}
          </Button>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} /> Muat Ulang
          </Button>
        </div>
      </div>

      {autoRefreshUntil && (
        <div className="text-xs text-muted-foreground">
          Auto-refresh aktif ±3 menit. Sisa waktu: {secondsLeft}s
        </div>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Kadaluarsa</TableHead>
                <TableHead>Dibuat</TableHead>
                <TableHead className="w-28">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map(t => {
                const expired = moment(t.expires_at).isBefore(moment())
                return (
                  <TableRow key={t.token}>
                    <TableCell className="font-medium">{t.employee_name || "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.email}</TableCell>
                    <TableCell className="font-mono text-xs truncate max-w-[280px]">{t.token}</TableCell>
                    <TableCell>
                      <Badge variant={expired ? "secondary" : "default"} className="text-[10px]">
                        {moment(t.expires_at).format("DD/MM/YYYY HH:mm")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {moment(t.created_at).fromNow()}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => copy(t.token)}>
                        <Clipboard className="w-4 h-4" /> Salin
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
              {tokens.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Belum ada token reset
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
