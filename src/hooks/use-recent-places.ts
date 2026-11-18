import { useSyncExternalStore } from "react";
import { getRecent, type RecentPlace, subscribeRecent } from "@/lib/recent-places";

const EMPTY: RecentPlace[] = [];

/** Zuletzt gewählte Orte der Suche (#119), neueste zuerst */
export function useRecentPlaces(): RecentPlace[] {
  return useSyncExternalStore(subscribeRecent, getRecent, () => EMPTY);
}
