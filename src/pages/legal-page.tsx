// Impressum und Datenschutzerklärung (#130). Entwurf, vor dem Veröffentlichen rechtlich prüfen.
import type { ReactNode } from "react";
import { Link } from "react-router";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OPERATOR, PRIVACY_UPDATED, type Operator } from "@/lib/operator";

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

function BackToMore() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 h-7 text-muted-foreground">
      <Link to="/mehr" aria-label="Zurück zu Mehr">
        <ArrowLeft aria-hidden="true" />
        Mehr
      </Link>
    </Button>
  );
}

function MissingOperator() {
  return (
    <p
      role="alert"
      className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
      Die Angaben zum Betreiber fehlen noch (src/lib/operator.ts).
    </p>
  );
}

function Address({ operator }: { operator: Operator }) {
  return (
    <address className="not-italic">
      {operator.name}
      <br />
      {operator.street}
      <br />
      {operator.city}
      <br />
      E-Mail:{" "}
      <a className="font-medium underline underline-offset-2" href={`mailto:${operator.email}`}>
        {operator.email}
      </a>
    </address>
  );
}

export function ImprintPage() {
  return (
    <article className="space-y-8">
      <BackToMore />
      <h1 className="text-2xl font-semibold tracking-tight">Impressum</h1>

      <Section id="imprint-provider" title="Anbieter">
        <p>Angaben gemäß § 18 Abs. 1 Medienstaatsvertrag (MStV):</p>
        {OPERATOR ? <Address operator={OPERATOR} /> : <MissingOperator />}
      </Section>

      <Section id="imprint-about" title="Über dieses Angebot">
        <p>
          Abfahrt ist eine private, nicht-kommerzielle Hobby-App ohne Werbung. Sie ist kein Angebot
          eines Verkehrsunternehmens oder -verbunds.
        </p>
      </Section>

      <Section id="imprint-liability" title="Haftung für Inhalte und Links">
        <p>
          Fahrplan- und Echtzeitdaten stammen von den auf der Seite{" "}
          <Link to="/ueber" className="font-medium underline underline-offset-2">
            Über Abfahrt
          </Link>{" "}
          genannten Datenquellen. Alle Angaben ohne Gewähr; maßgeblich sind die Auskünfte und
          Aushänge der Verkehrsunternehmen.
        </p>
        <p>
          Für Inhalte verlinkter fremder Websites sind deren Anbieter verantwortlich. Bei Hinweisen
          auf rechtswidrige Inhalte entfernen wir die betroffenen Links umgehend.
        </p>
      </Section>

      <Section id="imprint-license" title="Quellcode und Lizenz">
        <p>
          Der Quellcode ist Open Source unter der Lizenz AGPL-3.0 und auf{" "}
          <ExternalLink href={REPO_URL}>GitHub</ExternalLink> verfügbar.
        </p>
      </Section>

      <p className="text-sm">
        <Link to="/datenschutz" className="font-medium underline underline-offset-2">
          Datenschutzerklärung
        </Link>
      </p>
    </article>
  );
}

