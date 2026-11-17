// Regionale Echtzeit-Quellen im EFA-Format (#104). Grundsatz: mehrere Quellen, je Region die beste.
// Nur Quellen, deren Nutzung für Dritte freigegeben ist (docs/05-echtzeit-abdeckung.md):
// MVV, Bayern-Fahrplan (DEFAS) und Westfalen brauchen erst eine Vereinbarung.
import type { DataSource } from "../../shared/api-types";
import { isVrrArea } from "./vrr";

export interface RegionalSource {
  key: Exclude<DataSource, "vrr" | "transitous">;
  /** EFA-Basis-URL (rapidJSON wie beim VRR) */
  base: string;
  /** Deckt die Haltestelle (DHID, z. B. „de:08111:6115“) ab */
  covers: (dhid: string) => boolean;
}

/** Landesschlüssel (erste zwei Ziffern des Kreisschlüssels in der DHID) */
function land(dhid: string): string {
  return dhid.split(":")[1]?.slice(0, 2) ?? "";
}

export const REGIONAL_SOURCES: readonly RegionalSource[] = [
  {
    // Landesweite Auskunft Baden-Württemberg der NVBW, offen über MobiData BW (EFA-JSON-API)
    key: "efa-bw",
    base: "https://www.efa-bw.de/nvbw",
    covers: (dhid) => land(dhid) === "08",
  },
];

/** Regionale Quelle für eine Haltestelle; im VRR-Gebiet bleibt der VRR zuständig */
export function regionalSourceFor(dhid: string | null): RegionalSource | null {
  if (!dhid || isVrrArea(dhid)) return null;
  return REGIONAL_SOURCES.find((s) => s.covers(dhid)) ?? null;
}
