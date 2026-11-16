import { Link } from "react-router";
import { Map as MapIcon, Route, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { journeyPath } from "@/lib/journeys";

/** Dezente Einstiege unter der Suche: Verbindungssuche, Karte und Störungen */
export function MapLink() {
  return (
    <div className="flex flex-wrap justify-end">
      <Button asChild variant="ghost" size="sm" className="px-2 text-xs text-muted-foreground">
        <Link to={journeyPath()}>
          <Route className="size-3.5" aria-hidden="true" />
          Verbindung suchen
        </Link>
      </Button>
      <Button asChild variant="ghost" size="sm" className="px-2 text-xs text-muted-foreground">
        <Link to="/karte">
          <MapIcon className="size-3.5" aria-hidden="true" />
          Karte
        </Link>
      </Button>
      <Button asChild variant="ghost" size="sm" className="px-2 text-xs text-muted-foreground">
        <Link to="/stoerungen">
          <TriangleAlert className="size-3.5" aria-hidden="true" />
          Störungen
        </Link>
      </Button>
    </div>
  );
}
