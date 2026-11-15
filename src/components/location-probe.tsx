import { useEffect, useRef, useState } from "react";
import { LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Unter dieser Zeit kam die Ablehnung ohne sichtbare Abfrage (Browser hat selbst gesperrt) */
const INSTANT_MS = 400;
const TIMEOUT_MS = 20_000;

interface Probe {
  state: "idle" | "running" | "done";
  ok: boolean;
  text: string;
  permission: string;
  elapsed: number;
}

/** Umgebung, die für den Standort zählt (für Rückmeldungen) */
function environment(): string {
  const parts = [
    window.isSecureContext ? "https ✓" : "kein https",
    "geolocation" in navigator ? "Standort-API ✓" : "keine Standort-API",
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches
      ? "als App"
      : "im Browser",
  ];
  return parts.join(" · ");
}

/**
 * Knopf „Standort jetzt anfordern“: fordert direkt beim Antippen an (zählt als Nutzeraktion),
 * zählt die Sekunden mit und zeigt die rohe Antwort des Browsers.
 */
export function LocationProbe() {
  const [probe, setProbe] = useState<Probe>({
    state: "idle",
    ok: false,
    text: "",
    permission: "",
    elapsed: 0,
  });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  function finish(ok: boolean, text: string) {
    if (timer.current) clearInterval(timer.current);
    setProbe((p) => ({ ...p, state: "done", ok, text }));
  }

  function run() {
    if (!("geolocation" in navigator)) {
      finish(false, "Dieser Browser kennt keinen Standort.");
      return;
    }
    const start = performance.now();
    setProbe({ state: "running", ok: false, text: "", permission: "…", elapsed: 0 });
    // Zuerst und ohne Umweg anfordern, damit es als Folge des Antippens gilt
    navigator.geolocation.getCurrentPosition(
      (pos) => finish(true, `Erlaubt ✓ Genauigkeit ca. ${Math.round(pos.coords.accuracy)} m`),
      (err) => {
        const ms = Math.round(performance.now() - start);
        const instant = err.code === err.PERMISSION_DENIED && ms < INSTANT_MS;
        finish(
          false,
          `Fehler ${err.code} nach ${ms} ms: ${err.message || "ohne Text"}.` +
            (instant ? " Sofort abgelehnt, ohne zu fragen." : ""),
        );
      },
      { enableHighAccuracy: false, maximumAge: 0, timeout: TIMEOUT_MS },
    );
    timer.current = setInterval(() => {
      setProbe((p) => ({ ...p, elapsed: Math.round((performance.now() - start) / 1000) }));
    }, 1000);
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((r) => setProbe((p) => ({ ...p, permission: r.state })))
      .catch(() => setProbe((p) => ({ ...p, permission: "nicht abfragbar" })));
  }

  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" onClick={run} disabled={probe.state === "running"}>
        <LocateFixed aria-hidden="true" />
        {probe.state === "running"
          ? `Wartet auf den Browser … ${probe.elapsed} s`
          : "Standort jetzt anfordern"}
      </Button>
      {probe.state !== "idle" && (
        <div role="status" className="space-y-0.5 text-sm">
          {probe.state === "done" && (
            <p className={probe.ok ? "text-success" : "text-destructive"}>{probe.text}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Freigabe laut Browser: {probe.permission || "–"} · {environment()}
          </p>
        </div>
      )}
    </div>
  );
}
