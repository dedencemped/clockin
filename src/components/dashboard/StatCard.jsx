import React from "react";
import { Card } from "@/components/ui/card";

export default function StatCard({ title, value, icon: Icon, color, subtitle }) {
  const colorMap = {
    blue: "bg-primary/10 text-primary",
    green: "bg-accent/10 text-accent",
    red: "bg-destructive/10 text-destructive",
    yellow: "bg-chart-3/10 text-chart-3",
  };

  return (
    <Card className="p-5 hover:shadow-lg transition-shadow duration-300">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-3xl font-bold text-foreground tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${colorMap[color] || colorMap.blue}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
}