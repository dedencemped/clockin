import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogIn, LogOut } from "lucide-react";

const statusColors = {
  hadir: "bg-accent/10 text-accent border-accent/20",
  terlambat: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  alpha: "bg-destructive/10 text-destructive border-destructive/20",
  izin: "bg-primary/10 text-primary border-primary/20",
  cuti: "bg-chart-5/10 text-chart-5 border-chart-5/20",
};

export default function RecentActivity({ attendances }) {
  const recent = attendances.slice(0, 8);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Aktivitas Terbaru</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {recent.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">Belum ada aktivitas hari ini</p>
        )}
        {recent.map((att, i) => (
          <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
              {att.employee_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{att.employee_name}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {att.clock_in && (
                  <span className="flex items-center gap-1">
                    <LogIn className="w-3 h-3" /> {att.clock_in}
                  </span>
                )}
                {att.clock_out && (
                  <span className="flex items-center gap-1">
                    <LogOut className="w-3 h-3" /> {att.clock_out}
                  </span>
                )}
              </div>
            </div>
            <Badge variant="outline" className={`text-[10px] shrink-0 ${statusColors[att.status] || ""}`}>
              {att.status}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
