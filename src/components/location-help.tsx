import { BottomSheet } from "@/components/bottom-sheet";
import { LocationProbe } from "@/components/location-probe";

const STEPS: { title: string; steps: string[] }[] = [
  {
    title: "iPhone (Safari)",
    steps: [
      "Einstellungen → Datenschutz & Sicherheit → Ortungsdienste: einschalten.",
      "Dort unten „Safari-Websites“ → „Beim Verwenden der App“, „Genauer Standort“ an.",
      "In Safari auf dieser Seite links in der Adressleiste „aA“ (bzw. das Seiten-Symbol) → Website-Einstellungen → Standort → „Fragen“ oder „Erlauben“.",
    ],
  },
  {
    title: "Android (Chrome)",
    steps: [
      "Schloss-Symbol links in der Adressleiste → Berechtigungen → Standort → Zulassen.",
      "Falls nichts passiert: Einstellungen → Standort einschalten.",
    ],
  },
  {
    title: "Computer",
    steps: ["Symbol links in der Adressleiste → Standort → Zulassen, dann Seite neu laden."],
  },
];

/** Link „So gibst du ihn frei“ mit Anleitung im Panel, wenn der Browser den Standort blockiert */
export function LocationHelp() {
  return (
    <BottomSheet
      title="Standort freigeben"
      description="Der Browser fragt nicht mehr nach, wenn der Standort einmal blockiert ist."
      triggerClassName="font-medium text-foreground underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      trigger="So gibst du ihn frei"
    >
      <div className="space-y-4 text-sm">
        <LocationProbe />
        {STEPS.map((group) => (
          <section key={group.title} className="space-y-1.5">
            <h3 className="font-semibold">{group.title}</h3>
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
              {group.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>
        ))}
        <p className="text-muted-foreground">
          Danach in der App erneut auf das Standort-Symbol bzw. „Mein Standort“ tippen.
        </p>
      </div>
    </BottomSheet>
  );
}
