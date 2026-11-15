import { Link } from "react-router";
import { ChevronRight, Radio } from "lucide-react";
import { useNow } from "@/hooks/use-now";
import { useSavedTrip } from "@/hooks/use-saved-trip";
import { isTripOver, stepText, tripStep } from "@/lib/saved-trip";

/** Gemerkte Fahrt oben auf der Startseite (bis 30 Minuten nach der Ankunft) */
export function SavedTripCard() {
  const trip = useSavedTrip();
  const now = useNow(15_000);
  if (!trip || isTripOver(trip, now)) return null;
  const text = stepText(tripStep(trip.journey, now), now);
  return (
    <Link
      to="/fahrt"
      className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Radio className="size-4 shrink-0 text-success" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="flex gap-1 text-xs text-muted-foreground">
          <span className="min-w-0 truncate">Unterwegs nach {trip.to.name}</span>
          {text.when && (
            <span className="shrink-0 font-semibold text-foreground tabular-nums">
              · {text.when}
            </span>
          )}
        </span>
        <span className="block truncate text-sm font-semibold">{text.title}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
