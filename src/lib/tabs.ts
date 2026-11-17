// Navigation unten (#106): welche Seite zu welchem Bereich gehört und wohin ein Tab führt.

export type TabKey = "abfahrten" | "verbindung" | "karte" | "stoerungen" | "mehr";

export interface TabInfo {
  key: TabKey;
  label: string;
  /** Anfang des Bereichs (relativ zum Router-basename) */
  root: string;
}

export const TABS: readonly TabInfo[] = [
  { key: "abfahrten", label: "Abfahrten", root: "/" },
  { key: "verbindung", label: "Verbindung", root: "/verbindung" },
  { key: "karte", label: "Karte", root: "/karte" },
  { key: "stoerungen", label: "Störungen", root: "/stoerungen" },
  { key: "mehr", label: "Mehr", root: "/mehr" },
];

/** Bereich einer Seite; unbekannte Seiten gehören zu keinem Tab */
export function tabForPath(pathname: string): TabKey | null {
  if (pathname === "/" || pathname.startsWith("/haltestelle/")) return "abfahrten";
  if (pathname === "/verbindung" || pathname === "/fahrt") return "verbindung";
  if (pathname === "/karte") return "karte";
  if (pathname === "/stoerungen") return "stoerungen";
  if (pathname === "/mehr" || pathname === "/ueber") return "mehr";
  return null;
}

/** Zuletzt besuchte Seite je Bereich (Pfad + Suche), nur für diese Sitzung */
export type TabMemory = Partial<Record<TabKey, string>>;

export function remember(memory: TabMemory, pathname: string, search: string): TabMemory {
  const tab = tabForPath(pathname);
  if (!tab) return memory;
  const target = `${pathname}${search}`;
  return memory[tab] === target ? memory : { ...memory, [tab]: target };
}

/**
 * Ziel beim Antippen eines Tabs: im aktiven Bereich zurück zum Anfang (wie in nativen Apps),
 * sonst dorthin, wo man in diesem Bereich zuletzt war.
 */
export function tabTarget(tab: TabInfo, current: TabKey | null, memory: TabMemory): string {
  if (tab.key === current) return tab.root;
  return memory[tab.key] ?? tab.root;
}
