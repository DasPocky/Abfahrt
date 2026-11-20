import { useQuery } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { API_PREFIX } from "../../shared/base-path";

/** Hinweis aus der Verwaltung (z. B. Bauarbeiten) oben auf der Startseite; ohne Hinweis nichts */
export function BannerNotice() {
  const { data } = useQuery({
    queryKey: ["banner"],
    queryFn: async ({ signal }) => {
      const res = await fetch(`${API_PREFIX}banner`, { signal });
      if (!res.ok) return null;
      const body: unknown = await res.json();
      return typeof body === "object" &&
        body !== null &&
        "text" in body &&
        typeof body.text === "string"
        ? body.text
        : null;
    },
    staleTime: 5 * 60_000,
  });
  if (!data) return null;
  return (
    <p
      role="note"
      className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm"
    >
      <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
      <span>{data}</span>
    </p>
  );
}
