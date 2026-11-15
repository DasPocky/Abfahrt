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

function hasGeolocation(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

/**
 * Standort für Suche, „In der Nähe“, Verbindungssuche und Karte. Die Suche sortiert nur im
 * Browser; für „In der Nähe“ geht die auf ~100 m gerundete Position an den eigenen Worker.
 *
 * Seiten mit diesem Hook fordern den Standort beim Öffnen an (wie andere Websites auch), außer
 * man hat das Standort-Symbol selbst ausgeschaltet („off“ gemerkt). Eine Ablehnung durch den
 * Browser wird nicht dauerhaft gemerkt: Beim nächsten Öffnen wird erneut gefragt. Über die
 * Permissions API erkennt der Hook eine Sperre sofort und holt den Standort automatisch, sobald
 * er in den Einstellungen freigegeben wird.
 */
export function useLocation() {
  const [status, setStatus] = useState<LocationStatus>(() =>
    readPref() !== "off" && hasGeolocation() ? "locating" : "off",
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
        // Ablehnung nicht merken: beim nächsten Öffnen wieder fragen
        setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      GEO_OPTIONS,
    );
  }, []);

  const locate = useCallback(() => {
    if (!hasGeolocation()) {
      setStatus("unavailable");
      return;
    }
    setStatus("locating");
    lookup();
  }, [lookup]);

  // Beim Öffnen anfordern und auf Änderungen der Freigabe (Einstellungen) reagieren
  useEffect(() => {
    if (readPref() === "off" || !hasGeolocation()) return undefined;
    lookup();
    let permission: PermissionStatus | null = null;
    let active = true;
    const onChange = () => {
      if (!permission || readPref() === "off") return;
      if (permission.state === "granted") lookup();
      else if (permission.state === "denied") {
        setPosition(null);
        setStatus("denied");
      }
    };
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((result) => {
        if (!active) return;
        permission = result;
        result.addEventListener("change", onChange);
      })
      .catch(() => {
        // Permissions API fehlt oder kennt „geolocation“ nicht: dann nur die Abfrage oben
      });
    return () => {
      active = false;
      permission?.removeEventListener("change", onChange);
    };
  }, [lookup]);

  const ensureAsked = useCallback(() => {
    if (!requested.current && readPref() !== "off") locate();
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

export type LocationState = ReturnType<typeof useLocation>;
