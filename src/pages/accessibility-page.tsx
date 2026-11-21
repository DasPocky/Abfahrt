// Erklärung zur Barrierefreiheit (#128): freiwillig, angelehnt an das Muster nach BITV 2.0.
import type { ReactNode } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/page-header";

const ISSUES_URL = "https://github.com/DasPocky/Abfahrt/issues/new?template=fehler.yml";
const UPDATED = "18.11.2026";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-2">
      <h2 id={id} className="text-lg font-semibold tracking-tight">
        {title}
      </h2>
      <div className="space-y-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

export function AccessibilityPage() {
  usePageTitle("Barrierefreiheit");
  return (
    <article className="space-y-8">
      <PageHeader title="Barrierefreiheit" back={{ to: "/mehr", label: "Zurück zu Mehr" }}>
        <p className="text-sm text-muted-foreground">
          Erklärung zur Barrierefreiheit · Stand: {UPDATED}
        </p>
      </PageHeader>

      <Section id="a11y-goal" title="Ziel">
        <p>
          Abfahrt soll für alle nutzbar sein: mit Screenreader, nur mit Tastatur, mit Vergrößerung
          und bei Seh- oder motorischen Einschränkungen. Maßstab sind die Web Content Accessibility
          Guidelines (WCAG) 2.2 auf Stufe AA, die auch der BITV 2.0 und der EN 301 549 zugrunde
          liegen. Als private, nicht-kommerzielle App sind wir dazu nicht verpflichtet und tun es
          trotzdem.
        </p>
      </Section>

      <Section id="a11y-status" title="Stand">
        <p>
          Die App ist <strong>weitgehend</strong> mit WCAG 2.2 AA vereinbar. Bekannte
          Einschränkungen:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Karte:</strong> Das Kartenbild lässt sich mit Screenreader und Tastatur nur
            eingeschränkt nutzen. Alles Wichtige geht auch ohne Karte: Suche, „In der Nähe“,
            Abfahrten und Verbindungen als Listen.
          </li>
          <li>
            <strong>Texte der Verkehrsunternehmen:</strong> Hinweise und Störungsmeldungen kommen
            unverändert von den Datenquellen und enthalten teils Abkürzungen oder lange Sätze.
          </li>
          <li>
            <strong>Linienfarben</strong> stammen von den Verkehrsunternehmen; die Liniennummer
            steht immer als Text daneben, die Farbe ist nie die einzige Information.
          </li>
          <li>Ein Test mit echten Screenreadern (VoiceOver, TalkBack, NVDA) steht noch aus.</li>
        </ul>
      </Section>

      <Section id="a11y-help" title="Was hilft">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Jede Seite hat einen eigenen Titel; nach einem Wechsel springt der Fokus zur
            Überschrift.
          </li>
          <li>Alle Funktionen sind mit der Tastatur erreichbar, der Fokus ist sichtbar.</li>
          <li>Hell oder Dunkel nach Wunsch (Einstellungen), Kontraste mindestens 4,5 : 1.</li>
          <li>
            Große Schrift und schmale Bildschirme: Ziele brechen um, statt abgeschnitten zu werden.
          </li>
          <li>Weniger Bewegung, wenn dein Gerät das so eingestellt hat.</li>
        </ul>
      </Section>

      <Section id="a11y-method" title="Wie wir prüfen">
        <p>
          Selbstbewertung. Bei jeder Änderung prüft ein automatischer Test (axe-core) alle
          Hauptseiten. Dazu kommen Prüfungen im Browser hell und dunkel mit echten Daten, bei 320
          Pixeln Breite (entspricht 400 % Vergrößerung) und mit der Tastatur.
        </p>
      </Section>

      <Section id="a11y-feedback" title="Barriere gefunden?">
        <p>
          Sag uns Bescheid, wir kümmern uns darum: über{" "}
          <a
            href={ISSUES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline underline-offset-2"
          >
            GitHub (Fehler melden)
          </a>{" "}
          oder über die Kontaktadresse im Impressum. Beschreib kurz, auf welcher Seite und mit
          welchem Gerät oder Hilfsmittel es hakt.
        </p>
      </Section>
    </article>
  );
}
