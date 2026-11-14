import type { ReactNode } from "react";

const REPO_URL = "https://github.com/DasPocky/Abfahrt";

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium underline underline-offset-2 hover:text-muted-foreground"
    >
      {children}
    </a>
  );
}

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

/** Über die App: Zweck, Pflicht-Quellhinweise (docs/01-datenquellen.md), Quellcode, Datenschutz */
export function AboutPage() {
  return (
    <article className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Über Abfahrt</h1>
        <p className="text-sm text-muted-foreground">
          Echtzeit-Abfahrten für Bus und Bahn – mit Fokus auf Düsseldorf und das Rheinland.
        </p>
      </header>

      <Section id="about-purpose" title="Wozu?">
        <p>
          Abfahrt zeigt die nächsten Abfahrten an einer Haltestelle mit Live-Daten: Verspätungen,
          Gleiswechsel und Hinweise. Lieblingshaltestellen lassen sich samt Filter als Favoriten
          speichern.
        </p>
        <p>
          Abfahrt ist eine <strong>private Hobby-App</strong> ohne kommerzielle Absichten und kein
          offizielles Angebot eines Verkehrsunternehmens oder -verbunds.
        </p>
      </Section>

      <Section id="about-sources" title="Datenquellen">
        <p>
          Fahrplanauskünfte werden durch den Lizenzgeber zur Verfügung gestellt. Alle Angaben ohne
          Gewähr.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Verkehrsverbund Rhein-Ruhr (<ExternalLink href="https://www.vrr.de">VRR</ExternalLink>
            ): Abfahrten und Haltestellen im VRR-Gebiet über den VRR OpenService.
          </li>
          <li>
            <ExternalLink href="https://transitous.org/sources/">Transitous</ExternalLink>:
            Abfahrten in ganz Deutschland und Linienfarben, auf Basis offener Fahrplandaten vieler
            Datenlieferanten.
          </li>
          <li>
            Karte: Daten ©{" "}
            <ExternalLink href="https://www.openstreetmap.org/copyright">
              OpenStreetMap-Mitwirkende
            </ExternalLink>
            , Kartenkacheln von{" "}
            <ExternalLink href="https://openfreemap.org">OpenFreeMap</ExternalLink>.
          </li>
        </ul>
      </Section>

      <Section id="about-privacy" title="Datenschutz">
        <ul className="list-disc space-y-1 pl-5">
          <li>Keine Accounts, kein Tracking, keine Cookies.</li>
          <li>Favoriten werden nur lokal in deinem Browser gespeichert.</li>
          <li>
            Dein Standort wird nur auf deinen Wunsch abgefragt. Die Suche sortiert damit nur auf
            deinem Gerät. Für „In der Nähe“ geht er auf etwa 100 m gerundet an unseren Server, wird
            dort nicht gespeichert oder protokolliert und erreicht die Datenquelle nur gerundet.
          </li>
          <li>
            Suchbegriffe und Haltestellen gehen über unseren Server bei Cloudflare an die genannten
            Datenquellen, ohne Bezug zu deiner Person.
          </li>
          <li>
            Karte: Für die Haltestellen geht nur der sichtbare Kartenausschnitt an unseren Server,
            nicht dein Standort. Die Kartenkacheln lädt dein Browser direkt von OpenFreeMap, dabei
            sieht OpenFreeMap deine IP-Adresse.
          </li>
        </ul>
      </Section>

      <Section id="about-code" title="Quellcode">
        <p>
          Abfahrt ist Open Source unter der Lizenz AGPL-3.0. Den Quellcode gibt es auf{" "}
          <ExternalLink href={REPO_URL}>GitHub</ExternalLink>.
        </p>
      </Section>
    </article>
  );
}