export function PrivacyPage() {
  return (
    <article className="space-y-8">
      <BackToMore />
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Datenschutzerklärung</h1>
        <p className="text-sm text-muted-foreground">Stand: {PRIVACY_UPDATED}</p>
      </header>

      <Section id="privacy-summary" title="Kurz gesagt">
        <ul className="list-disc space-y-1 pl-5">
          <li>Keine Konten, kein Tracking, keine Werbung, keine Cookies.</li>
          <li>Vorlesen läuft komplett auf deinem Gerät; Spracheingabe nur mit Einwilligung.</li>
          <li>Favoriten, Verlauf und Einstellungen bleiben in deinem Browser.</li>
          <li>
            Was an unseren Server geht (Suchbegriffe, Haltestellen, Kartenausschnitt), wird nicht
            mit dir verknüpft und nicht protokolliert.
          </li>
          <li>Deinen Standort nutzen wir nur mit deiner Erlaubnis und nur gerundet.</li>
        </ul>
      </Section>

      <Section id="privacy-controller" title="1. Verantwortlicher">
        <p>Verantwortlich im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:</p>
        {OPERATOR ? <Address operator={OPERATOR} /> : <MissingOperator />}
        <p>Einen Datenschutzbeauftragten gibt es nicht; er ist für dieses Angebot nicht nötig.</p>
      </Section>

      <Section id="privacy-hosting" title="2. Aufruf der App und Hosting">
        <p>
          App und Server laufen bei Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, USA
          (Cloudflare Workers). Beim Aufruf verarbeitet Cloudflare technisch notwendige Daten wie
          deine IP-Adresse, Datum und Uhrzeit, die aufgerufene Adresse und Angaben zum Browser, um
          die Inhalte auszuliefern und Angriffe abzuwehren.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Zweck und Rechtsgrundlage:</strong> sichere und stabile Bereitstellung der App,
            berechtigtes Interesse nach Art. 6 Abs. 1 lit. f DSGVO.
          </li>
          <li>
            <strong>Protokolle:</strong> Wir speichern keine Protokolle der einzelnen Anfragen. Nur
            technische Fehlermeldungen (ohne Suchbegriffe, Standort oder IP-Adresse) werden für
            wenige Tage aufbewahrt.
          </li>
          <li>
            <strong>Schutz vor Missbrauch:</strong> Um Massenabrufe zu verhindern, zählt der Server
            Anfragen je IP-Adresse höchstens eine Minute lang im Arbeitsspeicher; gespeichert wird
            sie nicht.
          </li>
          <li>
            <strong>Auftragsverarbeitung und Drittland:</strong> Cloudflare verarbeitet die Daten in
            unserem Auftrag (Art. 28 DSGVO). Für die Übermittlung in die USA ist Cloudflare unter
            dem EU-US Data Privacy Framework zertifiziert (Angemessenheitsbeschluss, Art. 45 DSGVO).
          </li>
          <li>
            Schriftarten und alle Programmteile der App kommen von unserem Server, nicht von
            Drittanbietern.
          </li>
        </ul>
      </Section>

      <Section id="privacy-sources" title="3. Fahrplan- und Echtzeitdaten">
        <p>
          Suchbegriffe, gewählte Haltestellen, Verbindungswünsche und der sichtbare Kartenausschnitt
          gehen an unseren Server. Er fragt damit die Datenquellen ab: den Verkehrsverbund
          Rhein-Ruhr (VRR), die Nahverkehrsgesellschaft Baden-Württemberg (NVBW) und Transitous. Die
          Datenquellen erhalten dabei nur die Anfrage selbst, nicht deine IP-Adresse oder andere
          Angaben zu dir. Antworten werden kurzzeitig zwischengespeichert (Sekunden bis Tage), ohne
          Bezug zu dir.
        </p>
        <p>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (die von dir gewünschte Auskunft).</p>
      </Section>

      <Section id="privacy-location" title="4. Standort">
        <p>
          Die App fragt deinen Standort über deinen Browser ab; der Browser bittet dich vorher um
          Erlaubnis (Einwilligung, Art. 6 Abs. 1 lit. a DSGVO). Mit dem Standort-Symbol in der Suche
          schaltest du das dauerhaft aus, in den Browser-Einstellungen widerrufst du die Erlaubnis.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Für die Sortierung der Suchtreffer bleibt der Standort auf deinem Gerät.</li>
          <li>
            Für „In der Nähe“ geht er auf etwa 100 Meter gerundet an unseren Server und gerundet an
            die Datenquelle. Gespeichert oder protokolliert wird er nicht.
          </li>
          <li>Auf der Karte geht nur der sichtbare Ausschnitt an unseren Server.</li>
        </ul>
      </Section>

      <Section id="privacy-map" title="5. Karte (OpenFreeMap)">
        <p>
          Die Kartenbilder (Kacheln, Schriften, Symbole) lädt dein Browser direkt von OpenFreeMap (
          <ExternalLink href="https://openfreemap.org">openfreemap.org</ExternalLink>). Dabei erhält
          OpenFreeMap deine IP-Adresse und den angezeigten Kartenausschnitt. Das geschieht nur, wenn
          du eine Karte öffnest. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (Darstellung einer
          Karte ohne eigenen Kartenserver).
        </p>
      </Section>

      <Section id="privacy-local" title="6. Speicherung auf deinem Gerät">
        <p>
          Die App speichert im lokalen Speicher deines Browsers (keine Cookies): Favoriten, zuletzt
          gesuchte Orte, Einstellungen, die gemerkte Verbindung, deine Wahl zu Standort und
          Live-Fahrzeugen sowie den Zustand der Benachrichtigungen. Diese Daten verlassen dein Gerät
          nicht (Ausnahme: Benachrichtigungen, siehe 7). Das ist für die von dir gewünschten
          Funktionen unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG). Du löschst sie in der App (z.
          B. Favoriten, Suchverlauf) oder über die Website-Daten deines Browsers.
        </p>
      </Section>

      <Section id="privacy-push" title="7. Benachrichtigungen">
        <p>
          Nur wenn du Benachrichtigungen einschaltest (Einwilligung, Art. 6 Abs. 1 lit. a DSGVO),
          speichern wir in einer Datenbank bei Cloudflare: die Adresse beim Push-Dienst deines
          Browsers (Apple, Google, Mozilla oder Microsoft) mit den zugehörigen Schlüsseln, wofür du
          Nachrichten möchtest (Favoriten-Haltestellen mit Linien, gemerkte Verbindung) und den
          Stand der zuletzt gemeldeten Störungen. Name, E-Mail oder Telefonnummer brauchen wir
          nicht.
        </p>
        <p>
          Die Nachrichten laufen über den Push-Dienst deines Browsers. Ausschalten unter „Mehr“
          löscht den Eintrag sofort; meldet der Push-Dienst, dass es die Adresse nicht mehr gibt,
          löschen wir ihn ebenfalls.
        </p>
      </Section>

      <Section id="privacy-voice" title="8. Spracheingabe">
        <p>
          Nur wenn du das Mikrofon in der Suche nutzt und vorher einwilligst (Art. 6 Abs. 1 lit. a
          DSGVO): Die App nimmt höchstens 10 Sekunden auf und schickt die Aufnahme über unseren
          Server an die Spracherkennung von Cloudflare (Workers AI, Modell Whisper). Zurück kommt
          nur der erkannte Text, den die App auf deinem Gerät auswertet.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Wir speichern weder die Aufnahme noch den Text. Laut Cloudflare werden Ein- und Ausgaben
            nur für die Erkennung verarbeitet, danach nicht aufbewahrt und nicht zum Training
            genutzt. Die Verarbeitung kann in den USA oder anderen Ländern stattfinden (siehe 2.).
          </li>
          <li>
            Gezählt wird nur, wie viele Sekunden am Tag insgesamt erkannt wurden (für eine
            Obergrenze), ohne Bezug zu dir.
          </li>
          <li>
            Die Einwilligung widerrufst du unter „Mehr → Einstellungen → Spracheingabe“. Ohne
            Spracheingabe kannst du tippen oder das Diktier-Mikrofon deiner Tastatur nutzen.
          </li>
        </ul>
      </Section>

      <Section id="privacy-rights" title="9. Deine Rechte">
        <p>Du hast das Recht auf</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16) und Löschung (Art. 17),</li>
          <li>Einschränkung der Verarbeitung (Art. 18) und Datenübertragbarkeit (Art. 20),</li>
          <li>
            Widerspruch gegen Verarbeitungen aus berechtigtem Interesse (Art. 21) und Widerruf einer
            Einwilligung mit Wirkung für die Zukunft (Art. 7 Abs. 3),
          </li>
          <li>
            Beschwerde bei einer Datenschutz-Aufsichtsbehörde (Art. 77), z. B. der für deinen
            Wohnort.
          </li>
        </ul>
        <p>
          Da wir dich nicht kennen und keine Konten führen, können wir gespeicherte Daten meist
          keiner Person zuordnen. Melde dich gern unter der oben genannten Adresse.
        </p>
        <p>
          Es gibt keine automatisierten Entscheidungen oder Profilbildung. Du bist nicht
          verpflichtet, Daten bereitzustellen; ohne Standort oder Benachrichtigungen funktioniert
          die App weiterhin.
        </p>
      </Section>
    </article>
  );
}
