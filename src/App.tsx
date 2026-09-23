import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Page, PAGE_LABELS } from "./types";
import { supabase } from "./lib/supabase";
import { signOut } from "./lib/api";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import EmailConfirm from "./pages/EmailConfirm";
import RideDetail from "./pages/RideDetail";
import CreateListing from "./pages/CreateListing";
import Profile from "./pages/Profile";
import ChangePassword from "./pages/ChangePassword";
import Vehicles from "./pages/Vehicles";
import MyListings from "./pages/MyListings";
import MyBookings from "./pages/MyBookings";
import EditListing from "./pages/EditListing";
import MyPassengers from "./pages/MyPassengers";

type AuthNotice = { type: "success" | "error"; message: string };

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("home");
  const [pageStack, setPageStack] = useState<Page[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedRideId, setSelectedRideId] = useState<string | null>(null);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [passengersListingId, setPassengersListingId] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState("");
  const [authNotice, setAuthNotice] = useState<AuthNotice | null>(null);

  // Email-megerősítés utáni visszairányítás kezelése (KAN-2, 4.14): a Supabase
  // a megerősítő linkről a tokeneket URL hash-ben adja vissza. Mivel a
  // supabase.ts-ben a detectSessionInUrl ki van kapcsolva, ez SOHA nem
  // jelentkezteti be automatikusan a felhasználót — csak felismerjük a
  // visszairányítást, megtisztítjuk az URL-t, és a bejelentkezés oldalon
  // mutatunk egy sikeres/hibás megerősítés üzenetet.
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    if (hash.includes("type=signup") || hash.includes("type=email_change")) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      setAuthNotice({ type: "success", message: "Sikeresen megerősítetted az e-mail címedet! Most már bejelentkezhetsz." });
      setCurrentPage("login");
    } else if (hash.includes("error=")) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      const expired = hash.includes("otp_expired");
      setAuthNotice({
        type: "error",
        message: expired
          ? "A megerősítő link lejárt vagy már felhasználták. Kérj új linket a bejelentkezés oldalon."
          : "Hiba történt az e-mail megerősítése során. Próbáld meg újra.",
      });
      setCurrentPage("login");
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const isLoggedIn = !!session;
  const currentUserId = session?.user?.id ?? null;

  const navigate = (page: Page) => {
    setPageStack((s) => [...s, currentPage]);
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Kontextusérzékeny "Vissza": mindig oda ugrik, ahonnan a felhasználó az adott
  // oldalra navigált — nem egy rögzített szülő oldalra.
  const goBack = () => {
    const prev = pageStack[pageStack.length - 1];
    setPageStack((s) => s.slice(0, -1));
    setCurrentPage(prev ?? "home");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // A "Vissza" gomb felirata mindig azt az oldalt nevezi meg, ahová a gomb
  // ténylegesen visszavisz (KAN-1 #2).
  const backLabel = PAGE_LABELS[pageStack[pageStack.length - 1] ?? "home"];

  const selectRide = (id: string) => {
    setSelectedRideId(id);
    navigate("ride-detail");
  };

  const selectListingToEdit = (id: string) => {
    setSelectedListingId(id);
    navigate("edit-listing");
  };

  const selectListingToPassengers = (id: string) => {
    setPassengersListingId(id);
    navigate("my-passengers");
  };

  const openAllPassengers = () => {
    setPassengersListingId(null);
    navigate("my-passengers");
  };

  const logout = async () => {
    await signOut().catch(() => {});
    setPageStack([]);
    setCurrentPage("home");
  };

  const authPages: Page[] = ["profile", "change-password", "vehicles", "my-listings", "my-bookings", "create-listing", "edit-listing", "my-passengers"];
  const hideNav: Page[] = [];

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#717171] text-sm">
        Betöltés…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {!hideNav.includes(currentPage) && (
        <Navbar
          currentPage={currentPage}
          isLoggedIn={isLoggedIn}
          navigate={navigate}
          logout={logout}
          openPassengers={openAllPassengers}
        />
      )}

      {currentPage === "home" && <Home navigate={navigate} selectRide={selectRide} isLoggedIn={isLoggedIn} currentUserId={currentUserId} />}
      {currentPage === "login" && (
        <Login navigate={navigate} goBack={goBack} notice={authNotice} clearNotice={() => setAuthNotice(null)} />
      )}
      {currentPage === "register" && <Register navigate={navigate} goBack={goBack} onRegistered={setPendingEmail} />}
      {currentPage === "email-confirm" && <EmailConfirm navigate={navigate} email={pendingEmail} />}
      {currentPage === "ride-detail" && <RideDetail navigate={navigate} goBack={goBack} isLoggedIn={isLoggedIn} rideId={selectedRideId} currentUserId={currentUserId} />}

      {currentPage === "create-listing" && (
        isLoggedIn
          ? <CreateListing navigate={navigate} goBack={goBack} backLabel={backLabel} />
          : <Login navigate={navigate} goBack={goBack} notice={authNotice} clearNotice={() => setAuthNotice(null)} />
      )}
      {currentPage === "profile" && (
        isLoggedIn
          ? <Profile navigate={navigate} goBack={goBack} />
          : <Login navigate={navigate} goBack={goBack} notice={authNotice} clearNotice={() => setAuthNotice(null)} />
      )}
      {currentPage === "change-password" && (
        isLoggedIn
          ? <ChangePassword navigate={navigate} goBack={goBack} backLabel={backLabel} />
          : <Login navigate={navigate} goBack={goBack} notice={authNotice} clearNotice={() => setAuthNotice(null)} />
      )}
      {currentPage === "vehicles" && (
        isLoggedIn
          ? <Vehicles navigate={navigate} goBack={goBack} backLabel={backLabel} />
          : <Login navigate={navigate} goBack={goBack} notice={authNotice} clearNotice={() => setAuthNotice(null)} />
      )}
      {currentPage === "my-listings" && (
        isLoggedIn
          ? (
            <MyListings
              navigate={navigate}
              goBack={goBack}
              selectListingToEdit={selectListingToEdit}
              selectListingToPassengers={selectListingToPassengers}
            />
          )
          : <Login navigate={navigate} goBack={goBack} notice={authNotice} clearNotice={() => setAuthNotice(null)} />
      )}
      {currentPage === "my-bookings" && (
        isLoggedIn
          ? <MyBookings navigate={navigate} goBack={goBack} backLabel={backLabel} />
          : <Login navigate={navigate} goBack={goBack} notice={authNotice} clearNotice={() => setAuthNotice(null)} />
      )}
      {currentPage === "edit-listing" && (
        isLoggedIn
          ? <EditListing navigate={navigate} goBack={goBack} listingId={selectedListingId} backLabel={backLabel} />
          : <Login navigate={navigate} goBack={goBack} notice={authNotice} clearNotice={() => setAuthNotice(null)} />
      )}
      {currentPage === "my-passengers" && (
        isLoggedIn
          ? <MyPassengers navigate={navigate} goBack={goBack} backLabel={backLabel} listingId={passengersListingId} />
          : <Login navigate={navigate} goBack={goBack} notice={authNotice} clearNotice={() => setAuthNotice(null)} />
      )}
    </div>
  );
}
