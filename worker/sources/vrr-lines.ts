import type { TransportMode } from "../../shared/api-types";
import { fetchJson } from "../http";
import { MODE_BY_CLASS } from "./vrr";

// Linien einer Haltestelle laut VRR (EFA „servingLines“), für den Abgleich der Steige auf der
// Karte (#88). Das klassische JSON-Format liefert die Liste, rapidJSON nicht.
const BASE = "https://openservice.vrr.de/openservice";

interface VrrServingLines {
  servingLines?: { lines?: { mode?: { type?: string } }[] | null } | null;
}

/** Verkehrsmittel der Linien an einer VRR-Haltestelle (DHID, z. B. „de:05111:18221“) */
export async function servingModes(dhid: string): Promise<TransportMode[]> {
  const params = new URLSearchParams({
    outputFormat: "JSON",
    type_dm: "stop",
    name_dm: dhid,
    mode: "line",
    lineReqType: "1",
  });
  const data = await fetchJson<VrrServingLines>(
    "vrr",
    `${BASE}/XML_DM_REQUEST?${params.toString()}`,
  );
  const modes = new Set<TransportMode>();
  for (const line of data.servingLines?.lines ?? []) {
    const mode = MODE_BY_CLASS[Number(line.mode?.type)];
    if (mode) modes.add(mode);
  }
  return [...modes];
}
