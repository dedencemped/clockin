import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Clock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { getApiBase } from "@/lib/utils";

const INDUSTRIES = [
  "Teknologi", "Manufaktur", "Perdagangan", "Jasa Keuangan",
  "Kesehatan", "Pendidikan", "Konstruksi", "Transportasi",
  "Pertanian", "Media & Kreatif", "Lainnya"
];

export default function RegisterCompany() {
  const [step, setStep] = useState("form"); // form | success
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "", email: "", password: "", phone: "", address: "", industry: "", employee_count: ""
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");

  const handleSubmit = async () => {
    const newErrors = {};
    if (!form.name) newErrors.name = "Nama perusahaan wajib diisi";
    if (!form.email) newErrors.email = "Email admin wajib diisi";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = "Format email tidak valid";
    if (!form.password) newErrors.password = "Password wajib diisi";
    else if (form.password.length < 6) newErrors.password = "Minimal 6 karakter";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    setLoading(true);
    try {
      setServerError("");
      const base = getApiBase();
      const res = await fetch(`${base}/api/auth/register-company`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone,
          address: form.address,
          industry: form.industry,
          employee_count: form.employee_count
        })
      });
      if (!res.ok) {
        const d = await res.json().catch(()=>({}));
        const msg = d.error || "Gagal mendaftar";
        setServerError(msg);
        throw new Error(msg);
      }
      setStep("success");
    } catch (e) {
      toast({ title: "Gagal mendaftar", description: e.message || "Terjadi kesalahan" });
    } finally {
      setLoading(false);
    }
  };

  if (step === "success") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-2 bg-yellow-50 border-yellow-200">
          <CardContent className="pt-8 pb-6 text-center">
            <Clock className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-yellow-700 mb-2">Pendaftaran Terkirim!</h2>
            <p className="text-gray-600 text-sm mb-4">
              Terima kasih telah mendaftarkan <strong>{form.name}</strong>. Akun admin perusahaan dibuat.
            </p>
            <p className="text-xs text-gray-400">Silakan login menggunakan email dan password yang didaftarkan.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-teal-50 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full shadow-xl">
        <CardHeader className="text-center pb-4">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1e3a8a, #14b8a6)" }}>
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Daftarkan Perusahaan Anda</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Gunakan AbsensiPro untuk kelola absensi karyawan Anda
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {serverError && (
            <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
              {serverError}
            </div>
          )}
          <div className="space-y-1">
            <Label>Nama Perusahaan <span className="text-red-500">*</span></Label>
            <Input
              placeholder="PT. Contoh Indonesia"
              value={form.name}
              onChange={e => { setForm({ ...form, name: e.target.value }); if (errors.name) setErrors({ ...errors, name: undefined }); }}
              className={errors.name ? "border-red-500 focus-visible:ring-red-500" : undefined}
            />
            {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Email Admin <span className="text-red-500">*</span></Label>
              <Input
                type="email"
                placeholder="admin@perusahaan.com"
                value={form.email}
                onChange={e => { setForm({ ...form, email: e.target.value }); if (errors.email) setErrors({ ...errors, email: undefined }); }}
                className={errors.email ? "border-red-500 focus-visible:ring-red-500" : undefined}
              />
              {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
            </div>
            <div className="space-y-1">
              <Label>Password <span className="text-red-500">*</span></Label>
              <Input
                type="password"
                placeholder="********"
                value={form.password}
                onChange={e => { setForm({ ...form, password: e.target.value }); if (errors.password) setErrors({ ...errors, password: undefined }); }}
                className={errors.password ? "border-red-500 focus-visible:ring-red-500" : undefined}
              />
              {errors.password && <p className="text-xs text-red-600">{errors.password}</p>}
            </div>
            <div className="space-y-1">
              <Label>Nomor Telepon</Label>
              <Input
                placeholder="08xxxxxxxxxx"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Alamat Perusahaan</Label>
            <Input
              placeholder="Jl. Sudirman No. 1, Jakarta"
              value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Industri</Label>
              <Select value={form.industry} onValueChange={v => setForm({ ...form, industry: v })}>
                <SelectTrigger><SelectValue placeholder="Pilih industri" /></SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Estimasi Karyawan</Label>
              <Input
                type="number"
                placeholder="50"
                value={form.employee_count}
                onChange={e => setForm({ ...form, employee_count: e.target.value })}
              />
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full h-11 text-base font-semibold"
            style={{ background: "linear-gradient(135deg, #1e3a8a, #14b8a6)" }}
          >
            {loading ? "Mendaftarkan..." : "Daftar Sekarang"}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Dengan mendaftar, Anda menyetujui syarat & ketentuan penggunaan layanan AbsensiPro.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
