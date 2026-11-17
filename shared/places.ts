// Städte vergleichen (#94), gemeinsam für Worker und App

/** Vergleichbarer Stadtname: „Mülheim a.d. Ruhr“ und „Mülheim“, „Oberhausen (Rheinl)“ gleich */
function cityKey(city: string): string {
  return (city.split(/[\s,(/-]/u)[0] ?? "").toLocaleLowerCase("de");
}

export function sameCity(a: string | null | undefined, b: string | null | undefined): boolean {
  return Boolean(a && b && cityKey(a) === cityKey(b));
}
