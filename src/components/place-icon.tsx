import { House, Landmark } from "lucide-react";
import type { PlaceKind } from "../../shared/api-types";
import { cn } from "cn";

/**
 * Symbol je Treffer (#119): Haltestellen als farbiges Haltestellen-Schild (gelbes H auf Grün), damit
 * sie auf einen Blick auffallen; Adressen (Haus) und Orte (Gebäude) gedämpft.
 */
export function PlaceIcon({ kind = "stop", className }: { kind?: PlaceKind; className?: string }) {
  if (kind === "address") {
    return (
      <House
        className={cn("size-4 shrink-0 text-muted-foreground", className)}
        aria-hidden="true"
      />
    );
  }
  if (kind === "poi") {
    return (
      <Landmark
        className={cn("size-4 shrink-0 text-muted-foreground", className)}
        aria-hidden="true"
      />
    );
  }
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full bg-stop-sign text-[0.7rem] leading-none font-bold text-stop-sign-foreground",
        className,
      )}
      aria-hidden="true"
    >
      H
    </span>
  );
}
