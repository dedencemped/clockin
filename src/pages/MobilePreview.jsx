import React, { useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const PRESETS = [
  { label: "iPhone 12/13/14 (390×844)", w: 390, h: 844 },
  { label: "Android S (360×800)", w: 360, h: 800 },
  { label: "iPhone 11/8+ (414×896)", w: 414, h: 896 },
  { label: "iPad Mini (768×1024)", w: 768, h: 1024 }
]

const PAGES = [
  { label: "Dashboard", path: "/" },
  { label: "Absensi", path: "/Attendance" },
  { label: "Karyawan", path: "/Employees" },
  { label: "Lokasi", path: "/Branches" },
  { label: "Izin & Cuti", path: "/LeaveRequests" },
  { label: "Laporan", path: "/Reports" },
  { label: "Pengaturan", path: "/SystemSettings" },
  { label: "Login", path: "/Login" },
]

export default function MobilePreview() {
  const [size, setSize] = useState(PRESETS[0])
  const [path, setPath] = useState("/Login")
  const [customW, setCustomW] = useState("")
  const [customH, setCustomH] = useState("")
  const width = useMemo(() => Number(customW) || size.w, [customW, size])
  const height = useMemo(() => Number(customH) || size.h, [customH, size])

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Halaman</label>
              <Select value={path} onValueChange={setPath}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAGES.map(p => <SelectItem key={p.path} value={p.path}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Perangkat</label>
              <Select value={String(size.w)} onValueChange={v => {
                const next = PRESETS.find(p => String(p.w) === v) || PRESETS[0]
                setSize(next); setCustomW(""); setCustomH("")
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRESETS.map(p => <SelectItem key={p.w} value={String(p.w)}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Lebar (px)</label>
                <Input placeholder={String(size.w)} value={customW} onChange={e => setCustomW(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Tinggi (px)</label>
                <Input placeholder={String(size.h)} value={customH} onChange={e => setCustomH(e.target.value)} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-center">
        <div className="rounded-[36px] border shadow-2xl bg-black/90 p-2" style={{ width: width + 16, height: height + 16 }}>
          <div className="rounded-[30px] overflow-hidden bg-white w-full h-full">
            <iframe
              title="mobile-preview"
              src={path}
              width={width}
              height={height}
              style={{ border: "none", display: "block" }}
            />
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Preview memakai iframe same-origin, sehingga status login dan data tetap sinkron.
      </p>
    </div>
  )
}
