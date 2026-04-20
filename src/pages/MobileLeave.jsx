import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import moment from "moment";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";

export default function MobileLeave() {
  const { user: authUser } = useAuth();
  const { toast } = useToast();
  const [employee, setEmployee] = useState(null);
  const [form, setForm] = useState({ type: "cuti", reason: "", notes: "", start_date: moment().format("YYYY-MM-DD"), end_date: moment().format("YYYY-MM-DD") });
  const [submitted, setSubmitted] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!authUser?.email) return;
    fetch("/api/employees")
      .then(r => r.json())
      .then(rows => {
        const me = rows.find(e => e.email === authUser.email) || rows.find(e => e.id === authUser.id);
        if (me) setEmployee(me);
      })
      .catch(() => {});
  }, [authUser?.email, authUser?.id]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!employee?.id) throw new Error("Data karyawan tidak ditemukan");
      const payload = {
        employee_id: Number(employee.id),
        type: form.type,
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason || "",
        notes: form.notes || "",
      };
      const res = await fetch("/api/leave-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(()=>({}));
        throw new Error(d.error || "Gagal mengirim pengajuan");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      toast({ title: "Berhasil", description: "Pengajuan terkirim" });
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setForm({ type: "cuti", reason: "", notes: "", start_date: moment().format("YYYY-MM-DD"), end_date: moment().format("YYYY-MM-DD") });
      }, 2000);
    },
    onError: (e) => {
      toast({ title: "Gagal mengirim", description: e.message || "Terjadi kesalahan" });
    },
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="w-8"></div>
        <p className="text-xs tracking-widest text-gray-500 uppercase font-medium">Presensi</p>
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
          <span className="text-white text-xs font-bold">📋</span>
        </div>
      </div>

      {/* Title */}
      <div className="px-4 mb-2 text-center">
        <h2 className="text-2xl font-bold text-gray-800">Presensi Dengan Form</h2>
        <p className="text-base font-semibold text-gray-600">{moment().format("DD/MM/YYYY")}</p>
      </div>

      {/* Description */}
      <div className="px-4 mb-6">
        <p className="text-sm text-teal-500 text-center">
          Jika anda berhalangan dan tidak bisa bekerja harap mengisi form dibawah ini dengan alasan yang logis.
        </p>
      </div>

      {submitted ? (
        <div className="mx-4 bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
          <p className="text-green-600 font-semibold text-lg">✓ Pengajuan Terkirim!</p>
          <p className="text-green-500 text-sm mt-1">Menunggu persetujuan dari HRD</p>
        </div>
      ) : (
        <div className="px-4 space-y-4">
          {/* Type Select */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <Select value={form.type} onValueChange={v => setForm({...form, type: v})}>
              <SelectTrigger className="border-0 shadow-none h-14 px-4 text-gray-500 text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cuti">Cuti</SelectItem>
                <SelectItem value="izin">Izin</SelectItem>
                <SelectItem value="sakit">Sakit</SelectItem>
                <SelectItem value="dinas_luar">Izin Dinas Luar</SelectItem>
                <SelectItem value="terlambat_masuk">Terlambat Masuk Kerja</SelectItem>
                <SelectItem value="lain_lain">Lain-lain</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl border border-gray-200">
              <input
                type="date"
                value={form.start_date}
                onChange={e => setForm({...form, start_date: e.target.value})}
                className="w-full h-14 px-4 text-sm text-gray-500 bg-transparent outline-none rounded-2xl"
              />
            </div>
            <div className="bg-white rounded-2xl border border-gray-200">
              <input
                type="date"
                value={form.end_date}
                onChange={e => setForm({...form, end_date: e.target.value})}
                className="w-full h-14 px-4 text-sm text-gray-500 bg-transparent outline-none rounded-2xl"
              />
            </div>
          </div>

          {/* Reason Input */}
          <div className="bg-white rounded-2xl border border-gray-200">
            <input
              type="text"
              placeholder="Alasan"
              value={form.reason}
              onChange={e => setForm({...form, reason: e.target.value})}
              className="w-full h-14 px-4 text-base text-gray-700 bg-transparent outline-none placeholder-gray-300"
            />
          </div>

          {/* Notes Textarea */}
          <div className="bg-white rounded-2xl border border-gray-200">
            <textarea
              placeholder="Keterangan (opsional)"
              value={form.notes}
              onChange={e => setForm({...form, notes: e.target.value})}
              rows={4}
              className="w-full px-4 py-4 text-base text-gray-700 bg-transparent outline-none placeholder-gray-300 resize-none"
            />
          </div>

          {/* Submit Button */}
          <button
            onClick={() => {
              const s = moment(form.start_date, "YYYY-MM-DD", true);
              const e = moment(form.end_date, "YYYY-MM-DD", true);
              if (!employee) {
                toast({ title: "Data tidak ditemukan", description: "Data karyawan tidak ditemukan" });
                return;
              }
              if (!s.isValid() || !e.isValid() || e.isBefore(s)) {
                toast({ title: "Tanggal tidak valid", description: "Tanggal selesai tidak boleh sebelum tanggal mulai" });
                return;
              }
              if (!(form.reason || form.notes)) {
                toast({ title: "Alasan wajib", description: "Isi alasan pengajuan" });
                return;
              }
              createMutation.mutate();
            }}
            disabled={createMutation.isPending || !(form.reason || form.notes) || !employee}
            className="w-full py-4 rounded-2xl text-white font-semibold text-base disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #1e3a8a, #14b8a6)" }}
          >
            {createMutation.isPending ? "Mengirim..." : "Kirim Presensi"}
          </button>

          {/* Cancel Button */}
          <button
            onClick={() => setForm({ type: "cuti", reason: "", notes: "", start_date: moment().format("YYYY-MM-DD"), end_date: moment().format("YYYY-MM-DD") })}
            className="w-full py-4 rounded-2xl text-gray-400 font-medium text-base border border-gray-200 bg-white"
          >
            Batal
          </button>
        </div>
      )}
    </div>
  );
}
