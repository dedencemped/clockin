import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Pencil, Trash2, UserPlus, Download } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";

const EMPTY_FORM = {
  employee_id: "", nik: "", full_name: "", email: "", phone: "", position: "",
  department: "", branch_id: "", role: "karyawan", status: "aktif", join_date: "", shift_id: "none"
};

export default function Employees() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, selectedCompanyId } = useAuth();
  const currentCompanyId = user?.role === "superadmin"
    ? (selectedCompanyId ?? null)
    : (user?.company_id || null);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees", currentCompanyId],
    queryFn: async () => {
      const qs = currentCompanyId ? `?company_id=${currentCompanyId}` : "";
      const r = await fetch(`/api/employees${qs}`);
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches", currentCompanyId],
    queryFn: async () => {
      const qs = currentCompanyId ? `?company_id=${currentCompanyId}` : "";
      const r = await fetch(`/api/branches${qs}`);
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ["shifts", currentCompanyId],
    queryFn: async () => {
      const qs = currentCompanyId ? `?company_id=${currentCompanyId}` : "";
      const r = await fetch(`/api/shifts${qs}`);
      if (!r.ok) return [];
      return r.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.full_name || String(form.full_name).trim().length === 0) {
        throw new Error("Nama wajib diisi");
      }
      const payload = {
        employee_id: form.employee_id || null,
        company_id: editingEmployee?.company_id ?? currentCompanyId ?? null,
        nik: form.nik || null,
        full_name: form.full_name,
        email: form.email || null,
        role: form.role || "karyawan",
        status: form.status || "aktif",
        position: form.position || null,
        department: form.department || null,
        phone: form.phone || null,
        branch_id: form.branch_id ? Number(form.branch_id) : null,
        shift_id: (form.shift_id && form.shift_id !== "none") ? Number(form.shift_id) : null,
        join_date: form.join_date || null,
      };
      const req = editingEmployee
        ? fetch(`/api/employees/${editingEmployee.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : fetch(`/api/employees`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const res = await req;
      if (!res.ok) {
        let msg = "Gagal menyimpan karyawan";
        try { const d = await res.json(); msg = d.error || msg } catch {}
        throw new Error(msg);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setShowForm(false);
      setEditingEmployee(null);
      setForm(EMPTY_FORM);
      toast({ title: "Tersimpan", description: "Data karyawan berhasil disimpan" });
    },
    onError: (e) => toast({ title: "Gagal menyimpan", description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const r = await fetch(`/api/employees/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Gagal menghapus");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast({ title: "Terhapus", description: "Data karyawan dihapus" });
    },
    onError: (e) => toast({ title: "Gagal menghapus", description: e.message }),
  });

  const openEdit = (emp) => {
    setEditingEmployee(emp);
    setForm({
      employee_id: emp.employee_id || "", nik: emp.nik || "", full_name: emp.full_name || "",
      email: emp.email || "", phone: emp.phone || "", position: emp.position || "",
      department: emp.department || "", branch_id: emp.branch_id ? String(emp.branch_id) : "",
      role: emp.role || "karyawan", status: emp.status || "aktif", join_date: emp.join_date || "",
      shift_id: emp.shift_id ? String(emp.shift_id) : "none",
    });
    setShowForm(true);
  };

  const dataToFilter = Array.isArray(employees) ? employees : [];
  const scoped = (user?.role === "superadmin")
    ? (currentCompanyId ? dataToFilter.filter(e => e.company_id === currentCompanyId) : dataToFilter)
    : (currentCompanyId ? dataToFilter.filter(e => e.company_id === currentCompanyId) : dataToFilter);
  const filtered = scoped.filter(e =>
    e.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    e.employee_id?.toLowerCase().includes(search.toLowerCase()) ||
    e.email?.toLowerCase().includes(search.toLowerCase())
  );

  const branchList = Array.isArray(branches) ? branches : [];
  const shiftList = Array.isArray(shifts) ? shifts : [];

  const roleColors = { admin: "bg-destructive/10 text-destructive", hrd: "bg-primary/10 text-primary", karyawan: "bg-accent/10 text-accent" };

  const downloadCsvTemplate = () => {
    const cols = [
      "employee_id",
      "nik",
      "full_name",
      "email",
      "phone",
      "position",
      "department",
      "role",
      "status",
      "branch_id",
      "join_date",
      "company_id"
    ];
    const example = [
      "EMP-001",
      "",
      "Nama Lengkap",
      "email@perusahaan.com",
      "08xxxxxxxxxx",
      "Staff",
      "Operasional",
      "karyawan",
      "aktif",
      "",
      "2026-01-01",
      String(currentCompanyId ?? "")
    ];
    // Buat CSV yang rapi: header + satu baris contoh
    const csv = cols.join(",") + "\n" + example.map(v => {
      const val = v ?? "";
      return /[",\n]/.test(val) ? `"${String(val).replace(/"/g, '""')}"` : val;
    }).join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "format_karyawan.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Cari karyawan..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { setEditingEmployee(null); setForm(EMPTY_FORM); setShowForm(true); }} className="gap-2">
            <UserPlus className="w-4 h-4" /> Tambah Karyawan
          </Button>
          <Button variant="outline" onClick={downloadCsvTemplate} className="gap-2">
            <Download className="w-4 h-4" /> Download CSV
          </Button>
          <ImportCSV inline companyId={currentCompanyId} onImported={() => queryClient.invalidateQueries({ queryKey: ["employees"] })} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded" />)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead><TableHead>Nama</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead className="hidden md:table-cell">Jabatan</TableHead>
                    <TableHead className="hidden md:table-cell">Departemen</TableHead>
                    <TableHead>Shift</TableHead>
                    <TableHead>Role</TableHead><TableHead>Status</TableHead>
                    <TableHead className="w-24">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(emp => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-mono text-xs">{emp.employee_id}</TableCell>
                      <TableCell className="font-medium">{emp.full_name}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{emp.email}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{emp.position}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{emp.department || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {emp.shift_name || "Default"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${roleColors[emp.role] || ""}`}>{emp.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={emp.status === "aktif" ? "default" : "secondary"} className="text-[10px]">{emp.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(emp)}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(emp.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{search ? "Tidak ditemukan" : "Belum ada data karyawan"}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingEmployee ? "Edit Karyawan" : "Tambah Karyawan"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            <div className="space-y-1.5">
              <Label>ID Karyawan</Label>
              <Input value={form.employee_id} onChange={e => setForm({...form, employee_id: e.target.value})} placeholder="Misal: EMP-001" />
            </div>
            <div className="space-y-1.5">
              <Label>NIK</Label>
              <Input value={form.nik} onChange={e => setForm({...form, nik: e.target.value})} placeholder="Nomor Induk Kependudukan" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nama Lengkap <span className="text-destructive">*</span></Label>
              <Input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} placeholder="Masukkan nama lengkap" required />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="email@perusahaan.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Telepon</Label>
              <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="08xxxxxxxxxx" />
            </div>
            <div className="space-y-1.5">
              <Label>Jabatan</Label>
              <Input value={form.position} onChange={e => setForm({...form, position: e.target.value})} placeholder="Misal: Staff" />
            </div>
            <div className="space-y-1.5">
              <Label>Departemen</Label>
              <Input value={form.department} onChange={e => setForm({...form, department: e.target.value})} placeholder="Misal: Operasional" />
            </div>
            <div className="space-y-1.5">
              <Label>Cabang</Label>
              <Select value={form.branch_id} onValueChange={v => setForm({...form, branch_id: v})}>
                <SelectTrigger><SelectValue placeholder="Pilih cabang" /></SelectTrigger>
                <SelectContent>
                  {branchList.map(b => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Shift Kerja</Label>
              <Select value={form.shift_id} onValueChange={v => setForm({...form, shift_id: v})}>
                <SelectTrigger><SelectValue placeholder="Pilih shift" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Default (Global)</SelectItem>
                  {shiftList.map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name} ({s.start_time?.slice(0, 5) || "00:00"} - {s.end_time?.slice(0, 5) || "00:00"})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={v => setForm({...form, role: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="karyawan">Karyawan</SelectItem>
                  <SelectItem value="hrd">HRD</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aktif">Aktif</SelectItem>
                  <SelectItem value="nonaktif">Nonaktif</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Tanggal Masuk</Label>
              <Input type="date" value={form.join_date} onChange={e => setForm({...form, join_date: e.target.value})} />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowForm(false)}>Batal</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.full_name}>
              {saveMutation.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Import CSV trigger dipindah ke toolbar atas */}
    </div>
  );
}

function ImportCSV({ onImported, companyId, inline = false }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const { toast } = useToast();
  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Pilih file CSV");
      const text = await file.text();
      const records = parseCSV(text);
      const params = companyId ? `?company_id=${companyId}` : "";
      const res = await fetch(`/api/employees/import${params}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records, company_id: companyId || null }),
      });
      if (!res.ok) {
        let msg = "Gagal import CSV";
        try { const d = await res.json(); msg = d.error || msg } catch {}
        throw new Error(msg);
      }
      return res.json();
    },
    onSuccess: (d) => {
      toast({ title: "Import selesai", description: `Berhasil menambah ${d.inserted || 0} baris${d.skipped ? `, dilewati ${d.skipped}` : ""}` });
      setOpen(false); setFile(null); onImported?.();
    },
    onError: (e) => toast({ title: "Gagal import", description: e.message }),
  });
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className={inline ? "gap-2" : "mt-4"}>
        Import CSV
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Import CSV Karyawan</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Format kolom: employee_id, nik, full_name, email, phone, position, department, role, status, branch_id, join_date
            </p>
            <Input type="file" accept=".csv,text/csv" onChange={e => setFile(e.target.files?.[0] || null)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !file}>
              {mutation.isPending ? "Memproses..." : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  let headerLine = lines[0].replace(/^\uFEFF/, ""); // remove BOM if present
  // Detect delimiter: use the one with more occurrences in header
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semiCount = (headerLine.match(/;/g) || []).length;
  const delim = semiCount > commaCount ? ";" : ",";
  const headers = headerLine.split(delim).map(h => h.trim().toLowerCase());
  const unquote = (s) => {
    if (s == null) return "";
    let v = s.trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    v = v.replace(/""/g, '"');
    return v;
  };
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Simple CSV split respecting quotes: fallback to split by delim if no quotes
    const parts = [];
    let cur = "", inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === '"') {
        if (inQuotes && line[j + 1] === '"') { cur += '"'; j++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === delim && !inQuotes) {
        parts.push(cur); cur = "";
      } else {
        cur += ch;
      }
    }
    parts.push(cur);
    const obj = {};
    headers.forEach((h, idx) => obj[h] = unquote(parts[idx] ?? ""));
    rows.push(obj);
  }
  return rows;
}
