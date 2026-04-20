import { useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { MainPanel } from "./MainPanel";
import { useUiStore } from "@/store";

export function AppShell() {
  const { theme } = useUiStore();

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", prefersDark);
    } else {
      root.classList.toggle("dark", theme === "dark");
    }
  }, [theme]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <MainPanel />
    </div>
  );
}
