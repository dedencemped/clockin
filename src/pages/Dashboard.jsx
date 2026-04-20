import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, UserCheck, Clock, UserX } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import AttendanceChart from "@/components/dashboard/AttendanceChart";
import RecentActivity from "@/components/dashboard/RecentActivity";
import { Skeleton } from "@/components/ui/skeleton";
import moment from "moment";
import { useAuth } from "@/lib/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

export default function Dashboard() {
  const today = moment().format("YYYY-MM-DD");
  const { user, selectedCompanyId, setSelectedCompanyId } = useAuth();
  const isSuper = user?.role === "superadmin";
  const isAdminUser = user?.role === "admin" || user?.role === "hrd";
  const baseCompanyId = isSuper ? null : (user?.company_id || null);
  const ALL = "__all__";
  const [localFilter, setLocalFilter] = useState(ALL);
  const effectiveCompanyId = isSuper
    ? (localFilter && localFilter !== ALL ? Number(localFilter) : null)
    : baseCompanyId;
  const isPreview = typeof window !== "undefined" && window.location && window.location.port === "4173";
  const apiBase = isPreview ? "http://localhost:3001" : "";

  const { data: myCompany = null } = useQuery({
    queryKey: ["company-expiry", baseCompanyId],
    queryFn: async () => {
      if (!isAdminUser || !baseCompanyId) return null;
      const r = await fetch(`${apiBase}/api/companies`);
      if (!r.ok) return null;
      const rows = await r.json();
      if (!Array.isArray(rows)) return null;
      return rows.find(x => Number(x.id) === Number(baseCompanyId)) || null;
    },
    enabled: isAdminUser && !!baseCompanyId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const expiryInfo = (() => {
    const until = myCompany?.active_until;
    if (!isAdminUser || !until) return null;
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const expiry = new Date(until);
    if (Number.isNaN(expiry.getTime())) return null;
    expiry.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((expiry.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0 || daysLeft > 7) return null;
    return { daysLeft, expiry };
  })();

  const { data: companies = [] } = useQuery({
    queryKey: ["companies-for-filter"],
    queryFn: async () => {
      if (!isSuper) return [];
      // Coba relative path, fallback ke localhost:3001 jika proxy tidak tersedia
      try {
        const r = await fetch(`${apiBase}/api/companies`);
        if (r.ok) return r.json();
      } catch (_) {}
      try {
        const r2 = await fetch(`http://localhost:3001/api/companies`);
        if (r2.ok) return r2.json();
        return [];
      } catch {
        return [];
      }
    },
    enabled: isSuper,
    staleTime: 30000,
    keepPreviousData: true,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!isSuper) {
      setLocalFilter(ALL);
    } else {
      // hydrate from context
      setLocalFilter(selectedCompanyId == null ? ALL : String(selectedCompanyId));
    }
  }, [isSuper]);

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", effectiveCompanyId],
    queryFn: async () => {
      const qs = effectiveCompanyId ? `?company_id=${effectiveCompanyId}` : "";
      const res = await fetch(`${apiBase}/api/employees${qs}`);
      if (!res.ok) return [];
      const rows = await res.json();
      return rows
        .filter(e => e.status === "aktif")
        .filter(e => (effectiveCompanyId ? e.company_id === effectiveCompanyId : true));
    },
    staleTime: 15000,
    keepPreviousData: true,
    refetchOnWindowFocus: false,
  });

  const { data: todayAttendances = [], isLoading } = useQuery({
    queryKey: ["attendance-today", today, effectiveCompanyId],
    queryFn: async () => {
      const qs = effectiveCompanyId ? `&company_id=${effectiveCompanyId}` : "";
      const res = await fetch(`${apiBase}/api/attendance?date=${today}${qs}`);
      if (!res.ok) return [];
      const rows = await res.json();
      // map to expected keys
      return rows.map(r => ({
        ...r,
        clock_in: r.check_in ? r.check_in?.slice(11,16) : null,
        clock_out: r.check_out ? r.check_out?.slice(11,16) : null,
      }));
    },
    staleTime: 10000,
    keepPreviousData: true,
    refetchOnWindowFocus: false,
  });

  const { data: monthAttendances = [] } = useQuery({
    queryKey: ["attendance-month", effectiveCompanyId],
    queryFn: async () => {
      const qs = effectiveCompanyId ? `?company_id=${effectiveCompanyId}` : "";
      const res = await fetch(`${apiBase}/api/attendance${qs}`);
      if (!res.ok) return [];
      const rows = await res.json();
      return rows.map(r => ({
        ...r,
        clock_in: r.check_in ? r.check_in?.slice(11,16) : null,
        clock_out: r.check_out ? r.check_out?.slice(11,16) : null,
      }));
    },
    staleTime: 20000,
    keepPreviousData: true,
    refetchOnWindowFocus: false,
  });

  const totalEmployees = employees.length;
  const hadirCount = todayAttendances.filter(a => a.status === "hadir" || a.status === "terlambat").length;
  const terlambatCount = todayAttendances.filter(a => a.status === "terlambat").length;
  const alphaCount = totalEmployees - hadirCount;

  // Build monthly chart data
  const currentMonth = moment().month();
  const currentYear = moment().year();
  const daysInMonth = moment().daysInMonth();
  const chartData = [];
  for (let w = 0; w < 4; w++) {
    const startDay = w * 7 + 1;
    const endDay = Math.min(startDay + 6, daysInMonth);
    const weekAttendances = monthAttendances.filter(a => {
      const d = moment(a.date);
      return d.year() === currentYear && d.month() === currentMonth && d.date() >= startDay && d.date() <= endDay;
    });
    chartData.push({
      name: `Minggu ${w + 1}`,
      hadir: weekAttendances.filter(a => a.status === "hadir").length,
      terlambat: weekAttendances.filter(a => a.status === "terlambat").length,
      alpha: weekAttendances.filter(a => a.status === "alpha").length,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Selamat Datang 👋</h1>
          <p className="text-sm text-muted-foreground mt-1">Ringkasan kehadiran hari ini, {moment().format("dddd, D MMMM YYYY")}</p>
        </div>
        {isSuper && (
          <div className="w-full sm:w-80">
            <Card className="p-3">
              <label className="text-xs text-muted-foreground">Filter Perusahaan</label>
              <Select
                value={localFilter}
                onValueChange={(v) => {
                  setLocalFilter(v || ALL);
                  if (isSuper) {
                    if (!v || v === ALL) setSelectedCompanyId(null);
                    else setSelectedCompanyId(Number(v));
                  }
                }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Semua perusahaan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Semua perusahaan</SelectItem>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Card>
          </div>
        )}
      </div>

      {expiryInfo && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="font-semibold text-yellow-900">Masa aktif hampir habis</p>
                <p className="text-sm text-yellow-800">
                  Masa aktif perusahaan Anda akan habis dalam {expiryInfo.daysLeft} hari ({expiryInfo.expiry.toLocaleDateString("id-ID")}). Segera perpanjang masa aktif.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatCard title="Total Karyawan" value={totalEmployees} icon={Users} color="blue" subtitle="Karyawan aktif" />
            <StatCard title="Hadir Hari Ini" value={hadirCount} icon={UserCheck} color="green" subtitle={`${totalEmployees > 0 ? Math.round(hadirCount / totalEmployees * 100) : 0}% kehadiran`} />
            <StatCard title="Terlambat" value={terlambatCount} icon={Clock} color="yellow" subtitle="Hari ini" />
            <StatCard title="Tidak Hadir" value={alphaCount < 0 ? 0 : alphaCount} icon={UserX} color="red" subtitle="Belum absen / alpha" />
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {isLoading && chartData.length === 0 ? (
            <Skeleton className="h-80 rounded-xl" />
          ) : (
            <AttendanceChart data={chartData} />
          )}
        </div>
        {isLoading && todayAttendances.length === 0 ? (
          <Skeleton className="h-80 rounded-xl" />
        ) : (
          <RecentActivity attendances={todayAttendances} />
        )}
      </div>

      {isSuper && companies.length === 0 && (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Belum ada perusahaan terdaftar. Tambahkan via RegisterCompany atau seed awal.</p>
        </Card>
      )}
      {!isLoading && totalEmployees === 0 && monthAttendances.length === 0 && (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">
            Belum ada data untuk perusahaan terpilih. Tambahkan karyawan atau buat absensi untuk melihat ringkasan.
          </p>
        </Card>
      )}
    </div>
  );
}
