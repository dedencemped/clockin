import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LogIn, LogOut, Camera, MapPin, Clock as ClockIcon, History } from "lucide-react";
import MobileNav from "@/components/mobile/MobileNav";
import moment from "moment";
import CameraCapture from "@/components/attendance/CameraCapture";
import LocationCheck, { getDistance } from "@/components/attendance/LocationCheck";
import { useToast } from "@/components/ui/use-toast";
import { Label } from "@/components/ui/label";
import { useQuery as rqUseQuery } from "@tanstack/react-query";

export default function Attendance() {
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [clockType, setClockType] = useState("in"); // "in" or "out"
  const [location, setLocation] = useState({ lat: null, lng: null, loading: true });
  const [now, setNow] = useState(new Date());
  const queryClient = useQueryClient();
  const today = moment().format("YYYY-MM-DD");
  const { toast } = useToast();
  const [outNotes, setOutNotes] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem('auth_user');
    if (raw) {
      try {
        const u = JSON.parse(raw);
        setUser(u);
        fetch('/api/employees').then(r => r.json()).then(list => {
          const me = list.find(e => e.email === u.email) || list.find(e => e.id === u.id);
          if (me) setEmployee(me);
        });
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, loading: false }),
        () => setLocation({ lat: null, lng: null, loading: false }),
        { enableHighAccuracy: true }
      );
    } else {
      setLocation({ lat: null, lng: null, loading: false });
    }
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: branches = [] } = useQuery({
    queryKey: ["branches", employee?.company_id],
    queryFn: async () => {
      const qs = employee?.company_id ? `?company_id=${employee.company_id}` : "";
      const res = await fetch(`/api/branches${qs}`);
      if (!res.ok) return [];
      const rows = await res.json();
      return rows.filter(b => b.status === "aktif");
    },
  });

  const { data: todayRecord = [], isLoading } = useQuery({
    queryKey: ["my-attendance", today, employee?.id],
    queryFn: async () => {
      if (!employee) return [];
      const res = await fetch(`/api/attendance?date=${today}`);
      if (!res.ok) return [];
      const rows = await res.json();
      const mine = rows.filter(r => r.employee_id === employee.id);
      return mine.map(r => ({
        ...r,
        clock_in: r.check_in ? r.check_in?.slice(11,16) : null,
        clock_out: r.check_out ? r.check_out?.slice(11,16) : null,
      }));
    },
    enabled: !!employee,
  });

  const { data: historyData = [] } = useQuery({
    queryKey: ["my-history", employee?.employee_id],
    queryFn: async () => {
      if (!employee) return [];
      const res = await fetch(`/api/attendance`);
      if (!res.ok) return [];
      const rows = await res.json();
      return rows
        .filter(r => r.employee_id === employee.id)
        .slice(0, 30)
        .map(r => ({
          ...r,
          clock_in: r.check_in ? r.check_in?.slice(11,16) : null,
          clock_out: r.check_out ? r.check_out?.slice(11,16) : null,
        }));
    },
    enabled: !!employee,
  });

  const myToday = todayRecord[0];

  // Load system settings for holidays
  const { data: settingsRows = [] } = rqUseQuery({
    queryKey: ["system-settings-attendance", employee?.company_id],
    queryFn: async () => {
      if (!employee) return [];
      const qs = employee?.company_id ? `?company_id=${employee.company_id}` : "";
      const r = await fetch(`/api/system-settings${qs}`);
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!employee,
  });
  let holidays = [];
  const hRow = settingsRows.find(s => s.key === "holidays");
  if (hRow) {
    try { const v = JSON.parse(hRow.value); if (Array.isArray(v)) holidays = v; } catch {}
  }
  const todayStr = moment().format("YYYY-MM-DD");
  const todayHoliday = holidays.find(h => h?.date === todayStr);
  const isWeekend = ![1, 2, 3, 4, 5, 6].includes(moment().isoWeekday()); // Default assuming Sunday is non-work, adjust if needed

  let startTimeCfg = "08:00";
  let endTimeCfg = "17:00";
  let shiftName = "Jam Kerja";

  if (employee?.shift_id) {
    startTimeCfg = employee.shift_start?.slice(0, 5) || "08:00";
    endTimeCfg = employee.shift_end?.slice(0, 5) || "17:00";
    shiftName = employee.shift_name || "Shift";
  } else {
    const whRow = settingsRows.find(s => s.key === "work_hours");
    if (whRow) {
      try {
        const v = JSON.parse(whRow.value);
        startTimeCfg = v.start || "08:00";
        endTimeCfg = v.end || "17:00";
        shiftName = v.name || "Jam Kerja";
      } catch {}
    }
  }

  // Determine work days from settings
  let workDays = [1, 2, 3, 4, 5]; // Default Mon-Fri
  const wdRow = settingsRows.find(s => s.key === "work_days");
  if (wdRow) {
    try { const v = JSON.parse(wdRow.value); if (Array.isArray(v)) workDays = v; } catch {}
  }
  const isWorkDay = workDays.includes(moment().day()); // moment().day() is 0 (Sun) to 6 (Sat)

  const isEarlyOut = clockType === "out" && moment().isBefore(moment(endTimeCfg, "HH:mm"));

  const clockMutation = useMutation({
    mutationFn: async ({ photo, notes }) => {
      const now = moment().format("HH:mm");
      // Photo upload nonaktif pada mode lokal

      // Determine matched branch
      const matchedBranch = branches.find(b => {
        if (!location.lat) return false;
        return getDistance(location.lat, location.lng, b.latitude, b.longitude) <= (b.radius || 100);
      });

      if (clockType === "in") {
        // Check for late
        let lateMinutes = 0;
        const start = moment(startTimeCfg, "HH:mm");
        const arrival = moment(now, "HH:mm");
        if (arrival.isAfter(start)) {
          lateMinutes = arrival.diff(start, "minutes");
        }
        
        // Determine automatic status
        let autoStatus = "hadir";
        if (!isWorkDay || todayHoliday) {
          autoStatus = "lembur";
        } else if (lateMinutes > 0) {
          autoStatus = "terlambat";
        }

        await fetch("/api/attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employee_id: employee.id,
            date: today,
            check_in_time: now,
            status: autoStatus,
            late_minutes: lateMinutes,
            branch_id: matchedBranch?.id || null,
          })
        });
      } else {
        // Clock out
        let overtimeMinutes = 0;
        const end = moment(endTimeCfg, "HH:mm");
        const leave = moment(now, "HH:mm");
        if (leave.isAfter(end)) {
          overtimeMinutes = leave.diff(end, "minutes");
        }

        // If it's a non-work day, everything is overtime
        if (!isWorkDay || todayHoliday) {
          const checkInTime = moment(myToday.check_in_time, "HH:mm:ss");
          overtimeMinutes = leave.diff(checkInTime, "minutes");
        }

        const res = await fetch(`/api/attendance/${myToday.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            check_out_time: now,
            status: myToday.status,
            overtime_minutes: overtimeMinutes,
            notes: notes || null
          })
        });
        if (!res.ok) {
          let msg = "Gagal menyimpan absen pulang";
          try { const d = await res.json(); msg = d.error || msg } catch {}
          throw new Error(msg);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-attendance"] });
      queryClient.invalidateQueries({ queryKey: ["my-history"] });
      setShowCamera(false);
      setOutNotes("");
    },
    onError: async (e) => {
      toast({ title: "Gagal menyimpan", description: e?.message || "Terjadi kesalahan saat menyimpan absen" });
    }
  });

  const handleClockAction = (type) => {
    setClockType(type);
    setShowCamera(true);
  };

  const canClockIn = !myToday && !todayHoliday;
  const canClockOut = myToday && !myToday.clock_out && !todayHoliday;

  const statusColors = {
    hadir: "bg-accent/10 text-accent",
    terlambat: "bg-chart-3/10 text-chart-3",
    alpha: "bg-destructive/10 text-destructive",
    izin: "bg-primary/10 text-primary",
    cuti: "bg-chart-5/10 text-chart-5",
  };

  if (!employee && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <MapPin className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Data Karyawan Tidak Ditemukan</h2>
        <p className="text-muted-foreground">Hubungi admin untuk mendaftarkan akun Anda sebagai karyawan.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="clock">
        <TabsList>
          <TabsTrigger value="clock" className="gap-2"><ClockIcon className="w-4 h-4" /> Absensi</TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><History className="w-4 h-4" /> Riwayat</TabsTrigger>
        </TabsList>

        <TabsContent value="clock" className="mt-4 space-y-4">
          <Card className="text-center py-8">
            <p className="text-5xl font-bold text-foreground tracking-tight">{moment().format("HH:mm")}</p>
            <p className="text-sm text-muted-foreground mt-2">{moment().format("dddd, D MMMM YYYY")}</p>
          </Card>
          {todayHoliday && (
            <div className="bg-red-100 text-red-600 text-center text-sm py-3 rounded-xl">
              Hari Libur Nasional: {todayHoliday.name || "Libur"} — Presensi nonaktif
            </div>
          )}
          <div className="sm:hidden">
            <div className="flex flex-col items-center gap-3">
              <p className="text-center text-xl font-semibold">PRESENSI</p>
              <AnalogClock now={now} size={220} />
            </div>
            {!myToday && (
              <div className="mt-4">
                <div className="bg-destructive/15 text-destructive px-4 py-2 rounded-xl text-center text-sm">
                  Anda belum presensi hari ini !
                </div>
              </div>
            )}
            <div className="mt-4 space-y-3">
              {branches.map(b => {
                const dist = location.lat ? Math.round(getDistance(location.lat, location.lng, b.latitude, b.longitude)) : null;
                const inside = dist !== null ? dist <= (b.radius || 100) : null;
                return (
                  <Card key={b.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold">{b.name}</p>
                        <p className="text-xs text-muted-foreground">{b.address || "-"}</p>
                      </div>
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className={`mt-3 text-xs px-3 py-2 rounded-lg border ${inside === false ? 'text-destructive border-destructive/40 bg-destructive/10' : 'text-accent border-accent/40 bg-accent/10'}`}>
                      {inside === false ? 'Anda di luar radius area ini' : inside === true ? 'Anda di dalam radius area ini' : 'Menentukan posisi...'}
                      {dist !== null && <span className="ml-2 text-muted-foreground">(±{dist}m)</span>}
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>

          <LocationCheck
            userLat={location.lat}
            userLng={location.lng}
            branches={branches}
            loading={location.loading}
          />

          {myToday && (
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Status Hari Ini</p>
                  <Badge className={statusColors[myToday.status]}>{myToday.status}</Badge>
                </div>
                <div className="text-right space-y-1">
                  {myToday.clock_in && <p className="text-sm"><span className="text-muted-foreground">Masuk:</span> <strong>{myToday.clock_in}</strong></p>}
                  {myToday.clock_out && <p className="text-sm"><span className="text-muted-foreground">Pulang:</span> <strong>{myToday.clock_out}</strong></p>}
                  {myToday.late_minutes > 0 && <p className="text-xs text-chart-3">Terlambat {myToday.late_minutes} menit</p>}
                  {myToday.notes && <p className="text-xs text-muted-foreground">Keterangan: {myToday.notes}</p>}
                </div>
              </div>
            </Card>
          )}

        {/* Determine if inside any allowed branch radius */}
        {/* Disable actions when user is outside radius */}
        {(() => {})()}
        {/* compute inside flag */}
        {/* keep simple boolean for buttons */}
        {/* if location is loading, buttons are already disabled by location.loading */}
        {/* when no location available, treat as outside */}
        {/* safe guard for empty branches */}
        {/* distance in meters */}
        {/* radius default 100 */}
        
        {/* Inline computation kept in scope */}
        {/* eslint-disable-next-line no-unused-vars */}
        {/* This is only to keep consistent placement before buttons */}
        
        {/* end compute */}

          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={() => handleClockAction("in")}
              disabled={
                !canClockIn ||
                location.loading ||
                clockMutation.isPending ||
                !(location.lat && branches.some(b => getDistance(location.lat, location.lng, b.latitude, b.longitude) <= (b.radius || 100)))
              }
              className="h-16 text-base gap-2 bg-primary hover:bg-primary/90"
              size="lg"
            >
              <LogIn className="w-5 h-5" /> Absen Masuk
            </Button>
            <Button
              onClick={() => handleClockAction("out")}
              disabled={
                !canClockOut ||
                location.loading ||
                clockMutation.isPending ||
                !(location.lat && branches.some(b => getDistance(location.lat, location.lng, b.latitude, b.longitude) <= (b.radius || 100)))
              }
              variant="outline"
              className="h-16 text-base gap-2"
              size="lg"
            >
              <LogOut className="w-5 h-5" /> Absen Pulang
            </Button>
          </div>

          <div className="sm:hidden h-16" />
          <MobileNav active="Absensi" />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card className="hidden sm:block">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Masuk</TableHead>
                      <TableHead>Pulang</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Telat</TableHead>
                      <TableHead>Lembur</TableHead>
                      <TableHead>Keterangan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyData.map(att => (
                      <TableRow key={att.id}>
                        <TableCell className="font-medium">{moment(att.date).format("DD/MM/YYYY")}</TableCell>
                        <TableCell>{att.clock_in || "-"}</TableCell>
                        <TableCell>{att.clock_out || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${statusColors[att.status] || ""}`}>
                            {att.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{att.late_minutes > 0 ? `${att.late_minutes}m` : "-"}</TableCell>
                        <TableCell>{att.overtime_minutes > 0 ? `${att.overtime_minutes}m` : "-"}</TableCell>
                        <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground">{att.notes || "-"}</TableCell>
                      </TableRow>
                    ))}
                    {historyData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Belum ada riwayat absensi</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          <Card className="sm:hidden">
            <CardContent className="p-2">
              {historyData.length > 0 ? (
                <div className="space-y-2">
                  {historyData.map(att => (
                    <div key={att.id} className="border rounded-lg p-3 bg-card">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <p className="font-medium">{moment(att.date).format("DD/MM/YYYY")}</p>
                          <p className="text-xs">Masuk: {att.clock_in || "-"}</p>
                          <p className="text-xs">Pulang: {att.clock_out || "-"}</p>
                          {att.notes ? <p className="text-xs text-muted-foreground mt-1">Keterangan: {att.notes}</p> : null}
                        </div>
                        <Badge variant="outline" className={`text-[10px] ${statusColors[att.status] || ""}`}>{att.status}</Badge>
                      </div>
                      <div className="flex gap-4 text-xs mt-1">
                        <span>Telat: {att.late_minutes > 0 ? `${att.late_minutes}m` : "-"}</span>
                        <span>Lembur: {att.overtime_minutes > 0 ? `${att.overtime_minutes}m` : "-"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">Belum ada riwayat absensi</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Camera Dialog */}
      <Dialog open={showCamera} onOpenChange={setShowCamera}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Foto Selfie - Absen {clockType === "in" ? "Masuk" : "Pulang"}
            </DialogTitle>
          </DialogHeader>
          {isEarlyOut && clockType === "out" && (
            <div className="mb-2">
              <Label>Keterangan (wajib untuk pulang sebelum jam {endTimeCfg})</Label>
              <Input value={outNotes} onChange={e => setOutNotes(e.target.value)} placeholder="Tuliskan alasan Anda..." />
            </div>
          )}
          <CameraCapture
            onCapture={(photo) => {
              if (clockType === "out" && isEarlyOut && (!outNotes || outNotes.trim().length === 0)) {
                toast({ title: "Keterangan wajib", description: "Isi alasan pulang lebih awal" });
                return;
              }
              clockMutation.mutate({ photo, notes: outNotes });
            }}
            onCancel={() => setShowCamera(false)}
          />
          {clockMutation.isPending && (
            <p className="text-sm text-center text-muted-foreground animate-pulse">Menyimpan absensi...</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AnalogClock({ now, size = 200 }) {
  const sec = now.getSeconds();
  const min = now.getMinutes();
  const hr = now.getHours() % 12;
  const secAngle = (sec / 60) * 360;
  const minAngle = (min / 60) * 360 + (sec / 60) * 6;
  const hrAngle = (hr / 12) * 360 + (min / 60) * 30;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;
  const hand = (angle, length, width, color) => {
    const rad = (Math.PI / 180) * (angle - 90);
    const x = cx + length * Math.cos(rad);
    const y = cy + length * Math.sin(rad);
    return <line x1={cx} y1={cy} x2={x} y2={y} stroke={color} strokeWidth={width} strokeLinecap="round" />;
  };
  const ticks = Array.from({ length: 60 }).map((_, i) => {
    const angle = (i / 60) * 360;
    const rad = (Math.PI / 180) * (angle - 90);
    const inner = r - (i % 5 === 0 ? 10 : 4);
    const outer = r;
    const x1 = cx + inner * Math.cos(rad);
    const y1 = cy + inner * Math.sin(rad);
    const x2 = cx + outer * Math.cos(rad);
    const y2 = cy + outer * Math.sin(rad);
    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e5e7eb" strokeWidth={i % 5 === 0 ? 2 : 1} />;
  });
  return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="#fff" stroke="#e5e7eb" strokeWidth="2" />
      {ticks}
      {hand(hrAngle, r * 0.5, 4, "#374151")}
      {hand(minAngle, r * 0.75, 3, "#9ca3af")}
      {hand(secAngle, r * 0.85, 2, "#14b8a6")}
      <circle cx={cx} cy={cy} r="4" fill="#fff" stroke="#e5e7eb" />
    </svg>
  );
}
