export type ViewId =
  | "home"
  | "climate"
  | "energy"
  | "security"
  | "irrigation"
  | "settings"
  | "health";

export interface NavItem {
  id: ViewId;
  label: string;
  icon: string;
  visible?: "seasonal" | "admin";
}

export const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Home", icon: "mdi:home" },
  { id: "climate", label: "Climate", icon: "mdi:thermometer" },
  { id: "energy", label: "Energy", icon: "mdi:solar-power", visible: "seasonal" },
  { id: "security", label: "Security", icon: "mdi:cctv" },
  { id: "irrigation", label: "Irrigation", icon: "mdi:sprinkler", visible: "seasonal" },
  { id: "settings", label: "Settings", icon: "mdi:tune" },
  { id: "health", label: "Health", icon: "mdi:heart-pulse", visible: "admin" },
];
