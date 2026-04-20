import { create } from "zustand";
import type { ActiveView } from "@/types";

interface UiState {
  activeView: ActiveView;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  theme: "light" | "dark" | "system";
  searchOpen: boolean;
  commandPaletteOpen: boolean;

  setActiveView: (view: ActiveView) => void;
  setSidebarWidth: (width: number) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setSearchOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeView: { type: "dashboard" },
  sidebarWidth: 240,
  sidebarCollapsed: false,
  theme: "dark",
  searchOpen: false,
  commandPaletteOpen: false,

  setActiveView: (view) => set({ activeView: view }),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setTheme: (theme) => set({ theme }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
}));
