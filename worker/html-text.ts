// HTML aus Quellen (z. B. VRR-Störungstexte) in schlichten Text umwandeln. Keine Darstellung von
// HTML in der App: Text kommt als reiner String an und React escaped ihn.

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  auml: "ä",
  ouml: "ö",
  uuml: "ü",
  Auml: "Ä",
  Ouml: "Ö",
  Uuml: "Ü",
  szlig: "ß",
  bdquo: "„",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  sbquo: "‚",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  euro: "€",
  eacute: "é",
  egrave: "è",
  shy: "",
};

export function decodeEntities(text: string): string {
  return text.replaceAll(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code.startsWith("#x") || code.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    }
    if (code.startsWith("#")) return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    return NAMED[code] ?? match;
  });
}

/** Tags entfernen (Absätze/Zeilenumbrüche bleiben als „\n“), Entities auflösen, Leerraum glätten */
export function htmlToText(html: string): string {
  const text = html
    .replaceAll(/<\s*br\s*\/?>/gi, "\n")
    .replaceAll(/<\/\s*(p|div|li|h\d)\s*>/gi, "\n")
    .replaceAll(/<[^>]*>/g, "");
  return decodeEntities(text)
    .split("\n")
    .map((line) => line.replaceAll(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}
