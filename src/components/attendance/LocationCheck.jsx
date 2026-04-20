import React from "react";
import { MapPin, CheckCircle2, XCircle, Loader2 } from "lucide-react";

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function LocationCheck({ userLat, userLng, branches, loading }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm p-3 rounded-lg bg-muted/50">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Mengambil lokasi GPS...</span>
      </div>
    );
  }

  if (!userLat || !userLng) {
    return (
      <div className="flex items-center gap-2 text-destructive text-sm p-3 rounded-lg bg-destructive/5">
        <XCircle className="w-4 h-4" />
        <span>Gagal mendapatkan lokasi. Aktifkan GPS.</span>
      </div>
    );
  }

  const matchedBranch = branches.find(b => {
    const dist = getDistance(userLat, userLng, b.latitude, b.longitude);
    return dist <= (b.radius || 100);
  });

  if (matchedBranch) {
    return (
      <div className="flex items-center gap-2 text-accent text-sm p-3 rounded-lg bg-accent/5">
        <CheckCircle2 className="w-4 h-4" />
        <span>Lokasi valid — <strong>{matchedBranch.name}</strong></span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-destructive text-sm p-3 rounded-lg bg-destructive/5">
      <MapPin className="w-4 h-4" />
      <span>Anda berada di luar radius lokasi kantor</span>
    </div>
  );
}

export { getDistance };