import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

/**
 * Hook untuk mendapatkan company_id user yang sedang login.
 * Returns: { company, employee, loading, isAdmin, isSuperAdmin }
 */
export function useCompany() {
  const [company, setCompany] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const user = await base44.auth.me();
        // Super admin check (platform owner)
        if (user.role === "admin" && user.email === import.meta.env.VITE_SUPER_ADMIN_EMAIL) {
          setLoading(false);
          return;
        }
        // Find employee record for this user
        const emps = await base44.entities.Employee.filter({ email: user.email });
        if (emps.length > 0) {
          const emp = emps[0];
          setEmployee(emp);
          if (emp.company_id) {
            const companies = await base44.entities.Company.filter({ id: emp.company_id });
            if (companies.length > 0) setCompany(companies[0]);
          }
        } else {
          // Maybe user is company owner but not yet added as employee
          const companies = await base44.entities.Company.filter({ owner_email: user.email });
          if (companies.length > 0) setCompany(companies[0]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const isAdmin = employee?.role === "admin" || employee?.role === "hrd";
  const isSuperAdmin = !employee && !company; // fallback: treat as super admin if no company context

  return { company, employee, loading, isAdmin };
}