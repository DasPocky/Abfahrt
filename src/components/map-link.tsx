import { Link } from "react-router";
import { Map as MapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Dezenter Einstieg zur Karte unter der Suche */
export function MapLink() {
  return (
    <div className="flex justify-end">
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
        <Link to="/karte">
          <MapIcon aria-hidden="true" />
          Haltestellen auf der Karte
        </Link>
      </Button>
    </div>
  );
}
