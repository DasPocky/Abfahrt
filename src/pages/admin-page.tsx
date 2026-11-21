// Verwaltung (nur für die EndLab-Verwaltung): Nutzung, Hinweis-Banner, Tagesgrenze der
// Sprachsuche und Geräteprofile. Die Seite liegt hinter Cloudflare Access; die Schnittstelle prüft
// den Ausweis und die Rolle bei EndLab Login selbst (worker/admin.ts).
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle, LogOut, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePageTitle } from "@/hooks/use-page-title";
import { API_PREFIX } from "../../shared/base-path";

interface Stand {
  push: { abos: number; aktiv7: number; fehlerhaft: number };
  sprache: {
    heuteSekunden: number;
    heuteAnfragen: number;
    wocheSekunden: number;
    wocheAnfragen: number;
    grenzeMinuten: number;
    grenzeStandard: number;
  };
  profile: { anzahl: number; geraete: number; aktiv7: number; offeneCodes: number };
  banner: string;
}

interface Profil {
  id: string;
  created_at: number;
  seen_at: number;
  bytes: number;
  geraete: number;
  codes: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
const zahlen = (value: unknown, keys: string[]) =>
  isRecord(value) && keys.every((k) => typeof value[k] === "number");

function isStand(value: unknown): value is Stand {
  return (
    isRecord(value) &&
    zahlen(value.push, ["abos", "aktiv7", "fehlerhaft"]) &&
    zahlen(value.sprache, [
      "heuteSekunden",
      "heuteAnfragen",
      "wocheSekunden",
      "wocheAnfragen",
      "grenzeMinuten",
      "grenzeStandard",
    ]) &&
    zahlen(value.profile, ["anzahl", "geraete", "aktiv7", "offeneCodes"]) &&
    typeof value.banner === "string"
  );
}
function isProfil(value: unknown): value is Profil {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    zahlen(value, ["created_at", "seen_at", "bytes", "geraete", "codes"])
  );
}

/** Anfrage an die Verwaltungs-Schnittstelle; wirft bei fehlendem Zugang */
async function admin(route: string, method = "GET", body?: unknown): Promise<unknown> {
  const res = await fetch(`${API_PREFIX}verwaltung/${route}`, {
    method,
    headers:
      body === undefined ? { Accept: "application/json" } : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    // Abgelaufene Access-Sitzung leitet um: dann nicht folgen, sondern neu anmelden lassen
    redirect: "manual",
  });
  if (res.type === "opaqueredirect" || res.status === 401) throw new Error("anmelden");
  if (res.status === 403) throw new Error("kein_zugang");
  if (!res.ok) throw new Error("fehler");
  return res.json();
}

const minuten = (sekunden: number) => `${Math.round(sekunden / 6) / 10} min`;
const datum = (ms: number) =>
  new Date(ms).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });

