import { useEffect, useRef } from "react";
import { useBand } from "@/lib/use-band";
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
  const main = useRef<HTMLElement>(null);
  useBand(main, !isMap);

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
    <div className="relative min-h-dvh bg-background">
      {/* EndLab-Band mit Welle bis unter den Seitentitel – nicht auf der Karte, die die ganze Höhe braucht */}
      {!isMap && (
        <>
          <div className="endlab-band" aria-hidden="true" />
          <header className="relative pt-[calc(0.25rem+env(safe-area-inset-top))] pr-[calc(1rem+env(safe-area-inset-right))] pl-[calc(1rem+env(safe-area-inset-left))] text-white">
            <p className="mx-auto max-w-2xl text-sm font-bold tracking-tight opacity-80">Abfahrt</p>
          </header>
        </>
      )}
      <main
        ref={main}
        className={cn(
          "relative mx-auto max-w-2xl pr-[calc(1rem+env(safe-area-inset-right))] pb-[calc(5rem+env(safe-area-inset-bottom))] pl-[calc(1rem+env(safe-area-inset-left))]",
          isMap ? "pt-[calc(1rem+env(safe-area-inset-top))]" : "pt-1",
        )}
      >
        <Outlet />
        <PushSync />
        {!isMap && (
          <footer className="endlab-footer layout-footer mt-10">
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
