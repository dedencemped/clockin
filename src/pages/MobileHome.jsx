import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ClipboardList } from "lucide-react";
import moment from "moment";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import CameraCapture from "@/components/attendance/CameraCapture";
import { getDistance } from "@/components/attendance/LocationCheck";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";

const DAYS = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"];

// Analog clock component
function AnalogClock({ time }) {
  const hours = time.hours() % 12;
  const minutes = time.minutes();
  const seconds = time.seconds();
  const hourDeg = (hours + minutes / 60) * 30;
  const minDeg = (minutes + seconds / 60) * 6;
  const secDeg = seconds * 6;

  return (
    <div className="relative w-52 h-52 mx-auto">
      <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-xl">
        {/* Clock face */}
        <circle cx="100" cy="100" r="95" fill="white" stroke="#e5e7eb" strokeWidth="2" />
        {/* Hour marks */}
        {[...Array(12)].map((_, i) => {
          const angle = (i * 30 - 90) * (Math.PI / 180);
          const x1 = 100 + 82 * Math.cos(angle);
          const y1 = 100 + 82 * Math.sin(angle);
          const x2 = 100 + 90 * Math.cos(angle);
          const y2 = 100 + 90 * Math.sin(angle);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#9ca3af" strokeWidth="2" />;
        })}
        {/* Minute hand */}
        <line
          x1="100" y1="100"
          x2={100 + 70 * Math.cos((minDeg - 90) * Math.PI / 180)}
          y2={100 + 70 * Math.sin((minDeg - 90) * Math.PI / 180)}
          stroke="#1f2937" strokeWidth="3" strokeLinecap="round"
        />
        {/* Hour hand */}
        <line
          x1="100" y1="100"
          x2={100 + 50 * Math.cos((hourDeg - 90) * Math.PI / 180)}
          y2={100 + 50 * Math.sin((hourDeg - 90) * Math.PI / 180)}
          stroke="#1f2937" strokeWidth="4" strokeLinecap="round"
        />
        {/* Second hand */}
        <line
          x1="100" y1="100"
          x2={100 + 75 * Math.cos((secDeg - 90) * Math.PI / 180)}
          y2={100 + 75 * Math.sin((secDeg - 90) * Math.PI / 180)}
          stroke="#14b8a6" strokeWidth="1.5" strokeLinecap="round"
        />
        {/* Center dot */}
        <circle cx="100" cy="100" r="5" fill="#1f2937" />
        <circle cx="100" cy="100" r="2" fill="white" />
      </svg>
    </div>
  );
}

