// Orte ohne Haltestellen-ID (Adressen, POIs) als „geo:<lat>,<lon>“, 5 Nachkommastellen (~1 m)

const GEO_ID = /^geo:(-?\d{1,2}\.\d{1,6}),(-?\d{1,3}\.\d{1,6})$/;

export function toGeoId(lat: number, lon: number): string {
  return `geo:${lat.toFixed(5)},${lon.toFixed(5)}`;
}

/** Koordinaten einer geo-ID, null bei ungültigem Format oder außerhalb Deutschlands (grob) */
export function parseGeoId(id: string): { lat: number; lon: number } | null {
  const match = GEO_ID.exec(id);
  if (!match) return null;
  const lat = Number(match[1]);
  const lon = Number(match[2]);
  return lat >= 47 && lat <= 55.5 && lon >= 5.5 && lon <= 15.5 ? { lat, lon } : null;
}
