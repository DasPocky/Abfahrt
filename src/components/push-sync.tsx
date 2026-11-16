import { useEffect, useState } from "react";
import { useFavorites } from "@/hooks/use-favorites";
import { useSavedTrip } from "@/hooks/use-saved-trip";
import { pushSupported, syncPushTopics } from "@/lib/push";
import { buildPushTopics, PUSH_CHANGED, readPushPrefs, topicsPayload } from "@/lib/push-topics";

const SENT_KEY = "abfahrt:push-sent";

function lastSent(): string | null {
  try {
    return localStorage.getItem(SENT_KEY);
  } catch {
    return null;
  }
}

/**
 * Hält die Push-Interessen beim Worker aktuell: Favoriten, gemerkte Fahrt und Einstellungen.
 * Sendet nur bei Änderungen und nur, wenn ein Push-Abo besteht. Ohne sichtbare Ausgabe.
 */
export function PushSync() {
  const { favorites } = useFavorites();
  const trip = useSavedTrip();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener(PUSH_CHANGED, bump);
    return () => window.removeEventListener(PUSH_CHANGED, bump);
  }, []);

  useEffect(() => {
    if (!pushSupported()) return undefined;
    const payload = topicsPayload(buildPushTopics(favorites, trip, readPushPrefs()));
    if (version === 0 && payload === lastSent()) return undefined;
    let active = true;
    void syncPushTopics(payload)
      .then((ok) => {
        if (ok && active) {
          try {
            localStorage.setItem(SENT_KEY, payload);
          } catch {
            // nächster Start gleicht erneut ab
          }
        }
      })
      .catch(() => {
        // offline o. Ä.: beim nächsten Mal erneut
      });
    return () => {
      active = false;
    };
  }, [favorites, trip, version]);

  return null;
}
