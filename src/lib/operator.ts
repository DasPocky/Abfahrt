// Angaben zum Betreiber für Impressum und Datenschutzerklärung (#130).
// Pflicht nach § 18 MStV (Name, Anschrift) bzw. Art. 13 DSGVO (Verantwortlicher, Kontakt).
// Erst eintragen, dann veröffentlichen: Fehlt etwas, zeigen die Seiten einen deutlichen Hinweis.

export interface Operator {
  name: string;
  street: string;
  /** PLZ und Ort */
  city: string;
  email: string;
}

export const OPERATOR: Operator | null = null;

/** Stand der Datenschutzerklärung (bei jeder inhaltlichen Änderung anpassen) */
export const PRIVACY_UPDATED = "18.11.2026";
