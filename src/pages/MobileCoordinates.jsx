import React from "react"
import { useQuery } from "@tanstack/react-query"
import MobileNav from "@/components/mobile/MobileNav"
import { Card } from "@/components/ui/card"
import { useAuth } from "@/lib/AuthContext"

export default function MobileCoordinates() {
  const { user } = useAuth()
  const companyId = user?.company_id || null
  const { data: branches = [] } = useQuery({
    queryKey: ["mobile-branches", companyId],
    queryFn: async () => {
      const qs = companyId ? `?company_id=${companyId}` : ""
      const r = await fetch(`/api/branches${qs}`)
      if (!r.ok) return []
      return r.json()
    }
  })
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm tracking-widest text-muted-foreground">KOORDINAT</p>
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm" style={{ background: "linear-gradient(135deg, #1e3a8a, #14b8a6)" }}>↻</div>
      </div>
      <div className="mt-1">
        <p className="text-2xl font-extrabold">List Koordinat</p>
        <p className="text-xs text-muted-foreground">Koordinat yang aktif untuk absensi</p>
      </div>
      {branches.length === 0 && (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Belum ada lokasi untuk perusahaan Anda. Hubungi admin untuk menambahkan lokasi di menu Lokasi.</p>
        </Card>
      )}
      {branches.map(b => (
        <Card key={b.id} className="p-3 flex items-center gap-3">
          <div className="relative w-16 h-16 rounded-xl bg-muted overflow-hidden shrink-0">
            <div className="absolute left-1 top-1 bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full">Aktif</div>
            <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: "url(https://maps.gstatic.com/tactile/pane/default_geocode-2x.png)" }} />
          </div>
          <div className="min-w-0">
            <p className="font-extrabold text-[18px] leading-5">{b.name}</p>
            <p className="text-xs text-muted-foreground truncate">{b.address || "-"}</p>
          </div>
        </Card>
      ))}
      <div className="h-16" />
      <MobileNav active="Lokasi" />
    </div>
  )
}
