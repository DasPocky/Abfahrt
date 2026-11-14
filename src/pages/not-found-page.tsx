import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <section className="space-y-4 py-8 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Seite nicht gefunden</h1>
      <Button asChild>
        <Link to="/">Zur Startseite</Link>
      </Button>
    </section>
  );
}
