import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router";
import { PushSync } from "@/components/push-sync";
import { TabBar } from "@/components/tab-bar";
import { cn } from "@/lib/utils";

/**
 * Rahmen wie in einer App (#106): Inhalt oben, feste Navigation unten. Jede Seite bringt ihre
 * eigene Überschrift mit; Platz unten für Navigation und Home-Indikator (Safe Area).
 */
export function Layout() {
  const { pathname } = useLocation();
  const shown = useRef(pathname);
  const isMap = pathname.startsWith("/karte");

  // Nach einem Seitenwechsel den Fokus auf die neue Überschrift setzen, damit Screenreader die neue
  // Seite ansagen und die Tastatur dort weitermacht (#128). Nicht beim ersten Laden.
  useEffect(() => {
    if (shown.current === pathname) return;
    shown.current = pathname;
    const heading = document.querySelector<HTMLElement>("main h1");
    if (!heading) return;
    if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="min-h-dvh bg-background">
      {/* EndLab-Kopf mit Welle – nicht auf der Karte, die die ganze Höhe braucht */}
      {!isMap && (
        <header className="endlab-head px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <span
            className="endlab-bubble"
            style={{ width: 110, height: 110, right: -30, top: -50 }}
          />
          <p className="mx-auto max-w-2xl text-lg font-bold tracking-tight">Abfahrt</p>
        </header>
      )}
      <main
        className={cn(
          "mx-auto max-w-2xl px-4 pb-[calc(5rem+env(safe-area-inset-bottom))]",
          isMap ? "pt-[calc(1rem+env(safe-area-inset-top))]" : "pt-1",
        )}
      >
        <Outlet />
        <PushSync />
        {!isMap && (
          <footer className="endlab-footer mt-10">
            <span className="endlab-logo" aria-hidden />
            <span>
              Powered by <b>EndLab</b>
            </span>
          </footer>
        )}
      </main>
      <TabBar />
    </div>
  );
}
