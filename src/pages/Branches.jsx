import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { MapPin, Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";

const EMPTY_FORM = { name: "", address: "", latitude: 0, longitude: 0, radius: 100, status: "aktif" };

export default function Branches() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, selectedCompanyId } = useAuth();
  const currentCompanyId = user?.role === "superadmin"
    ? (selectedCompanyId ?? null)
    : (user?.company_id || null);

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ["branches", currentCompanyId],
    queryFn: async () => {
      const qs = currentCompanyId ? `?company_id=${currentCompanyId}` : "";
      const r = await fetch(`/api/branches${qs}`);
      if (!r.ok) return [];
      return r.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name || String(form.name).trim().length === 0) throw new Error("Nama cabang wajib diisi");
      if (form.latitude === "" || form.longitude === "") throw new Error("Koordinat wajib diisi");
      const payload = {
        name: String(form.name || "").trim(),
        address: String(form.address || ""),
        latitude: parseFloat(String(form.latitude)),
        longitude: parseFloat(String(form.longitude)),
        radius: parseInt(String(form.radius)),
        company_id: editing?.company_id ?? currentCompanyId ?? null,
        status: form.status === "nonaktif" ? "nonaktif" : "aktif"
      };
      const req = editing
        ? fetch(`/api/branches/${editing.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : fetch(`/api/branches`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const res = await req;
      if (!res.ok) {
        let msg = "Gagal menyimpan cabang";
        try { const d = await res.json(); msg = d.error || msg } catch {}
        throw new Error(msg);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      setShowForm(false); setEditing(null); setForm(EMPTY_FORM);
      toast({ title: "Tersimpan", description: "Data cabang berhasil disimpan" });
    },
    onError: (e) => toast({ title: "Gagal menyimpan", description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const r = await fetch(`/api/branches/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Gagal menghapus");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      toast({ title: "Terhapus", description: "Cabang dihapus" });
    },
    onError: (e) => toast({ title: "Gagal menghapus", description: e.message }),
  });

  const openEdit = (branch) => {
    setEditing(branch);
    setForm({ name: branch.name || "", address: branch.address || "", latitude: branch.latitude || 0, longitude: branch.longitude || 0, radius: branch.radius || 100, status: branch.status || "aktif" });
    setShowForm(true);
  };

  const getMyLocation = () => {
    navigator.geolocation.getCurrentPosition(
      pos => setForm(f => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude })),
      () => alert("Gagal mendapatkan lokasi")
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Kelola lokasi kantor dan radius absensi</p>
        <Button onClick={() => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Tambah Cabang
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {branches.map(branch => (
          <Card key={branch.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{branch.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{branch.address || "Belum ada alamat"}</p>
                  </div>
                </div>
                <Badge variant={branch.status === "aktif" ? "default" : "secondary"} className="text-[10px]">{branch.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" />
                <span>
                  {Number.isFinite(Number(branch.latitude)) ? Number(branch.latitude).toFixed(6) : String(branch.latitude)}
                  ,{" "}
                  {Number.isFinite(Number(branch.longitude)) ? Number(branch.longitude).toFixed(6) : String(branch.longitude)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Radius: <strong>{branch.radius || 100}m</strong></span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(branch)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(branch.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {branches.length === 0 && !isLoading && (
          <Card className="col-span-full p-8 text-center">
            <MapPin className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Belum ada data cabang</p>
          </Card>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Cabang" : "Tambah Cabang Baru"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Nama Cabang</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Kantor Pusat" /></div>
            <div className="space-y-1"><Label>Alamat</Label><Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Jl. Contoh No. 123" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Latitude</Label><Input type="number" step="any" value={form.latitude} onChange={e => setForm({...form, latitude: e.target.value})} /></div>
              <div className="space-y-1"><Label>Longitude</Label><Input type="number" step="any" value={form.longitude} onChange={e => setForm({...form, longitude: e.target.value})} /></div>
            </div>
            <Button variant="outline" onClick={getMyLocation} className="w-full gap-2"><MapPin className="w-4 h-4" /> Gunakan Lokasi Saat Ini</Button>
            <div className="space-y-1">
              <Label>Radius Absensi: {form.radius}m</Label>
              <Slider value={[form.radius]} onValueChange={v => setForm({...form, radius: v[0]})} min={50} max={500} step={10} />
              <p className="text-xs text-muted-foreground">Minimum 50m, Maksimum 500m</p>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aktif">Aktif</SelectItem>
                  <SelectItem value="nonaktif">Non-Aktif</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Batal</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name}>
              {saveMutation.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
