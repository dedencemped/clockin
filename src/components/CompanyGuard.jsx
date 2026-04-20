import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Clock, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Wraps admin pages to ensure the user belongs to an active company.
 * Redirects to RegisterCompany if not registered, or shows pending screen.
 */
export default function CompanyGuard({ children, companyId }) {
  const [status, setStatus] = useState("loading"); // loading | ok | pending | none

  useEffect(() => {
    const check = async () => {
      try {
        const user = await base44.auth.me();
        // Super admin bypass
        if (user.role === "admin") {
          setStatus("ok");
          return;
        }
        const companies = await base44.entities.Company.filter({ owner_email: user.email });
        if (companies.length === 0) {
          // Check if employee of a company
          const emps = await base44.entities.Employee.filter({ email: user.email });
          if (emps.length > 0 && emps[0].company_id) {
            const comp = await base44.entities.Company.filter({ id: emps[0].company_id });
            if (comp.length > 0 && comp[0].status === "aktif") {
              setStatus("ok");
            } else if (comp.length > 0 && comp[0].status === "pending") {
              setStatus("pending");
            } else {
              setStatus("none");
            }
          } else {
            setStatus("none");
          }
        } else {
          const company = companies[0];
          if (company.status === "aktif") setStatus("ok");
          else if (company.status === "pending") setStatus("pending");
          else setStatus("none");
        }
      } catch {
        setStatus("none");
      }
    };
    check();
  }, []);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8 max-w-sm">
          <Clock className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Menunggu Persetujuan</h2>
          <p className="text-gray-500 text-sm">Pendaftaran perusahaan Anda sedang ditinjau. Kami akan menghubungi Anda setelah disetujui.</p>
        </div>
      </div>
    );
  }

  if (status === "none") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8 max-w-sm">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Daftarkan Perusahaan</h2>
          <p className="text-gray-500 text-sm mb-6">Anda belum terdaftar di perusahaan manapun. Daftarkan perusahaan Anda untuk menggunakan AbsensiPro.</p>
          <Button onClick={() => window.location.href = createPageUrl("RegisterCompany")}>
            Daftarkan Perusahaan
          </Button>
        </div>
      </div>
    );
  }

  return children;
}