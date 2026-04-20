import React from "react"
import MobileNav from "@/components/mobile/MobileNav"
import { useAuth } from "@/lib/AuthContext"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function MobileProfile() {
  const { user, logout } = useAuth()
  return (
    <div className="p-4 space-y-4">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">DATA DIRI</p>
      </div>
      <Card className="p-6 bg-gradient-to-r from-cyan-700 to-emerald-500 text-white rounded-2xl">
        <div className="w-28 h-28 rounded-full bg-black/20 mx-auto mb-4" />
        <p className="text-2xl font-extrabold text-center">{user?.full_name || "Nama"}</p>
        <p className="text-center text-sm opacity-90">{user?.employee_id || "-"}</p>
      </Card>
      <Card className="p-4 space-y-3 rounded-2xl">
        <Row label="NIK" value={user?.nik || "Belum Ada NIK"} dot="bg-indigo-600" />
        <Row label="Tanggal Lahir" value={user?.birth_date || "-"} dot="bg-teal-500" />
        <Row label="Jenis Kelamin" value={user?.gender || "Belum Ditentukan"} dot="bg-teal-500" />
        <Row label="Status" value={user?.status || "-"} dot="bg-teal-500" />
        <Row label="Golongan Darah" value={user?.blood_type || "Belum Ditentukan"} dot="bg-teal-500" />
        <Row label="Unit Kerja" value={user?.department || "-"} dot="bg-teal-500" />
        <Row label="Jabatan" value={user?.position || "-"} dot="bg-teal-500" />
        <Row label="Email" value={user?.email || "-"} dot="bg-teal-500" />
        <div className="pt-2">
          <Button onClick={() => logout(true)} className="w-full" variant="destructive">Keluar</Button>
        </div>
      </Card>
      <div className="h-16" />
      <MobileNav active="Profile" />
    </div>
  )
}

function Row({ label, value, dot }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`w-3 h-3 rounded-full mt-1 ${dot || "bg-muted"}`} />
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-base font-medium">{value}</p>
      </div>
    </div>
  )
}
