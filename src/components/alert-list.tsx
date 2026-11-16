// Anzeige von Störungsmeldungen: Zeile mit Panel (Übersicht), Sammelzeile (Haltestelle).
import { ArrowUpDown, ChevronRight, Construction, ExternalLink, Info, Star } from "lucide-react";
import { cn } from "cn";
import { BottomSheet } from "@/components/bottom-sheet";
import { NOTICE_CLASS } from "@/components/departure-list";
import { LineBadge } from "@/components/line-badge";
import { ALERT_KIND_LABEL, formatValidity, titleAtStop } from "@/lib/alerts";
import type { Alert, AlertKind, AlertSeverity } from "../../shared/api-types";

const KIND_ICON: Record<AlertKind, typeof Info> = {
  blocking: Construction,
  facility: ArrowUpDown,
  info: Info,
};

const SEVERITY_CLASS: Record<AlertSeverity, string> = {
  high: "text-destructive",
  normal: "text-warning",
  low: "text-muted-foreground",
};

/** So viele Linien zeigt eine Zeile, der Rest steht als „+N“ dahinter */
export const ALERT_ROW_LINES = 5;

export function AlertIcon({ alert, className }: { alert: Alert; className?: string }) {
  const Icon = KIND_ICON[alert.kind];
  return (
    <Icon
      role="img"
      aria-label={ALERT_KIND_LABEL[alert.kind]}
      className={cn("size-4 shrink-0", SEVERITY_CLASS[alert.severity], className)}
    />
  );
}

function AlertLines({ alert, max }: { alert: Alert; max?: number }) {
  if (alert.lines.length === 0) return null;
  const shown = max === undefined ? alert.lines : alert.lines.slice(0, max);
  const rest = alert.lines.length - shown.length;
  return (
    <>
      {shown.map((l) => (
        <LineBadge
          key={`${l.mode}-${l.line}`}
          size="sm"
          departure={{ line: l.line, mode: l.mode, lineColor: null, lineTextColor: null }}
        />
      ))}
      {rest > 0 && (
        <span className="text-xs text-muted-foreground">
          +{rest}
          <span className="sr-only"> weitere Linien</span>
        </span>
      )}
    </>
  );
}

/** Voller Inhalt einer Meldung im Panel */
export function AlertDetails({ alert }: { alert: Alert }) {
  const stops = alert.stops.map((s) => s.name).filter(Boolean);
  return (
    <div className="space-y-3">
      {alert.lines.length > 0 && (
        <p className="flex flex-wrap items-center gap-1">
          <span className="sr-only">Linien: </span>
          <AlertLines alert={alert} />
        </p>
      )}
      {stops.length > 0 && (
        <p className="text-muted-foreground">
          {stops.length === 1 ? "Haltestelle" : "Haltestellen"}: {stops.join(", ")}
        </p>
      )}
      {alert.text && <p className="leading-relaxed whitespace-pre-line">{alert.text}</p>}
      {alert.url && (
        <a
          href={alert.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Mehr beim Verkehrsverbund
          <ExternalLink className="size-3.5" aria-hidden="true" />
          <span className="sr-only">(öffnet neues Fenster)</span>
        </a>
      )}
    </div>
  );
}

function sheetDescription(alert: Alert, now: Date): string {
  const validity = formatValidity(alert, now);
  return validity ? `${ALERT_KIND_LABEL[alert.kind]} · ${validity}` : ALERT_KIND_LABEL[alert.kind];
}

/** Kompakte Zeile der Übersicht: Symbol, Titel, Linien, Gültigkeit; antippen öffnet den Text */
export function AlertRow({
  alert,
  now,
  favorite = false,
}: {
  alert: Alert;
  now: Date;
  /** betrifft einen Favoriten (wird markiert) */
  favorite?: boolean;
}) {
  const validity = formatValidity(alert, now);
  return (
    <BottomSheet
      title={alert.title}
      description={sheetDescription(alert, now)}
      triggerClassName="flex w-full items-start gap-2.5 px-3 py-2 text-left outline-none hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      trigger={
        <>
          <AlertIcon alert={alert} className="mt-0.5" />
          <span className="min-w-0 flex-1 space-y-1">
            <span className="line-clamp-2 text-sm leading-snug font-medium">
              {favorite && (
                <Star
                  className="mr-1 inline size-3.5 fill-current align-[-2px] text-warning"
                  role="img"
                  aria-label="Betrifft Favorit"
                />
              )}
              {alert.title}
            </span>
            {(alert.lines.length > 0 || validity) && (
              <span className="flex flex-wrap items-center gap-1">
                <AlertLines alert={alert} max={ALERT_ROW_LINES} />
                {validity && (
                  <span className="ml-auto pl-1 text-xs text-muted-foreground">{validity}</span>
                )}
              </span>
            )}
          </span>
        </>
      }
    >
      <AlertDetails alert={alert} />
    </BottomSheet>
  );
}

function alertCount(count: number, facility: boolean): string {
  if (facility) return count === 1 ? "Aufzug/Rolltreppe" : `${count} Aufzüge/Rolltreppen`;
  return count === 1 ? "Störung" : `${count} Störungen`;
}

/**
 * Meldungen einer Haltestelle als eine schlanke Zeile über den Abfahrten (wie die Sammelhinweise);
 * das Panel zeigt alle mit vollem Text.
 */
export function StopAlertsBanner({
  alerts,
  now,
  facility = false,
}: {
  alerts: readonly Alert[];
  now: Date;
  /** Aufzüge/Rolltreppen (#70): eigene Beschriftung, Titel ohne Haltestellennamen */
  facility?: boolean;
}) {
  const [first] = alerts;
  if (!first) return null;
  const single = alerts.length === 1;
  const title = (alert: Alert) => (facility ? titleAtStop(alert) : alert.title);
  return (
    <BottomSheet
      title={
        single
          ? title(first)
          : facility
            ? "Aufzüge und Rolltreppen an dieser Haltestelle"
            : "Störungen an dieser Haltestelle"
      }
      description={single ? sheetDescription(first, now) : undefined}
      triggerClassName={NOTICE_CLASS}
      trigger={
        <>
          <AlertIcon alert={first} />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium">{alertCount(alerts.length, facility)}:</span>{" "}
            {title(first)}
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </>
      }
    >
      {single ? (
        <AlertDetails alert={first} />
      ) : (
        <ul className="divide-y">
          {alerts.map((alert) => (
            <li key={alert.id} className="space-y-2 py-3 first:pt-0">
              <p className="flex items-start gap-2">
                <AlertIcon alert={alert} className="mt-0.5" />
                <span className="min-w-0 flex-1 font-medium">{title(alert)}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatValidity(alert, now)}
                </span>
              </p>
              <AlertDetails alert={alert} />
            </li>
          ))}
        </ul>
      )}
    </BottomSheet>
  );
}
