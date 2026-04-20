import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, X, Building2, Search } from "lucide-react";
import moment from "moment";
import { useToast } from "@/components/ui/use-toast";
import { getApiBase } from "@/lib/utils";

const statusColors = {
  pending: "bg-yellow-100 text-yellow-700",
  aktif: "bg-green-100 text-green-700",
  nonaktif: "bg-red-100 text-red-600",
};

import { useAuth } from "@/lib/AuthContext";

export default function SuperAdmin() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const queryClient = useQueryClient();
  const [loadError, setLoadError] = useState(null);
  const [showExpiryDialog, setShowExpiryDialog] = useState(false);
  const [expiryCompany, setExpiryCompany] = useState(null);
  const [expiryDate, setExpiryDate] = useState("");
  const { toast } = useToast();
  const { selectedCompanyId, updateSelectedCompanyId, setSelectedCompanyId } = useAuth();
  const selectCompany = updateSelectedCompanyId || setSelectedCompanyId;
  const normalizedSelectedCompanyId = selectedCompanyId === null || selectedCompanyId === undefined
    ? null
    : Number(selectedCompanyId);
  const isSelectedCompany = (companyId) => (
    Number.isFinite(normalizedSelectedCompanyId) && Number(companyId) === normalizedSelectedCompanyId
  );

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["all-companies"],
    queryFn: async () => {
      setLoadError(null);
      try {
        const base = getApiBase();
        const r = await fetch(`${base}/api/companies`);
        if (!r.ok) {
          setLoadError(`Gagal memuat (status ${r.status})`);
          return [];
        }
        return r.json();
      } catch (e) {
        setLoadError(e.message || "Gagal memuat data");
        return [];
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...payload }) => {
      const base = getApiBase();
      const r = await fetch(`${base}/api/companies/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        let msg = "Gagal memperbarui perusahaan";
        try {
          const d = await r.json();
          msg = d.error || msg;
        } catch {}
        throw new Error(msg);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-companies"] });
      setShowExpiryDialog(false);
      setExpiryCompany(null);
      setExpiryDate("");
      toast({ title: "Tersimpan", description: "Masa aktif berhasil diperbarui" });
    },
    onError: (e) => toast({ title: "Gagal menyimpan", description: e.message }),
  });

  const openExpiry = (company) => {
    setExpiryCompany(company);
    setExpiryDate(company?.active_until ? moment(company.active_until).format("YYYY-MM-DD") : "");
    setShowExpiryDialog(true);
  };

  const addExpiryDays = (days) => {
    const base = expiryDate ? moment(expiryDate, "YYYY-MM-DD") : moment();
    setExpiryDate(base.add(days, "days").format("YYYY-MM-DD"));
  };

  const saveExpiry = () => {
    if (!expiryCompany?.id) return;
    updateMutation.mutate({ id: expiryCompany.id, active_until: expiryDate || null });
  };

  const filtered = companies.filter(c => {
    const matchSearch = c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.owner_email?.toLowerCase().includes(search.toLowerCase());
    const matchTab = activeTab === "all" || c.status === activeTab;
    return matchSearch && matchTab;
  });

  const pendingCount = companies.filter(c => c.status === "pending").length;
  const activeCount = companies.filter(c => c.status === "aktif").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Super Admin Panel</h1>
        <p className="text-sm text-muted-foreground">Kelola semua perusahaan yang terdaftar</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-foreground">{companies.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Total Perusahaan</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-yellow-600">{pendingCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Menunggu Approval</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-green-600">{activeCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Perusahaan Aktif</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">Semua ({companies.length})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
            <TabsTrigger value="aktif">Aktif ({activeCount})</TabsTrigger>
            <TabsTrigger value="nonaktif">Nonaktif</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari perusahaan..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loadError && (
            <div className="p-4 text-sm text-red-600">
              {loadError} — Periksa koneksi ke http://localhost:3001/api/companies.
              <Button variant="outline" size="sm" className="ml-2" onClick={() => queryClient.invalidateQueries({ queryKey: ["all-companies"] })}>
                Muat Ulang
              </Button>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Perusahaan</TableHead>
                <TableHead>Email Admin</TableHead>
                <TableHead className="hidden md:table-cell">Industri</TableHead>
                <TableHead className="hidden md:table-cell">Karyawan</TableHead>
                <TableHead className="hidden md:table-cell">Terdaftar</TableHead>
                <TableHead className="hidden md:table-cell">Masa Aktif</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(company => (
                <TableRow key={company.id} className={isSelectedCompany(company.id) ? "bg-primary/5 border-l-4 border-l-primary" : ""}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{company.name}</p>
                        <p className="text-[10px] text-muted-foreground">ID: {company.id}</p>
                      </div>
                    </div>
                  </TableCell>
                    <TableCell className="text-sm">{company.owner_email}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{company.industry || "-"}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{company.employee_count || "-"}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                    {moment(company.created_at).format("DD/MM/YYYY")}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs">
                    {company.active_until ? (
                      <div className="flex items-center gap-2">
                        <span className={moment(company.active_until).endOf("day").isBefore(moment()) ? "text-red-600" : "text-muted-foreground"}>
                          {moment(company.active_until).format("DD/MM/YYYY")}
                        </span>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => openExpiry(company)}>
                          Ubah
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">-</span>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => openExpiry(company)}>
                          Atur
                        </Button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] ${statusColors[company.status]}`}>
                      {company.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 items-center">
                      {isSelectedCompany(company.id) ? (
                        <Badge variant="outline" className="text-[10px] text-primary border-primary">Terpilih</Badge>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 px-2 text-xs"
                          onClick={() => selectCompany?.(company.id)}
                        >
                          Pilih
                        </Button>
                      )}
                      {company.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-green-600 hover:bg-green-50 h-8 px-2"
                            onClick={() => updateMutation.mutate({ id: company.id, status: "aktif" })}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:bg-red-50 h-8 px-2"
                            onClick={() => updateMutation.mutate({ id: company.id, status: "nonaktif" })}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      {company.status === "aktif" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:bg-red-50 h-8 px-2 text-xs"
                          onClick={() => updateMutation.mutate({ id: company.id, status: "nonaktif" })}
                        >
                          Nonaktifkan
                        </Button>
                      )}
                      {company.status === "nonaktif" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-green-600 hover:bg-green-50 h-8 px-2 text-xs"
                          onClick={() => updateMutation.mutate({ id: company.id, status: "aktif" })}
                        >
                          Aktifkan
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                    {isLoading ? "Memuat data..." : "Tidak ada perusahaan ditemukan"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showExpiryDialog} onOpenChange={setShowExpiryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atur Masa Aktif</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Perusahaan</Label>
              <div className="text-sm text-muted-foreground">{expiryCompany?.name || "-"}</div>
            </div>
            <div className="space-y-1">
              <Label>Berlaku Sampai</Label>
              <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => addExpiryDays(30)}>+30 hari</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => addExpiryDays(365)}>+1 tahun</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setExpiryDate("")}>Tanpa batas</Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowExpiryDialog(false)}>Batal</Button>
            <Button type="button" onClick={saveExpiry} disabled={updateMutation.isPending}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
