import { useEffect, useState } from "react";

type ApiStatus = "loading" | "ok" | "error";

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
    <main>
      <h1>Abfahrt</h1>
      <p>Echtzeit-Abfahrten für Bus und Bahn – in Arbeit.</p>
      <p className="api-status" data-status={apiStatus}>
        API:{" "}
        {apiStatus === "loading"
          ? "prüfe …"
          : apiStatus === "ok"
            ? "erreichbar"
            : "nicht erreichbar"}
      </p>
    </main>
  );
}
