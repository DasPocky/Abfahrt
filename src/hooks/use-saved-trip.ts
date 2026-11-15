import { useSyncExternalStore } from "react";
import { getSavedTrip, subscribeSavedTrip } from "@/lib/saved-trip";

export function useSavedTrip() {
  return useSyncExternalStore(subscribeSavedTrip, getSavedTrip, () => null);
}
