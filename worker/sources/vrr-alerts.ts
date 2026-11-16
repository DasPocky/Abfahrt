import type { Alert, AlertKind, AlertLine, AlertSeverity } from "../../shared/api-types";
import { fetchJson } from "../http";
import { htmlToText } from "../html-text";
import { stripCityPrefix } from "./transitous-map";
import { MODE_BY_CLASS } from "./vrr";

// VRR OpenService: Störungsmeldungen (XML_ADDINFO_REQUEST), siehe docs/01-datenquellen.md.
// Immer je Gemeinde (filterOMC) und ohne die globalen Linien-/Haltestellenlisten abfragen:
// das ganze VRR-Gebiet hat ~3,4 MB, Düsseldorf allein ~100 kB.
const BASE = "https://openservice.vrr.de/openservice";
const COMMON =
  "outputFormat=rapidJSON&version=10.4.18.18&filterValidityStatus=current" +
  "&filterShowLineList=0&filterShowStopList=0&filterShowPlaceList=0";
const TIMEOUT_MS = 15_000;
/** Längere Texte kürzen (manche Meldungen enthalten ganze Fahrpläne) */
const MAX_TEXT = 2000;
/** Gültigkeit bis ins Jahr 2500 heißt bei der EFA „bis auf Weiteres“ */
const OPEN_END_YEAR = 2400;

interface VrrInfo {
  type?: string;
  id?: string;
  version?: number;
  priority?: string;
  title?: string;
  subtitle?: string;
  content?: string;
  url?: string;
  timestamps?: {
    validity?: { from?: string; to?: string }[];
    availability?: { from?: string; to?: string };
  };
  affected?: {
    lines?: { number?: string; name?: string; product?: { class?: number } }[];
    stops?: { id?: string; name?: string }[];
  };
}

const KIND: Record<string, AlertKind> = {
  stopBlocking: "blocking",
  routeBlocking: "blocking",
  lineBlocking: "blocking",
  infrastructure: "facility",
};

const SEVERITY: Record<string, AlertSeverity> = {
  veryHigh: "high",
  high: "high",
  normal: "normal",
  low: "low",
  veryLow: "low",
};

/** „de:05111:18235:2:5“ (Steig) → „de:05111:18235“ (Haltestelle) */
export function stopDhid(id: string): string {
  return id.split(":").slice(0, 3).join(":");
}

function iso(value: string | undefined): string | null {
  if (!value) return null;
  const time = Date.parse(value);
  if (Number.isNaN(time) || new Date(time).getUTCFullYear() >= OPEN_END_YEAR) return null;
  return new Date(time).toISOString();
}

/** Titel: VRR liefert oft „Straßenbahnlinie 709:“ als Titel und den Inhalt als Untertitel */
function alertTitle(info: VrrInfo): string {
  const title = htmlToText(info.title ?? "");
  const subtitle = htmlToText(info.subtitle ?? "");
  if (!subtitle || subtitle === title) return title;
  if (!title) return subtitle;
  return title.endsWith(":") ? `${title} ${subtitle}` : subtitle;
}

function alertLines(info: VrrInfo): AlertLine[] {
  const seen = new Set<string>();
  const lines: AlertLine[] = [];
  for (const l of info.affected?.lines ?? []) {
    const line = (l.number ?? l.name ?? "").trim();
    if (!line) continue;
    const mode = MODE_BY_CLASS[l.product?.class ?? -1] ?? "other";
    const key = `${line}|${mode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push({ line, mode });
  }
  return lines;
}

export function toAlert(info: VrrInfo): Alert | null {
  if (!info.id) return null;
  const title = alertTitle(info);
  if (!title) return null;
  const fullText = htmlToText(info.content ?? "");
  const text = fullText === title || title.includes(fullText) ? "" : fullText.slice(0, MAX_TEXT);
  const validity = info.timestamps?.validity ?? [];
  const stops = new Map<string, string>();
  for (const s of info.affected?.stops ?? []) {
    if (s.id?.startsWith("de:")) {
      const id = `vrr:${stopDhid(s.id)}`;
      if (!stops.has(id)) stops.set(id, stripCityPrefix(s.name ?? "").replace(/^[^,]+, /, ""));
    }
  }
  return {
    id: `vrr:${info.id}:${info.version ?? 0}`,
    kind: KIND[info.type ?? ""] ?? "info",
    severity: SEVERITY[info.priority ?? ""] ?? "normal",
    title,
    text,
    url: info.url && /^https?:\/\//.test(info.url) ? info.url : null,
    validFrom: iso(validity[0]?.from ?? info.timestamps?.availability?.from),
    validTo: iso(validity.at(-1)?.to ?? info.timestamps?.availability?.to),
    lines: alertLines(info),
    stops: [...stops].map(([id, name]) => ({ id, name })),
  };
}

/** Aktuelle Meldungen einer Gemeinde (7-stelliger Gemeindeschlüssel, z. B. 5111000) */
export async function areaAlerts(omc: string): Promise<Alert[]> {
  const url = `${BASE}/XML_ADDINFO_REQUEST?${COMMON}&filterOMC=${omc}`;
  const data = await fetchJson<{ infos?: { current?: VrrInfo[] } }>("vrr", url, TIMEOUT_MS);
  return (data.infos?.current ?? []).map(toAlert).filter((a): a is Alert => a !== null);
}

/** Kreisfreie Städte im VRR: Gemeindeschlüssel = Kreisschlüssel ohne führende 0 + „000“ */
const CITIES: Record<string, string> = {
  "05111": "Düsseldorf",
  "05112": "Duisburg",
  "05113": "Essen",
  "05114": "Krefeld",
  "05116": "Mönchengladbach",
  "05117": "Mülheim an der Ruhr",
  "05119": "Oberhausen",
  "05120": "Remscheid",
  "05122": "Solingen",
  "05124": "Wuppertal",
  "05512": "Bottrop",
  "05513": "Gelsenkirchen",
  "05911": "Bochum",
  "05913": "Dortmund",
  "05914": "Hagen",
  "05916": "Herne",
};

/** Name einer kreisfreien Stadt zum Gemeindeschlüssel, sonst null */
export function cityName(omc: string): string | null {
  return omc.endsWith("000") ? (CITIES[`0${omc.slice(0, 4)}`] ?? null) : null;
}

/**
 * Gemeinde einer Haltestelle: in kreisfreien Städten direkt aus der DHID, in Kreisen über die
 * Haltestellensuche des VRR (Elternort „placeID:5158032:…“).
 */
export async function municipalityOf(
  dhid: string,
): Promise<{ omc: string; name: string | null } | null> {
  const district = dhid.split(":")[1] ?? "";
  const city = CITIES[district];
  if (city) return { omc: `${district.slice(1)}000`, name: city };
  const url = `${BASE}/XML_STOPFINDER_REQUEST?outputFormat=rapidJSON&version=10.4.18.18&type_sf=any&anyObjFilter_sf=2&name_sf=${encodeURIComponent(dhid)}`;
  const data = await fetchJson<{
    locations?: { id?: string; parent?: { id?: string; name?: string } }[];
  }>("vrr", url);
  const location = data.locations?.find((l) => l.id === dhid) ?? data.locations?.[0];
  const match = /^placeID:(\d{7}):/.exec(location?.parent?.id ?? "");
  return match?.[1] ? { omc: match[1], name: location?.parent?.name ?? null } : null;
}
