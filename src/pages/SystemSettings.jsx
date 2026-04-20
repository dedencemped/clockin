import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, Calendar, Save, Loader2, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function SystemSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, selectedCompanyId } = useAuth();
  
  const currentCompanyId = user?.role === "superadmin"
    ? (selectedCompanyId ?? null)
    : (user?.company_id || null);

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["system-settings", currentCompanyId],
    queryFn: async () => {
      const qs = currentCompanyId ? `?company_id=${currentCompanyId}` : "";
      const res = await fetch(`/api/system-settings${qs}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: shifts = [], isLoading: isLoadingShifts } = useQuery({
    queryKey: ["shifts", currentCompanyId],
    queryFn: async () => {
      const qs = currentCompanyId ? `?company_id=${currentCompanyId}` : "";
      const res = await fetch(`/api/shifts${qs}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const [showShiftForm, setShowShiftForm] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [shiftForm, setShiftForm] = useState({ name: "", start_time: "08:00", end_time: "17:00" });

  const saveShiftMutation = useMutation({
    mutationFn: async () => {
      console.log('Saving shift with form:', shiftForm, 'currentCompanyId:', currentCompanyId);
      if (!currentCompanyId) {
        throw new Error("Pilih perusahaan terlebih dahulu (untuk Super Admin)");
      }
      if (!shiftForm.name || !shiftForm.start_time || !shiftForm.end_time) {
        throw new Error("Semua field harus diisi");
      }
      const payload = { ...shiftForm, company_id: currentCompanyId };
      const url = editingShift ? `/api/shifts/${editingShift.id}` : `/api/shifts`;
      const res = await fetch(url, {
        method: editingShift ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let msg = "Gagal menyimpan shift";
        try { 
          const data = await res.json(); 
          console.error('Server error saving shift:', data);
          msg = data.error || msg;
        } catch (e) {
          console.error('Failed to parse error response:', e);
        }
        throw new Error(msg);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      setShowShiftForm(false);
      setEditingShift(null);
      setShiftForm({ name: "", start_time: "08:00", end_time: "17:00" });
      toast({ title: "Berhasil", description: "Shift berhasil disimpan" });
    },
    onError: (e) => {
      toast({ title: "Gagal menyimpan shift", description: e.message, variant: "destructive" });
    }
  });

  const deleteShiftMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/shifts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus shift");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      toast({ title: "Terhapus", description: "Shift telah dihapus" });
    },
    onError: (e) => {
      toast({ title: "Gagal menghapus shift", description: e.message, variant: "destructive" });
    }
  });

  const getSetting = (key, defaultVal) => {
    const found = settings.find(s => s.key === key);
    if (found) {
      try { return JSON.parse(found.value); } catch { return defaultVal; }
    }
    return defaultVal;
  };

  const [managedCompanyName, setManagedCompanyName] = useState("");
  useEffect(() => {
    if (user?.role === "superadmin" && currentCompanyId) {
      fetch(`/api/companies`).then(r => r.json()).then(rows => {
        const c = Array.isArray(rows) ? rows.find(x => x.id === currentCompanyId) : null;
        setManagedCompanyName(c?.name || "");
      }).catch(()=>{});
    }
  }, [currentCompanyId, user?.role]);

  const [workHours, setWorkHours] = useState({ start: "08:00", end: "17:00" });
  const [lateThreshold, setLateThreshold] = useState(15);
  const [workDays, setWorkDays] = useState([1, 2, 3, 4, 5]);
  const [holidays, setHolidays] = useState([]);
  const [newHoliday, setNewHoliday] = useState({ date: "", name: "" });

  useEffect(() => {
    if (settings.length > 0) {
      setWorkHours(getSetting("work_hours", { start: "08:00", end: "17:00" }));
      setLateThreshold(getSetting("late_threshold", 15));
      setWorkDays(getSetting("work_days", [1, 2, 3, 4, 5]));
      setHolidays(getSetting("holidays", []));
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = [
        { key: "work_hours", value: JSON.stringify(workHours), description: "Jam kerja" },
        { key: "late_threshold", value: JSON.stringify(lateThreshold), description: "Batas terlambat (menit)" },
        { key: "work_days", value: JSON.stringify(workDays), description: "Hari kerja" },
        { key: "holidays", value: JSON.stringify(holidays), description: "Hari libur" },
      ];

      for (const u of updates) {
        const existing = settings.find(s => s.key === u.key);
        const payload = { key: u.key, value: u.value, description: u.description };
        if (currentCompanyId) payload.company_id = currentCompanyId;
        const req = existing
          ? fetch(`/api/system-settings/${existing.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : fetch(`/api/system-settings`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
        const res = await req;
        if (!res.ok) {
          let msg = `Gagal menyimpan ${u.key}`;
          try { const d = await res.json(); msg = d.error || msg } catch {}
          throw new Error(msg);
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["system-settings", currentCompanyId] });
      return true;
    },
    onSuccess: () => {
      toast({ title: "Tersimpan", description: "Pengaturan berhasil disimpan" });
      queryClient.invalidateQueries({ queryKey: ["system-settings-mobile"] });
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
    },
    onError: (e) => {
      toast({ title: "Gagal menyimpan", description: e.message || "Terjadi kesalahan" });
    },
  });

  const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

  const toggleDay = (day) => {
    if (workDays.includes(day)) {
      setWorkDays(workDays.filter(d => d !== day));
    } else {
      setWorkDays([...workDays, day].sort());
    }
  };

  const addHoliday = () => {
    if (newHoliday.date && newHoliday.name) {
      setHolidays([...holidays, newHoliday]);
      setNewHoliday({ date: "", name: "" });
    }
  };

  const removeHoliday = (index) => {
    setHolidays(holidays.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    try {
      if (!workHours.start || !workHours.end) {
        toast({ title: "Jam kerja tidak valid", description: "Isi jam masuk dan jam pulang" });
        return;
      }
      if (workHours.start >= workHours.end) {
        toast({ title: "Jam kerja tidak valid", description: "Jam pulang harus setelah jam masuk" });
        return;
      }
      saveMutation.mutate();
    } catch (e) {
      toast({ title: "Gagal menyimpan", description: e.message || "Terjadi kesalahan" });
    }
  };

  if (isLoading || isLoadingShifts) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Pengaturan Sistem</h1>
        <p className="text-muted-foreground">
          {user?.role === "superadmin" 
            ? (currentCompanyId ? `Mengelola pengaturan untuk perusahaan: ${managedCompanyName}` : "Pilih perusahaan di menu Super Admin untuk mengelola pengaturan")
            : "Kelola preferensi dan jadwal kerja perusahaan Anda"}
        </p>
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* Shifts */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Daftar Shift Kerja
            </CardTitle>
            <Button size="sm" onClick={() => { setEditingShift(null); setShiftForm({ name: "", start_time: "08:00", end_time: "17:00" }); setShowShiftForm(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Tambah Shift
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {shifts.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div>
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {s.start_time?.slice(0, 5) || "00:00"} - {s.end_time?.slice(0, 5) || "00:00"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => { 
                        setEditingShift(s); 
                        setShiftForm({ 
                          name: s.name, 
                          start_time: s.start_time?.slice(0, 5) || "08:00", 
                          end_time: s.end_time?.slice(0, 5) || "17:00" 
                        }); 
                        setShowShiftForm(true); 
                      }}
                    >
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteShiftMutation.mutate(s.id)} className="text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {shifts.length === 0 && (
                <div className="text-center py-6 border-2 border-dashed rounded-lg">
                  <p className="text-sm text-muted-foreground">Belum ada shift. Silahkan tambah shift baru.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Work Hours Fallback */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Jam Kerja Default (Non-Shift)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Jam Masuk</Label>
                <Input type="time" value={workHours.start} onChange={e => setWorkHours({...workHours, start: e.target.value})} />
              </div>
              <div className="space-y-1">
                <Label>Jam Pulang</Label>
                <Input type="time" value={workHours.end} onChange={e => setWorkHours({...workHours, end: e.target.value})} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Batas Keterlambatan (menit)</Label>
              <Input type="number" value={lateThreshold} onChange={e => setLateThreshold(parseInt(e.target.value) || 0)} />
              <p className="text-xs text-muted-foreground">Karyawan dianggap terlambat jika masuk lebih dari {lateThreshold} menit setelah jam masuk</p>
            </div>
          </CardContent>
        </Card>

        {/* Work Days */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" /> Hari Kerja
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {dayNames.map((name, index) => (
                <Button
                  key={index}
                  variant={workDays.includes(index) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleDay(index)}
                  className="min-w-[80px]"
                >
                  {name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Holidays */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-destructive" /> Hari Libur Nasional
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input type="date" value={newHoliday.date} onChange={e => setNewHoliday({...newHoliday, date: e.target.value})} className="flex-1" />
              <Input value={newHoliday.name} onChange={e => setNewHoliday({...newHoliday, name: e.target.value})} placeholder="Nama hari libur" className="flex-1" />
              <Button variant="outline" onClick={addHoliday}>Tambah</Button>
            </div>
            {holidays.length > 0 && (
              <div className="space-y-2">
                {holidays.map((h, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">{h.name}</p>
                      <p className="text-xs text-muted-foreground">{h.date}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeHoliday(i)} className="text-destructive">Hapus</Button>
                  </div>
                ))}
              </div>
            )}
            {holidays.length === 0 && <p className="text-sm text-muted-foreground">Belum ada hari libur ditambahkan</p>}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="w-full gap-2"
            size="lg"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Simpan Pengaturan
          </Button>
          <p className="text-xs text-center text-muted-foreground italic">
            * Pengaturan ini akan berlaku untuk seluruh operasional perusahaan
          </p>
        </div>
      </div>

      <Dialog open={showShiftForm} onOpenChange={setShowShiftForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingShift ? "Edit Shift" : "Tambah Shift Baru"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nama Shift</Label>
              <Input 
                value={shiftForm.name} 
                onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })} 
                placeholder="Misal: Shift Pagi" 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Jam Masuk</Label>
                <Input 
                  type="time" 
                  value={shiftForm.start_time} 
                  onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })} 
                />
              </div>
              <div className="space-y-2">
                <Label>Jam Pulang</Label>
                <Input 
                  type="time" 
                  value={shiftForm.end_time} 
                  onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })} 
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShiftForm(false)}>Batal</Button>
            <Button onClick={() => saveShiftMutation.mutate()} disabled={saveShiftMutation.isPending}>
              {saveShiftMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Simpan Shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
