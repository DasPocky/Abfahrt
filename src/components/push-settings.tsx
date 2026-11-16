import { useEffect, useState } from "react";
import { Bell, BellOff, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { disablePush, enablePush, pushState, sendTestPush, type PushState } from "@/lib/push";

const STATE_TEXT: Record<PushState, string> = {
  unsupported: "Dieser Browser unterstützt keine Benachrichtigungen.",
  "ios-browser":
    "Am iPhone gibt es Benachrichtigungen nur in der installierten App: in Safari auf „Teilen“ → „Zum Home-Bildschirm“, dann Abfahrt vom Homescreen öffnen.",
  denied:
    "Benachrichtigungen sind blockiert. In den Einstellungen des Browsers bzw. am iPhone unter Einstellungen → Mitteilungen → Abfahrt erlauben.",
  off: "Benachrichtigungen sind aus.",
  on: "Benachrichtigungen sind an.",
};

/** Benachrichtigungen ein-/ausschalten und testen (Über-Seite) */
export function PushSettings() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void pushState().then((s) => {
      if (active) setState(s);
    });
    return () => {
      active = false;
    };
  }, []);

  async function run(
    action: () => Promise<PushState | boolean>,
    done: (r: PushState | boolean) => string | null,
  ) {
    setBusy(true);
    setMessage(null);
    try {
      const result = await action();
      if (typeof result === "string") setState(result);
      setMessage(done(result));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Das hat nicht geklappt.");
    } finally {
      setBusy(false);
    }
  }

  if (state === null) return null;
  return (
    <div className="space-y-2">
      <p className="text-muted-foreground">{STATE_TEXT[state]}</p>
      <div className="flex flex-wrap gap-2">
        {state === "off" && (
          <Button size="sm" disabled={busy} onClick={() => void run(enablePush, () => null)}>
            <Bell aria-hidden="true" />
            Benachrichtigungen einschalten
          </Button>
        )}
        {state === "on" && (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(sendTestPush, (ok) =>
                  ok ? "Testnachricht gesendet." : "Testnachricht ging nicht raus.",
                )
              }
            >
              <Send aria-hidden="true" />
              Testnachricht
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void run(disablePush, () => null)}
            >
              <BellOff aria-hidden="true" />
              Ausschalten
            </Button>
          </>
        )}
      </div>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </div>
  );
}
