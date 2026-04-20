import React from "react"
import { Link } from "react-router-dom"
import { Home, MapPin, Clock, FileText, User, Plus } from "lucide-react"

export default function MobileNav({ active, action = true }) {
  const item = (to, label, Icon) => {
    const isActive = active === label
    const cls = isActive ? "text-foreground" : "text-muted-foreground"
    return (
      <Link to={to} className={`flex flex-col items-center ${cls}`}>
        <Icon className="w-5 h-5" />
        <span className="text-[10px]">{label}</span>
      </Link>
    )
  }
  return (
    <div className="sm:hidden fixed bottom-0 inset-x-0 bg-card border-t h-16 z-50">
      <div className="max-w-md mx-auto h-full flex items-center justify-around relative">
        {item("/MobileHome", "Home", Home)}
        {item("/MobileCoordinates", "Lokasi", MapPin)}
        {item("/MobileWorkHours", "Jam", Clock)}
        {item("/MobileHistory", "Riwayat", FileText)}
        {item("/MobileProfile", "Profile", User)}
        {action && (
          <Link to="/MobileLeave" className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
            <Plus className="w-6 h-6" />
          </Link>
        )}
      </div>
    </div>
  )
}