function Zahl({ wert, text }: { wert: string | number; text: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-2xl font-semibold tabular-nums">{wert}</p>
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

export function AdminPage() {
  usePageTitle("Verwaltung");
  const [meldung, setMeldung] = useState<string | null>(null);
  // Entwürfe: null = noch nicht bearbeitet, dann gilt der gespeicherte Wert
  const [bannerEntwurf, setBanner] = useState<string | null>(null);
  const [grenzeEntwurf, setGrenze] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["verwaltung"],
    queryFn: async () => {
      const s = await admin("stand");
      const p = await admin("profile");
      const liste = isRecord(p) && Array.isArray(p.profile) ? p.profile.filter(isProfil) : null;
      if (!isStand(s) || !liste) throw new Error("fehler");
      return { stand: s, profile: liste };
    },
    retry: false,
  });
  const fehler = query.error instanceof Error ? query.error.message : null;
  if (fehler === "anmelden") location.reload();
  const stand = query.data?.stand ?? null;
  const profile = query.data?.profile ?? [];
  const banner = bannerEntwurf ?? stand?.banner ?? "";
  const grenze = grenzeEntwurf ?? String(stand?.sprache.grenzeMinuten ?? "");
  const laden = () => {
    setBanner(null);
    setGrenze(null);
    return query.refetch();
  };

  const tun = async (route: string, method: string, body: unknown, erfolg: string) => {
    setMeldung(null);
    try {
      await admin(route, method, body);
      setMeldung(erfolg);
      await laden();
    } catch {
      setMeldung("Das hat nicht geklappt.");
    }
  };

  if (fehler === "kein_zugang") {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Verwaltung</h1>
        <p>
          Kein Zugang. In der Verwaltung von EndLab Login braucht dein Konto bei „Abfahrt“ die Rolle
          „verwaltung“.
        </p>
      </section>
    );
  }
  if (!stand) {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Verwaltung</h1>
        {fehler ? (
          <p role="alert" className="text-destructive">
            Gerade nicht erreichbar.
          </p>
        ) : (
          <p role="status" className="flex items-center gap-2 text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Wird geladen …
          </p>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Verwaltung</h1>
        <Button variant="ghost" size="icon" aria-label="Neu laden" onClick={() => void laden()}>
          <RefreshCw aria-hidden="true" />
        </Button>
      </div>

      {meldung && (
        <p role="status" className="text-sm text-muted-foreground">
          {meldung}
        </p>
      )}

      <section aria-labelledby="admin-nutzung" className="space-y-3">
        <h2 id="admin-nutzung" className="text-lg font-semibold tracking-tight">
          Nutzung und Push
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Zahl wert={stand.push.abos} text="Push-Abos" />
          <Zahl wert={stand.push.aktiv7} text="davon zugestellt in 7 Tagen" />
          <Zahl wert={stand.push.fehlerhaft} text="mit Zustellfehlern" />
          <Zahl wert={stand.profile.anzahl} text="Geräteprofile" />
          <Zahl wert={stand.profile.geraete} text="Geräte in Profilen" />
          <Zahl wert={stand.profile.aktiv7} text="Profile aktiv in 7 Tagen" />
        </div>
      </section>

      <section aria-labelledby="admin-banner" className="space-y-2">
        <h2 id="admin-banner" className="text-lg font-semibold tracking-tight">
          Hinweis-Banner
        </h2>
        <p className="text-sm text-muted-foreground">
          Erscheint für alle oben auf der Startseite, z. B. bei Bauarbeiten. Leer: kein Banner.
        </p>
        <textarea
          aria-label="Text des Hinweises"
          maxLength={200}
          rows={3}
          value={banner}
          onChange={(e) => setBanner(e.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <Button
            onClick={() => void tun("banner", "PUT", { text: banner }, "Hinweis gespeichert.")}
          >
            Speichern
          </Button>
          <Button
            variant="outline"
            onClick={() => void tun("banner", "PUT", { text: "" }, "Hinweis entfernt.")}
          >
            Entfernen
          </Button>
        </div>
      </section>

      <section aria-labelledby="admin-sprache" className="space-y-2">
        <h2 id="admin-sprache" className="text-lg font-semibold tracking-tight">
          Sprachsuche
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Zahl
            wert={minuten(stand.sprache.heuteSekunden)}
            text={`heute, ${stand.sprache.heuteAnfragen} Aufnahmen`}
          />
          <Zahl
            wert={minuten(stand.sprache.wocheSekunden)}
            text={`7 Tage, ${stand.sprache.wocheAnfragen} Aufnahmen`}
          />
        </div>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void tun("sprache", "PUT", { minutes: Number(grenze) }, "Tagesgrenze gespeichert.");
          }}
        >
          <label className="flex-1 space-y-1 text-sm">
            <span>Tagesgrenze (Audio-Minuten)</span>
            <Input inputMode="numeric" value={grenze} onChange={(e) => setGrenze(e.target.value)} />
          </label>
          <Button type="submit">Speichern</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              void tun("sprache", "PUT", { minutes: null }, "Standard wiederhergestellt.")
            }
          >
            Standard ({stand.sprache.grenzeStandard})
          </Button>
        </form>
      </section>

      <section aria-labelledby="admin-profile" className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 id="admin-profile" className="text-lg font-semibold tracking-tight">
            Geräteprofile
          </h2>
          {stand.profile.offeneCodes > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void tun("codes/zurueckziehen", "POST", {}, "Alle offenen Codes zurückgezogen.")
              }
            >
              {stand.profile.offeneCodes === 1
                ? "Offenen Code zurückziehen"
                : `Alle ${stand.profile.offeneCodes} Codes zurückziehen`}
            </Button>
          )}
        </div>
        {profile.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Geräteprofile.</p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border">
            {profile.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block font-mono">{p.id.slice(0, 8)}…</span>
                  <span className="block text-xs text-muted-foreground">
                    zuletzt {datum(p.seen_at)} · {p.geraete} {p.geraete === 1 ? "Gerät" : "Geräte"}{" "}
                    · {Math.ceil(p.bytes / 1024)} KB
                    {p.codes > 0 ? ` · ${p.codes} offener Code` : ""}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  aria-label={`Profil ${p.id.slice(0, 8)} löschen`}
                  onClick={() => {
                    if (
                      confirm(
                        "Profil löschen? Die Geräte gleichen danach nicht mehr ab; ihre Daten bleiben dort.",
                      )
                    ) {
                      void tun("profile/loeschen", "POST", { id: p.id }, "Profil gelöscht.");
                    }
                  }}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2 border-t pt-6">
        <p className="text-sm text-muted-foreground">
          Angemeldet über{" "}
          <a className="underline" href="https://login.endlab.de/">
            EndLab Login
          </a>
          . Abmelden gilt für alle EndLab-Apps.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            // Überall abmelden: EndLab Login beendet die eigene Sitzung und die bei Cloudflare Access
            location.href = "https://login.endlab.de/abmelden";
          }}
        >
          <LogOut aria-hidden="true" />
          Abmelden
        </Button>
      </section>
    </div>
  );
}
