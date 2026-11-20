import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/use-page-title";
import { claimTransfer, ProfileError } from "@/lib/profile";

/** Link vom anderen Gerät: Code einlösen und Favoriten und Einstellungen übernehmen */
export function ClaimPage() {
  usePageTitle("Übertragen");
  const { code = "" } = useParams();
  const [state, setState] = useState<"busy" | "done" | "invalid" | "error">("busy");
  const started = useRef(false);

  useEffect(() => {
    // nur einmal einlösen, auch wenn React im Entwicklungsmodus doppelt aufruft
    if (started.current) return;
    started.current = true;
    claimTransfer(code)
      .then(() => setState("done"))
      .catch((err: unknown) =>
        setState(err instanceof ProfileError && err.status === 404 ? "invalid" : "error"),
      );
  }, [code]);

  return (
    <section aria-labelledby="claim-title" className="space-y-4">
      <h1 id="claim-title" className="text-2xl font-semibold tracking-tight">
        Übertragen
      </h1>
      {state === "busy" && (
        <p role="status" className="flex items-center gap-2 text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Favoriten und Einstellungen werden übernommen …
        </p>
      )}
      {state === "done" && (
        <p role="status">Übernommen. Favoriten und Einstellungen gleichen sich ab jetzt ab.</p>
      )}
      {state === "invalid" && (
        <p role="alert" className="text-destructive">
          Code unbekannt oder abgelaufen. Auf dem anderen Gerät unter Mehr → Einstellungen einen
          neuen anzeigen lassen.
        </p>
      )}
      {state === "error" && (
        <p role="alert" className="text-destructive">
          Gerade nicht möglich. Bitte später erneut.
        </p>
      )}
      <Button asChild>
        <Link to="/">Zu den Abfahrten</Link>
      </Button>
    </section>
  );
}
