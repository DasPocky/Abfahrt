// „Mehr“ (#106): Benachrichtigungen, Installieren und Infos zur App.
import { Link } from "react-router";
import { ChevronRight, Download, Info, Scale, Settings, ShieldCheck } from "lucide-react";
import { PushSettings } from "@/components/push-settings";

export function MorePage() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Mehr</h1>

      <section aria-labelledby="more-push" className="space-y-2">
        <h2 id="more-push" className="text-lg font-semibold tracking-tight">
          Benachrichtigungen
        </h2>
        <div className="space-y-2 text-sm leading-relaxed">
          <PushSettings />
        </div>
      </section>

      <section aria-labelledby="more-install" className="space-y-2">
        <h2
          id="more-install"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <Download className="size-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          Als App installieren
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
          <li>
            <strong>iPhone (Safari):</strong> Teilen → „Zum Home-Bildschirm“. Nur so gibt es
            Benachrichtigungen.
          </li>
          <li>
            <strong>Android (Chrome):</strong> Menü → „App installieren“.
          </li>
        </ul>
      </section>

      <nav aria-label="Infos" className="divide-y overflow-hidden rounded-xl border">
        <Link
          to="/einstellungen"
          className="flex items-center gap-3 px-4 py-3 text-sm font-medium outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
        >
          <Settings className="size-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <span className="flex-1">Einstellungen</span>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
        </Link>
        <Link
          to="/ueber"
          className="flex items-center gap-3 px-4 py-3 text-sm font-medium outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
        >
          <Info className="size-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <span className="flex-1">Über Abfahrt · Datenquellen</span>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
        </Link>
        <Link
          to="/datenschutz"
          className="flex items-center gap-3 px-4 py-3 text-sm font-medium outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
        >
          <ShieldCheck className="size-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <span className="flex-1">Datenschutz</span>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
        </Link>
        <Link
          to="/impressum"
          className="flex items-center gap-3 px-4 py-3 text-sm font-medium outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
        >
          <Scale className="size-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <span className="flex-1">Impressum</span>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
        </Link>
      </nav>
    </div>
  );
}
