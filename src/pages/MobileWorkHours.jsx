import React from "react"
import { useQuery } from "@tanstack/react-query"
import MobileNav from "@/components/mobile/MobileNav"
import moment from "moment"
import { Card } from "@/components/ui/card"
import { useAuth } from "@/lib/AuthContext"

// Konsisten dengan penyimpanan di SystemSettings (0=Min, 1=Sen, ... 6=Sab)
const DAYS = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"]

export default function MobileWorkHours() {
  const { user: authUser } = useAuth();
  const [employee, setEmployee] = React.useState(null);
  const companyId = authUser?.company_id || null;

  React.useEffect(() => {
    fetch("/api/employees").then(r => r.json()).then(list => {
      const me = list.find(e => e.email === authUser?.email) || list.find(e => e.id === authUser?.id);
      if (me) setEmployee(me);
    }).catch(()=>{});
  }, [authUser]);

  const { data: settings = [] } = useQuery({
    queryKey: ["system-settings", companyId],
    queryFn: async () => {
      const qs = companyId ? `?company_id=${companyId}` : "";
      const r = await fetch(`/api/system-settings${qs}`)
      if (!r.ok) return []
      return r.json()
    }
  })

  let start = "08:00", end = "17:00", workDays = [1,2,3,4,5]
  let scheduleName = "Jam Kerja"

  if (employee?.shift_id) {
    start = employee.shift_start?.slice(0, 5) || "08:00";
    end = employee.shift_end?.slice(0, 5) || "17:00";
    scheduleName = employee.shift_name || "Shift";
  } else {
    const wh = settings.find(s => s.key === "work_hours")
    if (wh) {
      try { const v = JSON.parse(wh.value); start = v.start || start; end = v.end || end; if (v.name) scheduleName = v.name } catch {}
    }
  }

  const wd = settings.find(s => s.key === "work_days")
  if (wd) {
    try { const v = JSON.parse(wd.value); if (Array.isArray(v)) workDays = v } catch {}
  }
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta"
  return (
    <div className="space-y-4 p-4">
      <div className="text-center">
        <p className="text-xs tracking-widest text-muted-foreground">JAM KERJA</p>
        <p className="text-2xl font-extrabold mt-1">{moment().format("dddd DD/MM/YYYY")}</p>
        <div className="flex items-end justify-center gap-1">
          <span className="text-6xl font-extrabold leading-none">{moment().format("h:mm")}</span>
          <span className="text-sm mb-1">{moment().format("A")}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
          <span>{scheduleName}</span>
          <span className="uppercase">{tz.replace('_','/')}</span>
        </div>
      </div>
      <Card className="p-4 bg-emerald-50 text-emerald-700 text-sm rounded-2xl">
        Jika terdapat kesalahan dalam jam kerja silahkan koordinasi dengan operator dinas anda
      </Card>
      <div className="space-y-3">
        {DAYS.map((d, idx) => {
          const enabled = workDays.includes(idx)
          return (
            <Card key={d} className="p-4 rounded-2xl">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                    <p className="font-medium">{d}</p>
                  </div>
                  <div className="flex items-end gap-1 mt-1">
                    <span className="text-5xl font-extrabold leading-none">{moment(start,'HH:mm').format('h:mm')}</span>
                    <span className="text-sm mb-1">{moment(start,'HH:mm').format('A')}</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1">Pulang: {moment(end,'HH:mm').format('h:mm A')}</p>
                </div>
                <div className={`w-12 h-7 rounded-full ${enabled ? 'bg-teal-500' : 'bg-muted'}`} />
              </div>
            </Card>
          )
        })}
      </div>
      <div className="h-16" />
      <MobileNav active="Jam" />
    </div>
  )
}
