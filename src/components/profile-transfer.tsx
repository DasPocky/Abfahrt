import { useState } from "react";
import { Copy, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrCode } from "@/components/qr-code";
import {
  claimLink,
  claimTransfer,
  formatCode,
  getProfile,
  leaveProfile,
  ProfileError,
  startTransfer,
} from "@/lib/profile";

const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

/** Einstellungen: Favoriten und Einstellungen auf ein weiteres Gerät mitnehmen */
export function ProfileTransfer() {
  const [linked, setLinked] = useState(() => getProfile() !== null);
  const [transfer, setTransfer] = useState<{ code: string; expiresAt: number } | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const show = async () => {
    setBusy(true);
    setMessage(null);
    try {
      setTransfer(await startTransfer());
      setLinked(true);
    } catch {
      setMessage({ text: "Gerade nicht möglich. Bitte später erneut.", error: true });
    } finally {
      setBusy(false);
    }
  };

  const claim = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await claimTransfer(input);
      setLinked(true);
      setInput("");
      setMessage({ text: "Übernommen. Favoriten und Einstellungen gleichen sich ab jetzt ab." });
    } catch (err) {
      setMessage({
        text:
          err instanceof ProfileError && err.status === 404
            ? "Code unbekannt oder abgelaufen."
            : "Gerade nicht möglich. Bitte später erneut.",
        error: true,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="settings-profile" className="space-y-3">
      <h2
        id="settings-profile"
        className="flex items-center gap-2 text-lg font-semibold tracking-tight"
      >
        <Smartphone className="size-5" aria-hidden="true" />
        Auf anderes Gerät übertragen
      </h2>
      <p className="text-sm text-muted-foreground">
        Nimmt Favoriten und Einstellungen auf ein weiteres Handy oder einen Rechner mit. Danach
        gleichen sich beide Geräte ab. Ohne diesen Schritt bleibt alles nur auf diesem Gerät.
      </p>

      {transfer ? (
        <div className="space-y-2 rounded-xl border p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Mit dem anderen Gerät scannen, den Code dort eingeben oder den Link öffnen:
          </p>
          <QrCode
            value={claimLink(transfer.code)}
            label="QR-Code zum Übertragen"
            className="mx-auto w-44 rounded-lg"
          />
          <p
            className="font-mono text-2xl font-semibold tracking-[0.2em]"
            data-testid="transfer-code"
          >
            {formatCode(transfer.code)}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void navigator.clipboard?.writeText(claimLink(transfer.code));
              setMessage({ text: "Link kopiert." });
            }}
          >
            <Copy aria-hidden="true" />
            Link kopieren
          </Button>
          <p className="text-xs text-muted-foreground">
            Gilt einmal, bis {clock(transfer.expiresAt)} Uhr.
          </p>
        </div>
      ) : (
        <Button variant="outline" disabled={busy} onClick={() => void show()}>
          Code zum Übertragen anzeigen
        </Button>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void claim();
        }}
      >
        <Input
          aria-label="Code von einem anderen Gerät"
          placeholder="Code vom anderen Gerät"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={12}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button type="submit" disabled={busy || input.replace(/\W/g, "").length < 8}>
          Übernehmen
        </Button>
      </form>

      {message && (
        <p
          role="status"
          className={message.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
        >
          {message.text}
        </p>
      )}

      {linked && (
        <p className="text-sm text-muted-foreground">
          Dieses Gerät gleicht ab.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => {
              leaveProfile();
              setLinked(false);
              setTransfer(null);
              setMessage({ text: "Abgleich beendet. Die Daten bleiben auf diesem Gerät." });
            }}
          >
            Abgleich beenden
          </button>
        </p>
      )}
    </section>
  );
}
