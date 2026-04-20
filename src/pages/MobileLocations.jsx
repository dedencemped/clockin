import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { MapPin, RefreshCw } from "lucide-react";

export default function MobileLocations() {
  const { data: branches = [], isLoading, refetch } = useQuery({
    queryKey: ["branches-mobile"],
    queryFn: () => base44.entities.Branch.list(),
  });

  // Static map thumbnail URL from openstreetmap tile
  const getMapThumb = (lat, lng) =>
    `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=80x60&markers=${lat},${lng}`;

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="w-8"></div>
        <p className="text-xs tracking-widest text-gray-500 uppercase font-medium">Koordinat</p>
        <button onClick={() => refetch()} className="w-8 h-8 bg-teal-400 rounded-full flex items-center justify-center">
          <RefreshCw className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Title */}
      <div className="px-4 mb-4">
        <h2 className="text-2xl font-bold text-gray-800">List Koordinat</h2>
        <p className="text-sm text-gray-400">Koordinat yang aktif untuk absensi</p>
      </div>

      {/* Branch List */}
      <div className="px-4 space-y-3">
        {isLoading ? (
          [1,2,3].map(i => (
            <div key={i} className="bg-white rounded-2xl h-20 animate-pulse shadow-sm"></div>
          ))
        ) : branches.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Belum ada koordinat terdaftar</p>
          </div>
        ) : (
          branches.map(branch => (
            <div key={branch.id} className="bg-white rounded-2xl shadow-sm overflow-hidden flex">
              {/* Map thumbnail */}
              <div className="w-24 h-20 bg-gray-100 flex-shrink-0 relative overflow-hidden">
                <div className="w-full h-full bg-gradient-to-br from-blue-100 to-teal-100 flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-teal-500" />
                </div>
                {branch.status === "aktif" && (
                  <div className="absolute top-2 left-2">
                    <span className="bg-teal-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Aktif</span>
                  </div>
                )}
                {branch.status === "nonaktif" && (
                  <div className="absolute top-2 left-2">
                    <span className="bg-gray-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Nonaktif</span>
                  </div>
                )}
              </div>
              {/* Info */}
              <div className="flex-1 p-3 flex flex-col justify-center">
                <p className="font-bold text-gray-800 text-sm leading-tight">{branch.name}</p>
                <p className="text-xs text-gray-400 mt-1 leading-tight">{branch.address || "-"}</p>
                <p className="text-xs text-teal-500 mt-1">Radius: {branch.radius || 100}m</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}