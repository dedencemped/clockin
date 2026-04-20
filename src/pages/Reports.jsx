import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Download } from "lucide-react";
import moment from "moment";
import MobileNav from "@/components/mobile/MobileNav";
import { useAuth } from "@/lib/AuthContext";

const statusColors = {
  hadir: "bg-accent/10 text-accent",
  terlambat: "bg-chart-3/10 text-chart-3",
  alpha: "bg-destructive/10 text-destructive",
  izin: "bg-primary/10 text-primary",
  cuti: "bg-chart-5/10 text-chart-5",
};

export default function Reports() {
  const [dateRange, setDateRange] = useState({
    start: moment().startOf("month").format("YYYY-MM-DD"),
    end: moment().endOf("month").format("YYYY-MM-DD"),
  });
  const [branchFilter, setBranchFilter] = useState("all");
  const { user, selectedCompanyId } = useAuth();
  const companyId = user?.role === "superadmin"
    ? (selectedCompanyId ?? null)
    : (user?.company_id || null);

  const { data: attendances = [] } = useQuery({
    queryKey: ["report-attendance", dateRange, companyId],
    queryFn: async () => {
      const qs = companyId ? `?company_id=${companyId}` : "";
      const res = await fetch(`/api/attendance${qs}`);
      if (!res.ok) return [];
      const rows = await res.json();
      return rows.map(r => ({
        id: r.id,
        employee_id: r.employee_id,
        employee_name: r.employee_name,
        date: r.date,
        clock_in: r.check_in ? r.check_in?.slice(11,16) : null,
        clock_out: r.check_out ? r.check_out?.slice(11,16) : null,
        status: r.status,
        late_minutes: r.late_minutes || 0,
        overtime_minutes: r.overtime_minutes || 0,
        branch_id: r.branch_id || null,
        notes: r.notes || "",
      }));
    },
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches-report", companyId],
    queryFn: async () => {
      const qs = companyId ? `?company_id=${companyId}` : "";
      const res = await fetch(`/api/branches${qs}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-report", companyId],
    queryFn: async () => {
      const qs = companyId ? `?company_id=${companyId}` : "";
      const res = await fetch(`/api/employees${qs}`);
      if (!res.ok) return [];
      const rows = await res.json();
      return rows.filter(e => e.status === "aktif");
    },
  });

  const filtered = attendances.filter(a => {
    const inRange = a.date >= dateRange.start && a.date <= dateRange.end;
    const inBranch = branchFilter === "all" || a.branch_id === branchFilter;
    return inRange && inBranch;
  });

  // Summary stats
  const totalHadir = filtered.filter(a => a.status === "hadir").length;
  const totalTerlambat = filtered.filter(a => a.status === "terlambat").length;
  const totalAlpha = filtered.filter(a => a.status === "alpha").length;
  const totalLateMinutes = filtered.reduce((s, a) => s + (a.late_minutes || 0), 0);
  const totalOvertimeMinutes = filtered.reduce((s, a) => s + (a.overtime_minutes || 0), 0);

  // Employee summary
  const empSummary = {};
  filtered.forEach(a => {
    if (!empSummary[a.employee_id]) {
      empSummary[a.employee_id] = { name: a.employee_name, hadir: 0, terlambat: 0, alpha: 0, izin: 0, cuti: 0, late: 0, overtime: 0 };
    }
    const s = empSummary[a.employee_id];
    if (a.status === "hadir") s.hadir++;
    else if (a.status === "terlambat") { s.terlambat++; s.hadir++; }
    else if (a.status === "alpha") s.alpha++;
    else if (a.status === "izin") s.izin++;
    else if (a.status === "cuti") s.cuti++;
    s.late += (a.late_minutes || 0);
    s.overtime += (a.overtime_minutes || 0);
  });

  const exportCSV = () => {
    const headers = "Tanggal,Nama,ID,Masuk,Pulang,Status,Telat(m),Lembur(m),Keterangan\n";
    const rows = filtered.map(a =>
      `${a.date},${a.employee_name},${a.employee_id},${a.clock_in || ""},${a.clock_out || ""},${a.status},${a.late_minutes || 0},${a.overtime_minutes || 0},"${(a.notes || "").replace(/"/g,'""')}"`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan_absensi_${dateRange.start}_${dateRange.end}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Dari Tanggal</Label>
            <Input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Sampai Tanggal</Label>
            <Input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cabang</Label>
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Cabang</SelectItem>
                {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={exportCSV} className="gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Hadir", value: totalHadir, color: "text-accent" },
          { label: "Terlambat", value: totalTerlambat, color: "text-chart-3" },
          { label: "Alpha", value: totalAlpha, color: "text-destructive" },
          { label: "Total Telat", value: `${totalLateMinutes}m`, color: "text-chart-3" },
          { label: "Total Lembur", value: `${totalOvertimeMinutes}m`, color: "text-primary" },
        ].map((s, i) => (
          <Card key={i} className="p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="detail">
        <TabsList>
          <TabsTrigger value="detail">Detail Harian</TabsTrigger>
          <TabsTrigger value="rekap">Rekap per Karyawan</TabsTrigger>
        </TabsList>

        <TabsContent value="detail" className="mt-4">
          <Card className="hidden sm:block">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Masuk</TableHead>
                    <TableHead>Pulang</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Telat</TableHead>
                    <TableHead>Lembur</TableHead>
                    <TableHead>Keterangan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 100).map(a => (
                    <TableRow key={a.id}>
                      <TableCell>{moment(a.date).format("DD/MM/YYYY")}</TableCell>
                      <TableCell className="font-medium">{a.employee_name}</TableCell>
                      <TableCell>{a.clock_in || "-"}</TableCell>
                      <TableCell>{a.clock_out || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${statusColors[a.status] || ""}`}>{a.status}</Badge>
                      </TableCell>
                      <TableCell>{a.late_minutes > 0 ? `${a.late_minutes}m` : "-"}</TableCell>
                      <TableCell>{a.overtime_minutes > 0 ? `${a.overtime_minutes}m` : "-"}</TableCell>
                      <TableCell className="max-w-[240px] truncate text-muted-foreground text-xs">{a.notes || "-"}</TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Tidak ada data</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card className="sm:hidden">
            <CardContent className="p-2">
              {filtered.length > 0 ? (
                <div className="space-y-2">
                  {filtered.slice(0, 100).map(a => (
                    <div key={a.id} className="border rounded-lg p-3 bg-card">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <p className="font-medium">{a.employee_name}</p>
                          <p className="text-xs text-muted-foreground">{moment(a.date).format("DD/MM/YYYY")}</p>
                          <p className="text-xs">Masuk: {a.clock_in || "-"}</p>
                          <p className="text-xs">Pulang: {a.clock_out || "-"}</p>
                          {a.notes ? <p className="text-xs text-muted-foreground mt-1">Ket: {a.notes}</p> : null}
                        </div>
                        <Badge variant="outline" className={`text-[10px] ${statusColors[a.status] || ""}`}>{a.status}</Badge>
                      </div>
                      <div className="flex gap-3 text-xs mt-1">
                        <span>Telat: {a.late_minutes > 0 ? `${a.late_minutes}m` : "-"}</span>
                        <span>Lembur: {a.overtime_minutes > 0 ? `${a.overtime_minutes}m` : "-"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">Tidak ada data</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rekap" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Karyawan</TableHead>
                    <TableHead>Hadir</TableHead>
                    <TableHead>Terlambat</TableHead>
                    <TableHead>Alpha</TableHead>
                    <TableHead>Izin</TableHead>
                    <TableHead>Cuti</TableHead>
                    <TableHead>Total Telat</TableHead>
                    <TableHead>Total Lembur</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(empSummary).map(([id, s]) => (
                    <TableRow key={id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.hadir}</TableCell>
                      <TableCell className="text-chart-3">{s.terlambat}</TableCell>
                      <TableCell className="text-destructive">{s.alpha}</TableCell>
                      <TableCell>{s.izin}</TableCell>
                      <TableCell>{s.cuti}</TableCell>
                      <TableCell>{s.late > 0 ? `${s.late}m` : "-"}</TableCell>
                      <TableCell>{s.overtime > 0 ? `${s.overtime}m` : "-"}</TableCell>
                    </TableRow>
                  ))}
                  {Object.keys(empSummary).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Tidak ada data</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <MobileNav active="Laporan" />
    </div>
  );
}
