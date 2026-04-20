import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Check, X } from "lucide-react";
import moment from "moment";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import MobileNav from "@/components/mobile/MobileNav";

const statusColors = {
  pending: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  disetujui: "bg-accent/10 text-accent border-accent/20",
  ditolak: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function LeaveRequests() {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: "izin", start_date: "", end_date: "", reason: "", notes: "" });
  const [activeTab, setActiveTab] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: authUser, selectedCompanyId } = useAuth();

  useEffect(() => {
    if (authUser?.id) {
      setSelectedEmployeeId(Number(authUser.id));
    }
  }, [authUser?.id]);

  const isAdmin = (authUser?.role === "admin" || authUser?.role === "hrd" || authUser?.role === "superadmin");
  const companyId = authUser?.role === "superadmin"
    ? (selectedCompanyId ?? null)
    : (authUser?.company_id || null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["leave-requests", isAdmin ? companyId : Number(authUser?.id)],
    queryFn: async () => {
      const qs = isAdmin && companyId ? `?company_id=${companyId}` : "";
      const res = await fetch(`/api/leave-requests${qs}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const filteredByStatus = activeTab === "all" ? requests : requests.filter(r => r.status === activeTab);
  const scopedForAdmin = isAdmin
    ? (companyId ? filteredByStatus.filter(r => (r.employee_company_id || r.company_id) === companyId) : filteredByStatus)
    : filteredByStatus;
  const byType = typeFilter === "all" ? scopedForAdmin : scopedForAdmin.filter(r => r.type === typeFilter);
  const filtered = byType.filter(r => (isAdmin ? true : r.employee_id === Number(authUser?.id)));

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!authUser?.id) {
        throw new Error("Pilih karyawan terlebih dahulu");
      }
      if (!form.start_date || !form.end_date) {
        throw new Error("Tanggal mulai dan selesai wajib diisi");
      }
      const res = await fetch("/api/leave-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          start_date: form.start_date,
          end_date: form.end_date,
          reason: form.reason,
          notes: form.notes || null,
          employee_id: Number(authUser.id),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Gagal mengirim pengajuan");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      setShowForm(false);
      setForm({ type: "izin", start_date: "", end_date: "", reason: "", notes: "" });
      toast({ title: "Berhasil", description: "Pengajuan izin/cuti terkirim" });
    },
    onError: (err) => {
      toast({ title: "Gagal mengirim", description: err.message || "Terjadi kesalahan" });
    }
  });

  const handleApprove = async (id, status) => {
    try {
      const res = await fetch(`/api/leave-requests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, approved_by: authUser?.email || authUser?.full_name || "admin" }),
      });
      if (!res.ok) throw new Error("Gagal memperbarui status");
      await res.json();
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      toast({ title: "Status diperbarui", description: "Pengajuan diperbarui" });
    } catch (err) {
      toast({ title: "Gagal memperbarui", description: err.message || "Terjadi kesalahan" });
    }
  };

  const formatType = (t) => (t || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        {isAdmin && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">Semua</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="disetujui">Disetujui</TabsTrigger>
              <TabsTrigger value="ditolak">Ditolak</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        <div className="flex items-center gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[190px]"><SelectValue placeholder="Filter Jenis" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Jenis</SelectItem>
              <SelectItem value="izin">Izin</SelectItem>
              <SelectItem value="cuti">Cuti</SelectItem>
              <SelectItem value="sakit">Sakit</SelectItem>
              <SelectItem value="dinas_luar">Izin Dinas Luar</SelectItem>
              <SelectItem value="terlambat_masuk">Terlambat Masuk</SelectItem>
              <SelectItem value="lain_lain">Lain-lain</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Ajukan Izin/Cuti
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto hidden sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Alasan</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="w-28">Aksi</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(req => (
                <TableRow key={req.id}>
                  <TableCell className="font-medium">{req.employee_name}</TableCell>
                  <TableCell className="capitalize">{formatType(req.type)}</TableCell>
                  <TableCell className="text-sm">
                    {moment(req.start_date).format("DD/MM")} - {moment(req.end_date).format("DD/MM/YY")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{req.reason}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{req.notes || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${statusColors[req.status] || ""}`}>
                      {req.status}
                    </Badge>
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      {req.status === "pending" && (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => handleApprove(req.id, "disetujui")}>
                            <Check className="w-4 h-4 text-accent" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleApprove(req.id, "ditolak")}>
                            <X className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 6 : 5} className="text-center text-muted-foreground py-8">
                    Belum ada pengajuan
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        <CardContent className="p-2 sm:hidden">
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="h-20 rounded bg-muted/50" />)}
            </div>
          ) : filtered.length > 0 ? (
            <div className="space-y-2">
              {filtered.map(req => (
                <div key={req.id} className="border rounded-lg p-3 bg-card">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{req.employee_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{req.type}</p>
                      <p className="text-xs">
                        {moment(req.start_date).format("DD/MM")} - {moment(req.end_date).format("DD/MM/YY")}
                      </p>
                      {req.reason && <p className="text-xs text-muted-foreground truncate">{req.reason}</p>}
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${statusColors[req.status] || ""}`}>{req.status}</Badge>
                  </div>
                  {isAdmin && req.status === "pending" && (
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => handleApprove(req.id, "disetujui")}>
                        Setujui
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => handleApprove(req.id, "ditolak")}>
                        Tolak
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">Belum ada pengajuan</div>
          )}
        </CardContent>
      </Card>
      <MobileNav active="Absensi" />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajukan Izin / Cuti</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Jenis</Label>
              <Select value={form.type} onValueChange={v => setForm({...form, type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="izin">Izin</SelectItem>
                  <SelectItem value="cuti">Cuti</SelectItem>
                  <SelectItem value="sakit">Sakit</SelectItem>
                  <SelectItem value="dinas_luar">Izin Dinas Luar</SelectItem>
                  <SelectItem value="terlambat_masuk">Terlambat Masuk Kerja</SelectItem>
                  <SelectItem value="lain_lain">Lain-lain</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tanggal Mulai</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} />
              </div>
              <div className="space-y-1">
                <Label>Tanggal Selesai</Label>
                <Input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Alasan</Label>
              <Textarea value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} placeholder="Jelaskan alasan pengajuan..." rows={3} />
            </div>
            <div className="space-y-1">
              <Label>Keterangan</Label>
              <Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Tambahkan keterangan (opsional)..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Batal</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Mengirim..." : "Kirim Pengajuan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
