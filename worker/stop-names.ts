// Aufbereitung von Haltestellen- und Zielnamen aus den Quellen

/**
 * Entfernt das Städtekürzel aus DELFI-Namen („D-Heinrich-Heine-Allee U“ → „Heinrich-Heine-Allee U“,
 * „DU-Meiderich Süd Bf“ → „Meiderich Süd Bf“). „S-Bahnhof …“ und ähnliche bleiben unverändert.
 */
export function stripCityPrefix(name: string): string {
  return name.replace(/^[A-ZÄÖÜ]{1,3}-(?!Bahn)(?=[A-ZÄÖÜ0-9])/u, "");
}
