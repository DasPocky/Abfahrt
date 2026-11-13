import { StopSearch } from "@/components/stop-search";

export function HomePage() {
  return (
    <section aria-labelledby="home-title" className="space-y-4">
      <div className="space-y-1">
        <h1 id="home-title" className="text-2xl font-semibold tracking-tight">
          Abfahrten
        </h1>
        <p className="text-sm text-muted-foreground">
          Haltestelle suchen und Live-Abfahrten für Bus und Bahn sehen.
        </p>
      </div>
      <StopSearch />
    </section>
  );
}
