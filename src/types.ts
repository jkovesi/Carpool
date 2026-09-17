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
  | "edit-listing";

export interface AppState {
  currentPage: Page;
  isLoggedIn: boolean;
  navigate: (page: Page) => void;
  goBack: () => void;
  login: () => void;
  logout: () => void;
}
