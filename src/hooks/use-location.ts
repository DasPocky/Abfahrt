import { useCallback, useEffect, useRef, useState } from "react";
import type { Position } from "@/lib/geo";

/** Gemerkte Entscheidung (alle Apps unter endlab.de teilen den Speicher, daher das Präfix) */
export const LOCATION_PREF_KEY = "abfahrt:location";

export type LocationStatus = "off" | "locating" | "on" | "denied" | "unavailable";

type Pref = "on" | "off" | null;

function readPref(): Pref {
  try {
    const value = localStorage.getItem(LOCATION_PREF_KEY);
    return value === "on" || value === "off" ? value : null;
  } catch {
    return null;
  }
}

function writePref(value: "on" | "off"): void {
  try {
    localStorage.setItem(LOCATION_PREF_KEY, value);
  } catch {
    // ohne Speicher gilt die Wahl nur bis zum Neuladen
  }
}

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: false, // ungefährer Standort reicht für die Sortierung
  maximumAge: 10 * 60_000,
  timeout: 10_000,
};

/**
 * Standort für die Suche. Wird nur im Browser verwendet und nie gesendet.
 * `ensureAsked` fragt einmalig (z. B. beim ersten Antippen der Suche), `toggle` schaltet um.
 */
export function useLocation() {
  // Früher erlaubt: gleich beim Start (ohne Rückfrage des Browsers) den Standort holen
  const [status, setStatus] = useState<LocationStatus>(() =>
    readPref() === "on" && "geolocation" in navigator ? "locating" : "off",
  );
  const [position, setPosition] = useState<Position | null>(null);
  const requested = useRef(false);

  /** Fragt den Standort ab; Ergebnis kommt asynchron über die Rückrufe */
  const lookup = useCallback(() => {
    requested.current = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setStatus("on");
        writePref("on");
      },
      (err) => {
        setPosition(null);
        if (err.code === err.PERMISSION_DENIED) {
          setStatus("denied");
          writePref("off");
        } else {
          setStatus("unavailable");
        }
      },
      GEO_OPTIONS,
    );
  }, []);

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }
    setStatus("locating");
    lookup();
  }, [lookup]);

  useEffect(() => {
    if (readPref() === "on" && "geolocation" in navigator) lookup();
  }, [lookup]);

  const ensureAsked = useCallback(() => {
    if (!requested.current && readPref() === null) locate();
  }, [locate]);

  const toggle = useCallback(() => {
    if (status === "on" || status === "locating") {
      writePref("off");
      setPosition(null);
      setStatus("off");
    } else {
      locate();
    }
  }, [status, locate]);

  return { status, position, ensureAsked, toggle };
}
