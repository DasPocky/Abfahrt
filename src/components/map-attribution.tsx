/** Quellhinweis der Kartenkacheln (OSM, OpenFreeMap, OpenMapTiles), unten rechts in der Karte */
export function MapAttribution() {
  return (
    <p className="absolute right-0 bottom-0 rounded-tl-md bg-background/85 px-1.5 py-0.5 text-[10px] leading-tight text-muted-foreground">
      ©{" "}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
        className="underline-offset-2 hover:underline"
      >
        OpenStreetMap-Mitwirkende
      </a>
      ,{" "}
      <a
        href="https://openfreemap.org"
        target="_blank"
        rel="noopener noreferrer"
        className="underline-offset-2 hover:underline"
      >
        OpenFreeMap
      </a>{" "}
      ·{" "}
      <a
        href="https://www.openmaptiles.org/"
        target="_blank"
        rel="noopener noreferrer"
        className="underline-offset-2 hover:underline"
      >
        OpenMapTiles
      </a>
    </p>
  );
}
