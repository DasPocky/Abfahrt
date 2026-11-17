// Live-Begleitung einer gemerkten Verbindung: nächster Schritt, Warnungen, Zeitleiste
import { useEffect, useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, ArrowRight, Radio, Search, TriangleAlert, X } from "lucide-react";
import { cn } from "cn";
import { JourneyDetails } from "@/components/journey-details";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNow } from "@/hooks/use-now";
import { useSavedTrip } from "@/hooks/use-saved-trip";
import { fetchJourneys } from "@/lib/api";
import { journeyTransferRisk, TRANSFER_RISK_TEXT } from "@/lib/connections";
import { isJourneyCancelled, journeyPath } from "@/lib/journeys";
import {
  findJourney,
  isTripOver,
  setSavedTrip,
  stepText,
  tripQueryTime,
  tripStep,
} from "@/lib/saved-trip";
import { formatClockWithSeconds } from "@/lib/time";

/** Neu abfragen alle 30 s, Countdown jede 15 s */
const REFRESH_MS = 30_000;
const TICK_MS = 15_000;

export function TripPage() {
  const trip = useSavedTrip();
  const navigate = useNavigate();
  const now = useNow(TICK_MS);
  const detailsId = useId();
  const over = trip !== null && isTripOver(trip, now);

  const { data, dataUpdatedAt, isError } = useQuery({
    queryKey: ["trip", trip?.from.id, trip?.to.id, trip?.signature, trip?.options],
    queryFn: ({ signal }) =>
      fetchJourneys(
        {
          from: trip?.from.id ?? "",
          to: trip?.to.id ?? "",
          when: trip ? tripQueryTime(trip) : undefined,
          options: trip?.options,
        },
        signal,
      ),
    enabled: trip !== null && !over,
    refetchInterval: REFRESH_MS,
  });
  const live = trip && data ? findJourney(data.journeys, trip.signature) : null;

  // Neuesten Stand merken, damit Startseite und Offline-Anzeige ihn haben
  useEffect(() => {
    if (!trip || !live) return;
    if (JSON.stringify(live) !== JSON.stringify(trip.journey)) {
      setSavedTrip({ ...trip, journey: live });
    }
  }, [trip, live]);

  if (!trip) {
    return (
      <section className="space-y-4 py-8 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Keine gemerkte Verbindung</h1>
        <p className="text-sm text-muted-foreground">
          In der Verbindungssuche eine Verbindung aufklappen und „Merken & live verfolgen“ tippen.
        </p>
        <Button asChild>
          <Link to="/verbindung">Verbindung suchen</Link>
        </Button>
      </section>
    );
  }

  const journey = live ?? trip.journey;
  const step = tripStep(journey, now);
  const text = stepText(step, now);
  const cancelled = isJourneyCancelled(journey);
  const risk = cancelled ? null : journeyTransferRisk(journey);
  const missing = data !== undefined && live === null;
  // Alternativen ab dem nächsten Einstieg (falls bekannt), sonst ab dem Start
  const nextStop =
    step.kind !== "arrived" && step.leg.origin.id
      ? { id: step.leg.origin.id, name: step.leg.origin.name }
      : trip.from;
  const alternatives = journeyPath({
    from: nextStop,
    to: trip.to,
    arrive: false,
    options: trip.options,
  });
  const end = () => {
    setSavedTrip(null);
    void navigate("/");
  };

  return (
    <section aria-labelledby="trip-title" className="space-y-3">
      <Button asChild variant="ghost" size="sm" className="-ml-2 h-7 text-muted-foreground">
        <Link to="/verbindung" aria-label="Zurück zur Verbindungssuche">
          <ArrowLeft aria-hidden="true" />
          Verbindung
        </Link>
      </Button>

      <div>
        <h1 id="trip-title" className="text-lg leading-snug font-semibold tracking-tight">
          {trip.from.name}
          <ArrowRight
            className="mx-1 inline size-4 align-[-0.15em] text-muted-foreground"
            aria-hidden="true"
          />
          <span className="sr-only"> nach </span>
          {trip.to.name}
        </h1>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Radio
            className={cn("size-3.5", !over && !isError && "text-success")}
            aria-hidden="true"
          />
          {over
            ? "Fahrt vorbei"
            : isError
              ? "Keine aktuellen Daten, letzter Stand"
              : dataUpdatedAt
                ? `Live · Stand ${formatClockWithSeconds(new Date(dataUpdatedAt))}`
                : "Live · wird geladen …"}
        </p>
      </div>

      <Card className="gap-1 px-4 py-3" role="status" aria-live="polite">
        <p className="text-sm text-muted-foreground">{over ? "Angekommen" : "Nächster Schritt"}</p>
        <p className="text-lg leading-tight font-semibold">{text.title}</p>
        {text.when && <p className="text-2xl font-bold tabular-nums">{text.when}</p>}
      </Card>

      {(cancelled || risk || missing) && !over && (
        <div
          role="alert"
          className={cn(
            "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
            cancelled || risk === "missed" || missing
              ? "border-destructive/40 text-destructive"
              : "border-warning/40 text-warning",
          )}
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-semibold">
              {missing
                ? "Verbindung nicht mehr im Fahrplan – evtl. ausgefallen."
                : cancelled
                  ? "Ein Teil der Verbindung fällt aus."
                  : risk
                    ? TRANSFER_RISK_TEXT[risk]
                    : ""}
            </p>
            <Link
              to={alternatives}
              className="inline-flex items-center gap-1 underline underline-offset-2"
            >
              <Search className="size-3.5" aria-hidden="true" />
              Alternativen suchen
            </Link>
          </div>
        </div>
      )}

      <Card className="gap-0 overflow-hidden py-0">
        <JourneyDetails id={detailsId} journey={journey} />
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to={alternatives}>
            <Search aria-hidden="true" />
            Alternativen
          </Link>
        </Button>
        <Button variant="ghost" size="sm" onClick={end}>
          <X aria-hidden="true" />
          Begleitung beenden
        </Button>
      </div>
    </section>
  );
}
