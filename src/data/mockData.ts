/**
 * Megosztott, demó-célú adatforrás. Ez váltódik majd le a valós Supabase-lekérdezésekre
 * a KAN-2 -> KAN-8 sztorik backend-bekötésekor; addig ugyanezt a formát látja minden oldal
 * (Home, RideDetail, CreateListing, Vehicles), így konzisztens az adat mindenhol.
 */

export interface Ride {
  id: number;
  from: string;
  to: string;
  fromStop: string;
  toStop: string;
  date: string;
  time: string;
  arrivalTime: string;
  price: number;
  seatsTotal: number;
  seatsAvailable: number;
  durationLabel: string;
  distanceKm: number;
  driverUsername: string;
  driverFullName: string;
  driverRating: number;
  driverReviewCount: number;
  carType: string;
  carColor: string;
  carPlate: string;
}

export const RIDES: Ride[] = [
  {
    id: 1,
    from: "Budapest",
    to: "Debrecen",
    fromStop: "Keleti pályaudvar",
    toStop: "Nagyállomás",
    date: "2026-09-20",
    time: "08:00",
    arrivalTime: "10:30",
    price: 2800,
    seatsTotal: 4,
    seatsAvailable: 3,
    durationLabel: "2ó 30p",
    distanceKm: 230,
    driverUsername: "kovacs.peter",
    driverFullName: "Kovács Péter",
    driverRating: 4.9,
    driverReviewCount: 47,
    carType: "Toyota Corolla",
    carColor: "Szürke",
    carPlate: "ABC-123",
  },
  {
    id: 2,
    from: "Budapest",
    to: "Pécs",
    fromStop: "Népliget",
    toStop: "Pécs, Autóbusz-állomás",
    date: "2026-09-20",
    time: "09:30",
    arrivalTime: "12:20",
    price: 3200,
    seatsTotal: 4,
    seatsAvailable: 2,
    durationLabel: "2ó 50p",
    distanceKm: 200,
    driverUsername: "nagy.anna",
    driverFullName: "Nagy Anna",
    driverRating: 4.8,
    driverReviewCount: 32,
    carType: "Volkswagen Golf",
    carColor: "Fekete",
    carPlate: "XYZ-456",
  },
  {
    id: 3,
    from: "Budapest",
    to: "Győr",
    fromStop: "Népliget",
    toStop: "Győr vasútállomás",
    date: "2026-09-21",
    time: "07:00",
    arrivalTime: "08:30",
    price: 1900,
    seatsTotal: 4,
    seatsAvailable: 4,
    durationLabel: "1ó 30p",
    distanceKm: 120,
    driverUsername: "toth.gabor",
    driverFullName: "Tóth Gábor",
    driverRating: 5.0,
    driverReviewCount: 21,
    carType: "Škoda Octavia",
    carColor: "Kék",
    carPlate: "DEF-789",
  },
  {
    id: 4,
    from: "Budapest",
    to: "Miskolc",
    fromStop: "Stadionok",
    toStop: "Miskolc, Búza tér",
    date: "2026-09-21",
    time: "10:00",
    arrivalTime: "11:50",
    price: 2500,
    seatsTotal: 4,
    seatsAvailable: 1,
    durationLabel: "1ó 50p",
    distanceKm: 180,
    driverUsername: "szabo.reka",
    driverFullName: "Szabó Réka",
    driverRating: 4.7,
    driverReviewCount: 15,
    carType: "Opel Astra",
    carColor: "Fehér",
    carPlate: "JKL-345",
  },
  {
    id: 5,
    from: "Debrecen",
    to: "Budapest",
    fromStop: "Nagyállomás",
    toStop: "Keleti pályaudvar",
    date: "2026-09-22",
    time: "06:30",
    arrivalTime: "09:00",
    price: 2800,
    seatsTotal: 4,
    seatsAvailable: 3,
    durationLabel: "2ó 30p",
    distanceKm: 230,
    driverUsername: "horvath.david",
    driverFullName: "Horváth Dávid",
    driverRating: 4.6,
    driverReviewCount: 11,
    carType: "Ford Focus",
    carColor: "Piros",
    carPlate: "MNO-234",
  },
  {
    id: 6,
    from: "Győr",
    to: "Budapest",
    fromStop: "Győr vasútállomás",
    toStop: "Népliget",
    date: "2026-09-22",
    time: "14:00",
    arrivalTime: "15:30",
    price: 1900,
    seatsTotal: 4,
    seatsAvailable: 2,
    durationLabel: "1ó 30p",
    distanceKm: 120,
    driverUsername: "fekete.lilla",
    driverFullName: "Fekete Lilla",
    driverRating: 4.9,
    driverReviewCount: 28,
    carType: "Suzuki Vitara",
    carColor: "Zöld",
    carPlate: "PQR-567",
  },
];

export interface Vehicle {
  id: number;
  type: string;
  plate: string;
  seats: number;
  color?: string;
}

// A bejelentkezett demó-felhasználó (Kovács Péter) saját járművei — a CreateListing
// jármű-választója és a Vehicles oldal ugyanezt a listát kezeli.
export const MY_VEHICLES: Vehicle[] = [
  { id: 1, type: "Toyota Corolla", plate: "ABC-123", seats: 4, color: "Szürke" },
  { id: 2, type: "Honda Civic", plate: "STU-890", seats: 4, color: "Kék" },
];
