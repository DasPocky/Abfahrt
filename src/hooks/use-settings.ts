import { useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS, getSettings, subscribeSettings, type Settings } from "@/lib/settings";

export function useSettings(): Settings {
  return useSyncExternalStore(subscribeSettings, getSettings, () => DEFAULT_SETTINGS);
}
