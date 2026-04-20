import React from "react"
import { useQuery } from "@tanstack/react-query"
import MobileNav from "@/components/mobile/MobileNav"
import moment from "moment"
import { Card } from "@/components/ui/card"
import { useAuth } from "@/lib/AuthContext"

export default function MobileHistory() {
  const { user } = useAuth()
  const companyId = user?.company_id || null
  const userId = user?.id || null
  const { data: list = [] } = useQuery({
    queryKey: ["attendance-all-mobile", companyId],
    queryFn: async () => {
      const qs = companyId ? `?company_id=${companyId}` : ""
      const r = await fetch(`/api/attendance${qs}`)
      if (!r.ok) return []
      const rows = await r.json()
      return userId ? rows.filter(a => a.employee_id === userId) : rows
    }
  })
  return (
    <div className="p-4 space-y-3">
      <div className="text-center">
        <p className="text-xs text-muted-foreground tracking-widest">RIWAYAT HARI KERJA</p>
        <p className="text-2xl font-extrabold">Bulan {moment().format("MMMM YYYY")}</p>
      </div>
      {list.map(a => {
        const inT = a.check_in ? moment(a.check_in).format("h:mm") : "-"
        const inSuf = a.check_in ? moment(a.check_in).format("A") : ""
        const outT = a.check_out ? moment(a.check_out).format("h:mm") : "-"
        const outSuf = a.check_out ? moment(a.check_out).format("A") : ""
        return (
          <Card key={a.id} className="p-4 rounded-2xl">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-500" />
                  <p className="font-medium">{moment(a.date).format("DD MMMM YYYY")}</p>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Masuk</p>
                    <p className="text-3xl font-extrabold leading-none">{inT}</p>
                    <p className="text-xs text-muted-foreground">{inSuf}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Jam Pulang</p>
                    <p className="text-3xl font-extrabold leading-none">{outT}</p>
                    <p className="text-xs text-muted-foreground">{outSuf}</p>
                  </div>
                </div>
                {a.notes ? (
                  <p className="text-xs text-muted-foreground mt-1">Keterangan: {a.notes}</p>
                ) : null}
              </div>
              <div className="text-xs text-muted-foreground text-right">
                <p>Telat: {a.late_minutes || 0}m</p>
                <p>Lembur: {a.overtime_minutes || 0}m</p>
              </div>
            </div>
          </Card>
        )
      })}
      <div className="h-16" />
      <MobileNav active="Riwayat" />
    </div>
  )
}
