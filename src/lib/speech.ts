// Vorlesen (#129): kurze, natürliche Sätze für die Sprachausgabe des Geräts. Rein und getestet.
import type { Departure, Journey, JourneyLeg, JourneyStop } from "../../shared/api-types";
import {
  effectiveTime,
  hasPlatformChange,
  sortDepartures,
  upcomingDepartures,
} from "@/lib/departures";
import { platformLabel } from "@/lib/modes";
import { stopTime, tripProgress, tripStops } from "@/lib/trip";
import { delayMinutes, formatClock, minutesUntil } from "@/lib/time";

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** „jetzt“, „in 1 Minute“, „in 7 Minuten“, ab einer Stunde „um 13:05 Uhr“ */
export function spokenWhen(target: Date, now: Date): string {
  const minutes = minutesUntil(target, now);
  if (minutes < 1) return "jetzt";
  if (minutes < 60) return `in ${plural(minutes, "Minute", "Minuten")}`;
  return `um ${formatClock(target)} Uhr`;
}

/** „3 Minuten später“, „1 Minute früher“, „pünktlich“; leer ohne Echtzeit */
export function spokenDelay(delay: number | null): string {
  if (delay === null) return "";
  if (delay === 0) return "pünktlich";
  return delay > 0
    ? `${plural(delay, "Minute", "Minuten")} später`
    : `${plural(-delay, "Minute", "Minuten")} früher`;
}

/** Leerzeichen zwischen Buchstaben und Zahl, damit „RE5“ als „R E 5“ und nicht als Wort gelesen wird */
function spokenLine(line: string): string {
  return line.replace(/^([A-Za-z]+)(\d)/, "$1 $2");
}

/** Ein Satz je Abfahrt: „U 76 nach Holthausen, in 4 Minuten, 13 Minuten später, Steig 4.“ */
export function departureSentence(d: Departure, now: Date): string {
  const head = `${spokenLine(d.line)} nach ${d.direction}`;
  if (d.cancelled) return `${head}, ${formatClock(new Date(d.plannedTime))} Uhr, fällt aus.`;
  const parts = [head, spokenWhen(effectiveTime(d), now)];
  const delay = spokenDelay(delayMinutes(d.plannedTime, d.realtimeTime));
  if (delay && delay !== "pünktlich") parts.push(delay);
  if (d.platform !== null) {
    const label = platformLabel(d.mode);
    parts.push(
      hasPlatformChange(d)
        ? `heute ${label} ${d.platform} statt ${d.plannedPlatform}`
        : `${label} ${d.platform}`,
    );
  }
  return `${parts.join(", ")}.`;
}

/** Haltestelle mit den nächsten Abfahrten */
export function stopSpeech(
  stopName: string,
  departures: readonly Departure[],
  now: Date,
  max = 5,
): string {
  const next = upcomingDepartures(sortDepartures(departures), now).slice(0, max);
  if (next.length === 0) return `${stopName}: zurzeit keine Abfahrten.`;
  return [`Abfahrten ${stopName}.`, ...next.map((d) => departureSentence(d, now))].join(" ");
}

function stopWhen(stop: JourneyStop, now: Date): string {
  return spokenWhen(new Date(stopTime(stop)), now);
}

/** Fahrtverlauf: wann die Fahrt bei mir ist, Verspätung, Steig; sonst nächster Halt */
export function tripSpeech(leg: JourneyLeg, fromIndex: number, now: Date): string {
  const stops = tripStops(leg);
  const head = `${spokenLine(leg.line ?? "")} nach ${leg.destination.name}.`;
  const progress = tripProgress(stops, now);
  if (progress.state === "after") return `${head} Die Fahrt ist beendet.`;
  const passedUpTo = progress.state === "between" ? progress.index : -1;
  const target = fromIndex > passedUpTo ? stops[fromIndex] : stops[passedUpTo + 1];
  if (!target) return head;
  const label = fromIndex > passedUpTo ? `An ${target.name}` : `Nächster Halt ${target.name}`;
  const parts = [`${label} ${stopWhen(target, now)}`];
  const delay = spokenDelay(
    delayMinutes(
      target.plannedDeparture ?? target.plannedArrival ?? "",
      target.realtimeDeparture ?? target.realtimeArrival,
    ),
  );
  if (delay) parts.push(delay);
  if (target.platform !== null)
    parts.push(`${platformLabel(leg.mode ?? "other")} ${target.platform}`);
  return `${head} ${parts.join(", ")}.`;
}

function legSentence(leg: JourneyLeg, first: boolean): string {
  if (leg.kind === "walk") {
    return `${first ? "Zuerst" : "Dann"} ${plural(leg.durationMinutes, "Minute", "Minuten")} zu Fuß zu ${leg.destination.name}.`;
  }
  const start = leg.origin.realtimeDeparture ?? leg.origin.plannedDeparture;
  const platform =
    leg.origin.platform !== null
      ? ` ${platformLabel(leg.mode ?? "other")} ${leg.origin.platform}`
      : "";
  const time = start ? ` um ${formatClock(new Date(start))} Uhr` : "";
  const cancelled = leg.cancelled ? " Achtung, fällt aus." : "";
  return `${first ? "" : "Dann "}${spokenLine(leg.line ?? "")} ab ${leg.origin.name}${platform}${time}, Richtung ${leg.direction ?? leg.destination.name}, bis ${leg.destination.name}.${cancelled}`;
}

/** Verbindung: Abfahrt, Ankunft, Dauer, Umstiege, dann jeder Abschnitt */
export function journeySpeech(journey: Journey): string {
  const first = journey.legs[0];
  const last = journey.legs.at(-1);
  if (!first || !last) return "";
  const dep = first.origin.realtimeDeparture ?? first.origin.plannedDeparture;
  const arr = last.destination.realtimeArrival ?? last.destination.plannedArrival;
  const transfers =
    journey.transfers === 0 ? "ohne Umstieg" : plural(journey.transfers, "Umstieg", "Umstiege");
  const head = [
    dep ? `Abfahrt ${formatClock(new Date(dep))} Uhr` : null,
    arr ? `Ankunft ${formatClock(new Date(arr))} Uhr` : null,
    plural(journey.durationMinutes, "Minute", "Minuten"),
    transfers,
  ]
    .filter(Boolean)
    .join(", ");
  return [`${head}.`, ...journey.legs.map((leg, i) => legSentence(leg, i === 0))].join(" ");
}
