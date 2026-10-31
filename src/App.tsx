import { useEffect, useState } from "react";
import { Search, TramFront } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ApiStatus = "loading" | "ok" | "error";

const API_STATUS_LABEL: Record<ApiStatus, string> = {
  loading: "API wird geprüft …",
  ok: "API erreichbar",
  error: "API nicht erreichbar",
};

const API_STATUS_CLASS: Record<ApiStatus, string> = {
  loading: "",
  ok: "bg-success text-white",
  error: "bg-destructive text-white",
};

export function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("loading");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/health", { signal: controller.signal })
      .then((res) => setApiStatus(res.ok ? "ok" : "error"))
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setApiStatus("error");
        if (!(err instanceof DOMException)) console.error(err);
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <TramFront className="size-6" aria-hidden="true" />
          <h1 className="text-xl font-semibold tracking-tight">Abfahrt</h1>
          <Badge
            variant={apiStatus === "loading" ? "secondary" : "default"}
            className={`ml-auto ${API_STATUS_CLASS[apiStatus]}`}
            data-status={apiStatus}
          >
            {API_STATUS_LABEL[apiStatus]}
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Abfahrten</CardTitle>
            <CardDescription>
              Echtzeit-Abfahrten für Bus und Bahn – die Haltestellensuche folgt in M1.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                placeholder="Haltestelle suchen …"
                aria-label="Haltestelle suchen"
                className="pl-8"
                disabled
              />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
