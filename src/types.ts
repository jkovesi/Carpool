export type Page =
  | "home"
  | "login"
  | "register"
  | "email-confirm"
  | "ride-detail"
  | "create-listing"
  | "profile"
  | "change-password"
  | "vehicles"
  | "my-listings"
  | "my-bookings"
  | "edit-listing"
  | "my-passengers";

// Kontextusérzékeny "Vissza" gombok felirata: az adott oldalra mutató felirat,
// amit akkor jelenítünk meg, amikor egy másik oldalról ide navigáltunk vissza.
export const PAGE_LABELS: Record<Page, string> = {
  home: "Vissza a főoldalra",
  login: "Vissza a bejelentkezéshez",
  register: "Vissza a regisztrációhoz",
  "email-confirm": "Vissza",
  "ride-detail": "Vissza a hirdetéshez",
  "create-listing": "Vissza a hirdetés feladásához",
  profile: "Vissza a profilhoz",
  "change-password": "Vissza a jelszó módosításához",
  vehicles: "Vissza a járműveimhez",
  "my-listings": "Vissza a hirdetéseimhez",
  "my-bookings": "Vissza a foglalásaimhoz",
  "edit-listing": "Vissza a hirdetés szerkesztéséhez",
  "my-passengers": "Vissza az utasaimhoz",
};

export interface AppState {
  currentPage: Page;
  isLoggedIn: boolean;
  navigate: (page: Page) => void;
  goBack: () => void;
  login: () => void;
  logout: () => void;
}
