import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/page-header";

export function NotFoundPage() {
  usePageTitle("Seite nicht gefunden");
  return (
    <section className="space-y-4 py-8 text-center">
      <PageHeader title="Seite nicht gefunden" />
      <Button asChild>
        <Link to="/">Zur Startseite</Link>
      </Button>
    </section>
  );
}