export default function MobileHome() {
  const { user: authUser } = useAuth();
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [now, setNow] = useState(moment());
  const [location, setLocation] = useState({ lat: null, lng: null, loading: true });
  const [showCamera, setShowCamera] = useState(false);
  const [clockType, setClockType] = useState("in");
  const [outNotes, setOutNotes] = useState("");
  const queryClient = useQueryClient();
  const today = moment().format("YYYY-MM-DD");

  const companyId = authUser?.company_id || user?.company_id || employee?.company_id || null;
  const { data: companyName = "" } = useQuery({
    queryKey: ["company-name", companyId],
    queryFn: async () => {
      if (!companyId) return "";
      const r = await fetch(`/api/companies`);
      if (!r.ok) return "";
      const rows = await r.json();
      const c = Array.isArray(rows) ? rows.find(x => x.id === companyId) : null;
      return c?.name || "";
    },
    enabled: !!companyId,
    staleTime: 60000,
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(moment()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (authUser) {
      setUser(authUser);
      fetch("/api/employees").then(r => r.json()).then(list => {
        const me = list.find(e => e.email === authUser.email) || list.find(e => e.id === authUser.id);
        if (me) setEmployee(me);
      }).catch(()=>{});
    } else {
      const raw = localStorage.getItem('auth_user');
      if (raw) {
        try {
          const u = JSON.parse(raw);
          setUser(u);
          fetch("/api/employees").then(r => r.json()).then(list => {
            const me = list.find(e => e.email === u.email) || list.find(e => e.id === u.id);
            if (me) setEmployee(me);
          });
        } catch {}
      }
    }
  }, [authUser]);

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

  const { data: branches = [] } = useQuery({
    queryKey: ["branches", employee?.company_id],
    queryFn: async () => {
      const qs = employee?.company_id ? `?company_id=${employee.company_id}` : "";
      const r = await fetch(`/api/branches${qs}`);
      if (!r.ok) return [];
      const rows = await r.json();
      return rows.filter(b => b.status === "aktif");
    },
  });

  const { data: todayRecord = [] } = useQuery({
    queryKey: ["my-attendance", today, employee?.id],
    queryFn: async () => {
      if (!employee) return [];
      const res = await fetch(`/api/attendance?date=${today}${employee?.company_id ? `&company_id=${employee.company_id}` : ""}`);
      if (!res.ok) return [];
      const rows = await res.json();
      const mine = rows.filter(r => r.employee_id === employee.id);
      return mine.map(r => ({
        ...r,
        clock_in: r.check_in ? r.check_in.slice(11,16) : null,
        clock_out: r.check_out ? r.check_out.slice(11,16) : null,
      }));
    },
    enabled: !!employee,
  });

  const myToday = todayRecord[0];

  const { data: settingsRows = [] } = useQuery({
    queryKey: ["system-settings-mobilehome", employee?.company_id],
    queryFn: async () => {
      if (!employee) return [];
      const qs = employee?.company_id ? `?company_id=${employee.company_id}` : "";
      const r = await fetch(`/api/system-settings${qs}`);
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!employee,
  });
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

  // Work days logic
  let workDays = [1, 2, 3, 4, 5];
  const wdRow = settingsRows.find(s => s.key === "work_days");
  if (wdRow) {
    try { const v = JSON.parse(wdRow.value); if (Array.isArray(v)) workDays = v; } catch {}
  }
  const isWorkDay = workDays.includes(moment().day());

  // Holidays handling
  let holidays = [];
  const hRow = settingsRows.find(s => s.key === "holidays");
  if (hRow) {
    try { const v = JSON.parse(hRow.value); if (Array.isArray(v)) holidays = v; } catch {}
  }
  const todayStr = moment().format("YYYY-MM-DD");
  const tomorrowStr = moment().add(1, "day").format("YYYY-MM-DD");
  const todayHoliday = holidays.find(h => h?.date === todayStr);
  const tomorrowHoliday = holidays.find(h => h?.date === tomorrowStr);
  const isEarlyOut = clockType === "out" && moment().isBefore(moment(endTimeCfg, "HH:mm"));
  const beforeEndNow = moment().isBefore(moment(endTimeCfg, "HH:mm"));

  const clockMutation = useMutation({
    mutationFn: async ({ photo, notes }) => {
      const nowStr = moment().format("HH:mm");
      const matchedBranch = branches.find(b => {
        if (!location.lat) return false;
        return getDistance(location.lat, location.lng, b.latitude, b.longitude) <= (b.radius || 100);
      });
      if (clockType === "in") {
        let lateMinutes = 0;
        const start = moment(startTimeCfg, "HH:mm");
        const arrival = moment(nowStr, "HH:mm");
        if (arrival.isAfter(start)) lateMinutes = arrival.diff(start, "minutes");
        
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
            check_in_time: nowStr,
            status: autoStatus,
            late_minutes: lateMinutes,
            branch_id: matchedBranch?.id || null,
          })
        });
      } else {
        let overtimeMinutes = 0;
        const end = moment(endTimeCfg, "HH:mm");
        const leave = moment(nowStr, "HH:mm");
        if (leave.isAfter(end)) overtimeMinutes = leave.diff(end, "minutes");

        if (!isWorkDay || todayHoliday) {
          const cin = moment(myToday.check_in_time, "HH:mm:ss");
          overtimeMinutes = leave.diff(cin, "minutes");
        }

        const res = await fetch(`/api/attendance/${myToday.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            check_out_time: nowStr,
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
    onError: (e) => {
      toast({ title: "Gagal menyimpan", description: e?.message || "Terjadi kesalahan saat menyimpan absen" });
    }
  });

  const canClockIn = !myToday && !todayHoliday;
  const canClockOut = myToday && !myToday.clock_out && !todayHoliday;

  // Check if inside any branch radius
  const nearbyBranch = branches.find(b => {
    if (!location.lat) return false;
    return getDistance(location.lat, location.lng, b.latitude, b.longitude) <= (b.radius || 100);
  });
  const isInsideAllowedArea = Boolean(nearbyBranch);

  const handleClockAction = (type) => {
    setClockType(type);
    setShowCamera(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="w-10" />
        <div className="text-center min-w-0">
          <p className="text-xs tracking-widest text-gray-500 uppercase font-medium">Presensi</p>
          {companyName ? (
            <p className="text-[10px] text-gray-400 truncate max-w-[180px] mx-auto">{companyName}</p>
          ) : null}
        </div>
        <Link to={createPageUrl("MobileLeave")}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1e3a8a, #14b8a6)" }}>
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
        </Link>
      </div>

      {/* Date & Time */}
      <div className="text-center mb-4">
        <p className="text-sm text-gray-500">{now.format("dddd DD/MM/YYYY")}</p>
        <div className="flex items-end justify-center gap-1">
          <span className="text-5xl font-bold text-gray-800">{now.format("HH:mm")}</span>
          <span className="text-sm text-gray-400 mb-2">{now.hours() < 12 ? "AM" : "PM"}</span>
        </div>
      </div>

      {/* Analog Clock */}
      <div className="px-6 mb-4">
        <AnalogClock time={now} />
      </div>

      {/* Status Banner */}
      {todayHoliday ? (
        <div className="mx-4 mb-4 bg-red-100 text-red-600 text-center text-sm py-3 rounded-xl font-medium">
          Hari Libur Nasional: {todayHoliday.name || "Libur"} — Presensi nonaktif
        </div>
      ) : !myToday ? (
        <div className="mx-4 mb-4 bg-red-100 text-red-600 text-center text-sm py-3 rounded-xl font-medium">
          Anda belum presensi hari ini !
        </div>
      ) : myToday.clock_out ? (
        <div className="mx-4 mb-4 bg-green-100 text-green-700 text-center text-sm py-3 rounded-xl font-medium">
          Presensi selesai ✓ Masuk: {myToday.clock_in} | Pulang: {myToday.clock_out}
          {myToday.notes ? <div className="text-xs text-gray-600 mt-1">Keterangan: {myToday.notes}</div> : null}
        </div>
      ) : (
        <div className="mx-4 mb-4 bg-blue-100 text-blue-700 text-center text-sm py-3 rounded-xl font-medium">
          Sudah absen masuk pukul {myToday.clock_in}
          {myToday.late_minutes > 0 ? <div className="text-xs text-gray-600 mt-1">Terlambat {myToday.late_minutes} menit</div> : null}
        </div>
      )}

      {/* Branch Cards */}
      <div className="px-4 mb-4">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {branches.map(branch => {
            const dist = location.lat ? Math.round(getDistance(location.lat, location.lng, branch.latitude, branch.longitude)) : null;
            const isNearby = dist !== null && dist <= (branch.radius || 100);
            return (
              <div key={branch.id} className="bg-white rounded-2xl p-4 shadow-sm min-w-[200px] flex-shrink-0">
                <div className="flex justify-between items-start mb-1">
                  <p className="font-semibold text-sm text-gray-800 leading-tight">{branch.name}</p>
                  <span className="text-gray-400 text-xs">→</span>
                </div>
                <p className="text-xs text-gray-400 mb-2">{branch.address}</p>
                {location.loading ? (
                  <p className="text-xs text-gray-400">Mendeteksi lokasi...</p>
                ) : isNearby ? (
                  <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">Anda dalam radius area ini ✓</span>
                ) : (
                  <span className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded-full">
                    {dist !== null ? `${dist}m - Di luar radius area ini` : "Anda di luar radius area ini"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 space-y-3">
        {tomorrowHoliday && !todayHoliday && (
          <div className="bg-amber-100 text-amber-700 text-center text-xs py-2 rounded-xl">
            Info: Besok libur nasional — {tomorrowHoliday.name || "Libur"}
          </div>
        )}
        <button
          onClick={() => handleClockAction("in")}
          disabled={!canClockIn || location.loading || clockMutation.isPending || !isInsideAllowedArea}
          className="w-full py-4 rounded-2xl text-white font-semibold text-base disabled:opacity-50 transition-all"
          style={{ background: "linear-gradient(135deg, #1e3a8a, #14b8a6)" }}
        >
          {clockMutation.isPending && clockType === "in" ? "Menyimpan..." : "Absen Masuk"}
        </button>
        <button
          onClick={() => handleClockAction("out")}
          disabled={!canClockOut || location.loading || clockMutation.isPending || !isInsideAllowedArea}
          className="w-full py-4 rounded-2xl text-gray-600 font-semibold text-base border border-gray-300 bg-white disabled:opacity-50 transition-all"
        >
          {clockMutation.isPending && clockType === "out" ? "Menyimpan..." : "Absen Pulang"}
        </button>
        {beforeEndNow && canClockOut && (
          <p className="text-center text-xs text-gray-500">
            Pulang sebelum jam {endTimeCfg}. Keterangan wajib diisi.
          </p>
        )}
      </div>

      {/* Camera Dialog */}
      <Dialog open={showCamera} onOpenChange={setShowCamera}>
        <DialogContent className="sm:max-w-md p-4">
          <p className="font-semibold text-center mb-3">Foto Selfie - Absen {clockType === "in" ? "Masuk" : "Pulang"}</p>
          {isEarlyOut && clockType === "out" && (
            <div className="mb-2">
              <label className="text-sm text-gray-700">Keterangan (wajib untuk pulang sebelum jam {endTimeCfg})</label>
              <input
                type="text"
                value={outNotes}
                onChange={e => setOutNotes(e.target.value)}
                placeholder="Tuliskan alasan Anda..."
                className="w-full h-10 px-3 rounded-lg border border-gray-300 mt-1"
              />
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
            <p className="text-sm text-center text-gray-400 animate-pulse mt-2">Menyimpan absensi...</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
