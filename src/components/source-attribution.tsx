import type { DataSource } from "../../shared/api-types";

/** Pflicht-Quellhinweise unter Ergebnislisten (siehe docs/01-datenquellen.md) */
export function SourceAttribution({ source }: { source: DataSource }) {
  return (
    <footer className="space-y-1 text-xs text-muted-foreground">
      <p>
        Fahrplanauskünfte werden durch den Lizenzgeber zur Verfügung gestellt. Alle Angaben ohne
        Gewähr.
      </p>
      {source === "vrr" ? (
        <p>Daten: VRR</p>
      ) : (
        <p>
          Daten:{" "}
          <a
            href="https://transitous.org/sources/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Transitous und Datenquellen
          </a>
        </p>
      )}
    </footer>
  );
}
