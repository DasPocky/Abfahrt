import { useSyncExternalStore } from "react";
import { useSettings } from "@/hooks/use-settings";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeDark(onChange: () => void) {
  const media = window.matchMedia?.(DARK_QUERY);
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}

/** Dunkelmodus: aus den Einstellungen erzwungen (#37), sonst der des Systems (src/index.css) */
export function usePrefersDark(): boolean {
  const { theme } = useSettings();
  const system = useSyncExternalStore(
    subscribeDark,
    () => window.matchMedia?.(DARK_QUERY).matches ?? false,
    () => false,
  );
  return theme === "system" ? system : theme === "dark";
}
