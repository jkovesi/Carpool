import { supabase } from "./supabase";

// ============================================================
// Típusok — a Supabase séma (profiles / vehicles / ride_details /
// my_bookings / my_listings) leképezései.
// ============================================================

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  phone: string;
}

export interface Vehicle {
  id: string;
  type: string;
  plate: string;
  seats: number;
  color: string | null;
}

export interface RideDetails {
  id: string;
  driver_id: string;
  driver_username: string;
  driver_full_name: string | null;
  from_city: string;
  to_city: string;
  ride_date: string;
  ride_time: string;
  price_huf: number;
  seats_total: number;
  car_type: string;
  car_color: string | null;
  car_plate: string | null;
  status: "active" | "cancelled";
  seats_booked: number;
  seats_available: number;
  created_at: string;
}

export interface MyBooking {
  booking_id: string;
  seats_booked: number;
  booking_status: "active" | "cancelled";
  display_status: "active" | "cancelled" | "closed";
  listing_id: string;
  from_city: string;
  to_city: string;
  ride_date: string;
  ride_time: string;
  price_huf: number;
  car_type: string;
  car_color: string | null;
  car_plate: string | null;
  driver_id: string;
  driver_username: string;
  driver_full_name: string | null;
  created_at: string;
}

function friendlyError(error: { message: string } | null): never | void {
  if (!error) return;
  throw new Error(error.message);
}

// ============================================================
// Auth (KAN-2)
// ============================================================

export async function signUp(params: {
  email: string;
  password: string;
  username: string;
  fullName: string;
  phone: string;
}) {
  const { email, password, username, fullName, phone } = params;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, full_name: fullName, phone },
      emailRedirectTo: window.location.origin,
    },
  });
  if (error) throw new Error(error.message);
  return data;
}

// Bejelentkezés felhasználónévvel VAGY e-mail címmel.
export async function signInWithIdentifier(identifier: string, password: string) {
  let email = identifier;
  if (!identifier.includes("@")) {
    const { data: resolvedEmail, error: lookupError } = await supabase.rpc("email_for_username", {
      p_username: identifier,
    });
    if (lookupError) throw new Error(lookupError.message);
    if (!resolvedEmail) throw new Error("Nincs ilyen felhasználónévvel regisztrált fiók.");
    email = resolvedEmail as string;
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error("Hibás felhasználónév/e-mail vagy jelszó.");
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  friendlyError(error);
}

export async function resendConfirmationEmail(email: string) {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: window.location.origin },
  });

export async function getMyProfile(): Promise<Profile | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, phone")
    .eq("id", userData.user.id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateMyProfile(patch: { full_name?: string; username?: string; phone?: string }) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Nincs bejelentkezve.");
  const { error } = await supabase.from("profiles").update(patch).eq("id", userData.user.id);
  friendlyError(error);
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const { data: userData } = await supabase.auth.getUser();
  const email = userData.user?.email;
  if (!email) throw new Error("Nincs bejelentkezve.");

  // A jelenlegi jelszó ellenőrzése újra-bejelentkezéssel.
  const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
  if (verifyError) throw new Error("A jelenlegi jelszó nem megfelelő.");

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  friendlyError(error);
}

// ============================================================
// Járművek (KAN-3)
// ============================================================

export async function listMyVehicles(): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("id, type, plate, seats, color")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addVehicle(v: { type: string; plate: string; seats: number; color?: string }) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Nincs bejelentkezve.");
  const { error } = await supabase.from("vehicles").insert({
    owner_id: userData.user.id,
    type: v.type,
    plate: v.plate,
    seats: v.seats,
    color: v.color || null,
  });
  friendlyError(error);
}

export async function removeVehicle(id: string) {
  const { error } = await supabase.from("vehicles").delete().eq("id", id);
  friendlyError(error);
}

// ============================================================
// Hirdetések keresése / részletek (KAN-4, KAN-5)
// ============================================================

export async function listAvailableRides(filters: {
  from?: string;
  to?: string;
  date?: string;
  minSeats?: number;
}): Promise<RideDetails[]> {
  let query = supabase
    .from("ride_details")
    .select("*")
    .eq("status", "active")
    .gte("ride_date", new Date().toISOString().slice(0, 10))
    .order("ride_date", { ascending: true });

  if (filters.from) query = query.ilike("from_city", `%${filters.from}%`);
  if (filters.to) query = query.ilike("to_city", `%${filters.to}%`);
  if (filters.date) query = query.eq("ride_date", filters.date);
  if (filters.minSeats) query = query.gte("seats_available", filters.minSeats);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).filter((r) => r.seats_available > 0);
}

export async function getRideDetails(id: string): Promise<RideDetails | null> {
  const { data, error } = await supabase.from("ride_details").select("*").eq("id", id).single();
  if (error) return null;
  return data;
}

export async function createListing(params: {
  vehicleId: string;
  from: string;
  to: string;
  date: string;
  time: string;
  price: number;
  seats: number;
}) {
  const { error } = await supabase.rpc("create_listing", {
    p_vehicle_id: params.vehicleId,
    p_from_city: params.from,
    p_to_city: params.to,
    p_ride_date: params.date,
    p_ride_time: params.time,
    p_price_huf: params.price,
    p_seats_total: params.seats,
  });
  friendlyError(error);
}

export async function updateListing(params: {
  listingId: string;
  price: number;
  seats: number;
  date: string;
  time: string;
}) {
  const { error } = await supabase.rpc("update_listing", {
    p_listing_id: params.listingId,
    p_price_huf: params.price,
    p_seats_total: params.seats,
    p_ride_date: params.date,
    p_ride_time: params.time,
  });
  friendlyError(error);
}

export async function cancelListing(listingId: string) {
  const { error } = await supabase.rpc("cancel_listing", { p_listing_id: listingId });
  friendlyError(error);
}

export async function listMyListings(): Promise<RideDetails[]> {
  const { data, error } = await supabase.from("my_listings").select("*").order("ride_date", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ============================================================
// Foglalások (KAN-6, KAN-7, KAN-8)
// ============================================================

export async function bookRide(listingId: string, seats: number): Promise<string> {
  const { data, error } = await supabase.rpc("book_ride", { p_listing_id: listingId, p_seats: seats });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function cancelBooking(bookingId: string) {
  const { error } = await supabase.rpc("cancel_booking", { p_booking_id: bookingId });
  friendlyError(error);
}

export async function listMyBookings(): Promise<MyBooking[]> {
  const { data, error } = await supabase.from("my_bookings").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}
