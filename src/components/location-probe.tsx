import { useState } from "react";
import { LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Unter dieser Zeit kam die Ablehnung ohne sichtbare Abfrage (Browser hat selbst gesperrt) */
const INSTANT_MS = 400;

type Probe =
  { state: "idle" } | { state: "running" } | { state: "done"; text: string; ok: boolean };

async function permissionState(): Promise<string> {
  try {
    const result = await navigator.permissions?.query({ name: "geolocation" });
    return result ? result.state : "unbekannt";
  } catch {
    return "nicht abfragbar";
  }
}

/**
 * Knopf „Standort jetzt anfordern“: fordert per Antippen an (zählt als Nutzeraktion) und zeigt
 * die rohe Antwort des Browsers, damit man sieht, ob er gefragt oder sofort gesperrt hat.
 */
export function LocationProbe() {
  const [probe, setProbe] = useState<Probe>({ state: "idle" });

  async function run() {
    if (!("geolocation" in navigator)) {
      setProbe({ state: "done", ok: false, text: "Dieser Browser kennt keinen Standort." });
      return;
    }
    setProbe({ state: "running" });
    const before = await permissionState();
    const start = performance.now();
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setProbe({
          state: "done",
          ok: true,
          text: `Erlaubt ✓ Genauigkeit ca. ${Math.round(pos.coords.accuracy)} m (Freigabe vorher: ${before})`,
        });
      },
      (err) => {
        const ms = Math.round(performance.now() - start);
        const instant = err.code === err.PERMISSION_DENIED && ms < INSTANT_MS;
        setProbe({
          state: "done",
          ok: false,
          text:
            `Fehler ${err.code} nach ${ms} ms: ${err.message || "ohne Text"} (Freigabe vorher: ${before}).` +
            (instant
              ? " Der Browser hat sofort abgelehnt, ohne zu fragen – er sperrt den Standort für diese Seite."
              : ""),
        });
      },
      { enableHighAccuracy: false, maximumAge: 0, timeout: 15_000 },
    );
  }

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => void run()}
        disabled={probe.state === "running"}
      >
        <LocateFixed aria-hidden="true" />
        {probe.state === "running" ? "Wird angefordert …" : "Standort jetzt anfordern"}
      </Button>
      {probe.state === "done" && (
        <p role="status" className={probe.ok ? "text-sm text-success" : "text-sm text-destructive"}>
          {probe.text}
        </p>
      )}
    </div>
  );
}
