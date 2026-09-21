import { useEffect, useState } from "react";
import { Page } from "../types";
import { countNewPassengers } from "../lib/api";

interface NavbarProps {
  currentPage: Page;
  isLoggedIn: boolean;
  navigate: (page: Page) => void;
  logout: () => void;
  openPassengers: () => void;
}

function PassengerBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-[#FF385C] text-white text-[10px] font-bold rounded-full">
      {count > 9 ? "9+" : count}
    </span>
  );
}

export default function Navbar({ currentPage, isLoggedIn, navigate, logout, openPassengers }: NavbarProps) {
  const [newPassengerCount, setNewPassengerCount] = useState(0);

  useEffect(() => {
    if (!isLoggedIn) {
      setNewPassengerCount(0);
      return;
    }
    countNewPassengers()
      .then(setNewPassengerCount)
      .catch(() => {});
    // A jelvényt minden oldalváltáskor frissítjük, hogy az Utasaim
    // megtekintése után (mark_passengers_viewed) gyorsan eltűnjön.
  }, [isLoggedIn, currentPage]);

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-[#DDDDDD]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <button
          onClick={() => navigate("home")}
          className="flex items-center gap-2 text-[#FF385C] font-extrabold text-xl tracking-tight"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
          Telekocsi
        </button>

        {/* Nav links */}
        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <>
              <button
                onClick={() => navigate("create-listing")}
                className="hidden sm:block text-sm font-semibold text-[#222222] px-4 py-2 rounded-full hover:bg-[#F7F7F7] transition-colors"
              >
                + Hirdetés feladása
              </button>
              {/* Avatar + dropdown: a trigger és a panel közös group-ban van, hogy a hover ténylegesen megnyissa */}
              <div className="relative group">
                <div className="flex items-center gap-1 border border-[#DDDDDD] rounded-full px-3 py-2 hover:shadow-md transition-shadow cursor-pointer">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#717171" strokeWidth="2">
                    <line x1="3" y1="6" x2="21" y2="6"/>
                    <line x1="3" y1="12" x2="21" y2="12"/>
                    <line x1="3" y1="18" x2="21" y2="18"/>
                  </svg>
                  <div className="w-7 h-7 bg-[#222222] rounded-full flex items-center justify-center ml-1 relative">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                    </svg>
                    {newPassengerCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#FF385C] rounded-full border border-white"/>
                    )}
                  </div>
                </div>
                <div className="hidden group-hover:block absolute right-0 top-12 bg-white border border-[#DDDDDD] rounded-2xl shadow-xl w-56 py-2 z-50">
                  <button onClick={() => navigate("profile")} className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-[#F7F7F7] transition-colors">Profilom</button>
                  <button onClick={() => navigate("vehicles")} className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-[#F7F7F7] transition-colors">Járműveim</button>
                  <button onClick={() => navigate("my-bookings")} className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-[#F7F7F7] transition-colors">Foglalásaim</button>
                  <button onClick={() => navigate("my-listings")} className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-[#F7F7F7] transition-colors">Hirdetéseim</button>
                  <button onClick={openPassengers} className="w-full flex items-center px-4 py-3 text-sm font-medium hover:bg-[#F7F7F7] transition-colors">
                    Utasaim
                    <PassengerBadge count={newPassengerCount} />
                  </button>
                  <div className="border-t border-[#DDDDDD] my-2"/>
                  <button onClick={logout} className="w-full text-left px-4 py-3 text-sm hover:bg-[#F7F7F7] transition-colors text-[#717171]">Kijelentkezés</button>
                </div>
              </div>
              {/* Visible quick links */}
              <div className="hidden md:flex items-center gap-1">
                <button onClick={() => navigate("my-bookings")} className={`text-sm font-medium px-3 py-2 rounded-full transition-colors ${currentPage === "my-bookings" ? "bg-[#FFF0F2] text-[#FF385C]" : "text-[#717171] hover:bg-[#F7F7F7]"}`}>Foglalásaim</button>
                <button onClick={() => navigate("my-listings")} className={`text-sm font-medium px-3 py-2 rounded-full transition-colors ${currentPage === "my-listings" ? "bg-[#FFF0F2] text-[#FF385C]" : "text-[#717171] hover:bg-[#F7F7F7]"}`}>Hirdetéseim</button>
                <button onClick={openPassengers} className={`flex items-center text-sm font-medium px-3 py-2 rounded-full transition-colors ${currentPage === "my-passengers" ? "bg-[#FFF0F2] text-[#FF385C]" : "text-[#717171] hover:bg-[#F7F7F7]"}`}>
                  Utasaim
                  <PassengerBadge count={newPassengerCount} />
                </button>
                <button onClick={logout} className="text-sm font-medium px-3 py-2 rounded-full text-[#717171] hover:bg-[#F7F7F7] transition-colors">Kilépés</button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("login")}
                className="text-sm font-semibold text-[#222222] px-4 py-2 rounded-full hover:bg-[#F7F7F7] transition-colors"
              >
                Bejelentkezés
              </button>
              <button
                onClick={() => navigate("register")}
                className="text-sm font-semibold text-white bg-[#FF385C] px-4 py-2 rounded-full hover:bg-[#E31C5F] transition-colors"
              >
                Regisztráció
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
