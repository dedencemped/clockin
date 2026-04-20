import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import {
  LayoutDashboard, Users, MapPin, Clock, FileText,
  CalendarOff, Settings, Menu, X, LogOut, ChevronDown,
  Home, Timer, BarChart2, User, ShieldCheck, KeyRound
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { getApiBase } from "@/lib/utils";

const MOBILE_PAGES = ["MobileHome", "MobileCoordinates", "MobileWorkHours", "MobileHistory", "MobileProfile", "MobileLeave"];

const MOBILE_NAV = [
  { name: "MobileHome", icon: Home, label: "Home" },
  { name: "MobileCoordinates", icon: MapPin, label: "Lokasi" },
  { name: "MobileWorkHours", icon: Timer, label: "Jam Kerja" },
  { name: "MobileHistory", icon: BarChart2, label: "Riwayat" },
  { name: "MobileProfile", icon: User, label: "Profil" },
];

const ADMIN_NAV = [
  { name: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
  { name: "Absensi", icon: Clock, page: "Attendance" },
  { name: "Karyawan", icon: Users, page: "Employees" },
  { name: "Lokasi", icon: MapPin, page: "Branches" },
  { name: "Izin & Cuti", icon: CalendarOff, page: "LeaveRequests" },
  { name: "Laporan", icon: FileText, page: "Reports" },
  { name: "Pengaturan", icon: Settings, page: "SystemSettings" },
  { name: "Token Reset", icon: KeyRound, page: "ResetTokens" },
];

const SUPER_ADMIN_PAGES = ["SuperAdmin"];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [companyName, setCompanyName] = useState("");

  const isMobilePage = MOBILE_PAGES.includes(currentPageName);
  const isSuperAdminPage = SUPER_ADMIN_PAGES.includes(currentPageName) || currentPageName === "RegisterCompany";

  const isSuperAdmin = user?.role === "superadmin";

  const initials = user?.full_name
    ? user.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  useEffect(() => {
    const cid = user?.company_id || null;
    if (!cid) {
      setCompanyName("");
      return;
    }
    let cancelled = false;
    const base = getApiBase();
    fetch(`${base}/api/companies`)
      .then(r => r.json())
      .then(rows => {
        if (cancelled) return;
        const c = Array.isArray(rows) ? rows.find(x => x.id === cid) : null;
        setCompanyName(c?.name || "");
        const isAdminUser = user?.role === "admin" || user?.role === "hrd";
        if (!isAdminUser) return;
        if (!c?.active_until) return;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expiry = new Date(c.active_until);
        if (Number.isNaN(expiry.getTime())) return;
        expiry.setHours(0, 0, 0, 0);
        const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft < 0 || daysLeft > 7) return;
        const key = `expiry_notice_${cid}_${expiry.toISOString().slice(0, 10)}`;
        try {
          if (sessionStorage.getItem(key) === "1") return;
          sessionStorage.setItem(key, "1");
        } catch {}
        toast({
          title: "Masa aktif hampir habis",
          description: `Masa aktif perusahaan Anda akan habis dalam ${daysLeft} hari (${expiry.toLocaleDateString("id-ID")}). Segera perpanjang masa aktif.`,
          duration: 9000
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [toast, user?.company_id, user?.role]);

  // ========== MOBILE LAYOUT ==========
  if (isMobilePage) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 max-w-md mx-auto relative">
        {/* Page content */}
        <div className="flex-1 overflow-y-auto pb-20">
          {children}
        </div>

        {/* Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-100 shadow-lg z-50">
          <div className="flex items-center justify-around py-2">
            {MOBILE_NAV.map(item => {
              const isActive = currentPageName === item.name;
              return (
                <Link
                  key={item.name}
                  to={createPageUrl(item.name)}
                  className="flex flex-col items-center gap-1 px-3 py-1 min-w-0"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isActive
                      ? "bg-teal-50 border-2 border-teal-400"
                      : ""
                  }`}>
                    <item.icon
                      className={`w-5 h-5 transition-colors ${
                        isActive ? "text-teal-500" : "text-gray-400"
                      }`}
                    />
                  </div>
                  <span className={`text-[10px] ${isActive ? "text-teal-500 font-medium" : "text-gray-400"}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ========== ADMIN/DESKTOP LAYOUT ==========
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/30 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground transform transition-transform duration-300 ease-in-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} flex flex-col`}>
        <div className="flex items-center gap-3 px-6 h-16 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-xl bg-sidebar-primary flex items-center justify-center">
            <Clock className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-base text-sidebar-foreground">{companyName || "Clockin"}</h1>
            <p className="text-[10px] text-sidebar-foreground/50 tracking-wider uppercase">{companyName ? "Attendance System" : "Attendance System"}</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto text-sidebar-foreground/60 hover:text-sidebar-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {ADMIN_NAV.map(item => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                  ${isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/20"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
              >
                <item.icon className="w-[18px] h-[18px]" />
                {item.name}
              </Link>
            );
          })}

          {/* Link to Mobile View */}
          <div className="pt-3 border-t border-sidebar-border mt-3 space-y-1">
            <Link
              to={createPageUrl("MobileHome")}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all"
            >
              <Home className="w-[18px] h-[18px]" />
              Tampilan Mobile
            </Link>
            {isSuperAdmin && (
              <Link
                to={createPageUrl("SuperAdmin")}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  currentPageName === "SuperAdmin"
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <ShieldCheck className="w-[18px] h-[18px]" />
                Super Admin
              </Link>
            )}
          </div>
        </nav>

        <div className="px-3 pb-4 pt-2 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-sidebar-primary/20 text-sidebar-primary text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.full_name || "User"}</p>
              <p className="text-[11px] text-sidebar-foreground/50 truncate">{user?.email || ""}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 lg:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-foreground/70 hover:text-foreground">
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold text-foreground">
              {ADMIN_NAV.find(i => i.page === currentPageName)?.name || currentPageName}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <Link to={createPageUrl("SuperAdmin")} className="inline-flex">
                <Button variant="outline" size="sm" className={`${currentPageName === "SuperAdmin" ? "border-primary text-primary" : ""}`}>
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Super Admin
                </Button>
              </Link>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Avatar className="w-7 h-7">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm">{user?.full_name || "User"}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem className="text-xs text-muted-foreground">{user?.email}</DropdownMenuItem>
                <DropdownMenuSeparator />
                {isSuperAdmin && (
                  <DropdownMenuItem onClick={() => setShowChangePwd(true)}>
                    Ubah Password
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout(true)} className="text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Keluar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
      <Dialog open={showChangePwd} onOpenChange={setShowChangePwd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah Password Super Admin</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Password Saat Ini</Label>
              <Input type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} placeholder="********" />
            </div>
            <div className="space-y-1">
              <Label>Password Baru</Label>
              <Input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="********" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChangePwd(false)}>Batal</Button>
            <Button
              variant="secondary"
              onClick={async () => {
                if (!user?.email) return;
                if (!newPwd) { toast({ title: "Lengkapi data", description: "Isi password baru" }); return; }
                setSavingPwd(true);
                try {
                  const base = getApiBase();
                  const r1 = await fetch(`${base}/api/auth/request-reset`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: user.email }),
                  });
                  if (!r1.ok) {
                    const d = await r1.json().catch(()=>({}));
                    throw new Error(d.error || "Gagal meminta token reset");
                  }
                  const d1 = await r1.json();
                  const token = d1.token;
                  const r2 = await fetch(`${base}/api/auth/reset-password`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token, password: newPwd }),
                  });
                  if (!r2.ok) {
                    const d = await r2.json().catch(()=>({}));
                    throw new Error(d.error || "Gagal reset password");
                  }
                  toast({ title: "Berhasil", description: "Password berhasil direset" });
                  setShowChangePwd(false);
                  setCurrentPwd("");
                  setNewPwd("");
                } catch (e) {
                  toast({ title: "Gagal reset", description: e.message || "Terjadi kesalahan" });
                } finally {
                  setSavingPwd(false);
                }
              }}
              disabled={savingPwd}
            >
              Reset Via Token
            </Button>
            <Button
              onClick={async () => {
                if (!user?.email) return;
                if (!currentPwd || !newPwd) { toast({ title: "Lengkapi data", description: "Isi semua kolom" }); return; }
                setSavingPwd(true);
                try {
                  const base = getApiBase();
                  const r = await fetch(`${base}/api/auth/change-password`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: user.email, current_password: currentPwd, new_password: newPwd }),
                  });
                  if (!r.ok) {
                    const d = await r.json().catch(()=>({}));
                    throw new Error(d.error || "Gagal mengubah password");
                  }
                  toast({ title: "Berhasil", description: "Password berhasil diperbarui" });
                  setShowChangePwd(false);
                  setCurrentPwd("");
                  setNewPwd("");
                } catch (e) {
                  toast({ title: "Gagal menyimpan", description: e.message || "Terjadi kesalahan" });
                } finally {
                  setSavingPwd(false);
                }
              }}
              disabled={savingPwd}
            >
              {savingPwd ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
