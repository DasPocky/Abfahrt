import { useEffect } from "react";
import { subscribeFavorites } from "@/lib/favorites";
import { getProfile, isApplying, pullProfile, pushProfile } from "@/lib/profile";
import { subscribeSettings } from "@/lib/settings";

/** Nach einer Änderung kurz warten, damit mehrere Schritte (Umsortieren) eine Anfrage werden */
const PUSH_DELAY_MS = 1500;

/**
 * Abgleich des Geräteprofils: beim Start und beim Zurückkehren in die App holen, nach Änderungen
 * an Favoriten oder Einstellungen schicken. Ohne Profil passiert nichts. Fehler bleiben still –
 * der nächste Abgleich holt es nach.
 */
export function ProfileSync() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pull = () => {
      if (getProfile()) void pullProfile().catch(() => undefined);
    };
    const schedule = () => {
      if (isApplying() || !getProfile()) return;
      clearTimeout(timer);
      timer = setTimeout(() => void pushProfile().catch(() => undefined), PUSH_DELAY_MS);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") pull();
    };
    pull();
    const offFavorites = subscribeFavorites(schedule);
    const offSettings = subscribeSettings(schedule);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      offFavorites();
      offSettings();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
