import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/use-page-title";

export function NotFoundPage() {
  usePageTitle("Seite nicht gefunden");
  return (
    <section className="space-y-4 py-8 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Seite nicht gefunden</h1>
      <Button asChild>
        <Link to="/">Zur Startseite</Link>
      </Button>
    </section>
  );
}
