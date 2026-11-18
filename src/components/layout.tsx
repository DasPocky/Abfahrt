import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router";
import { PushSync } from "@/components/push-sync";
import { TabBar } from "@/components/tab-bar";

/**
 * Rahmen wie in einer App (#106): Inhalt oben, feste Navigation unten. Jede Seite bringt ihre
 * eigene Überschrift mit; Platz unten für Navigation und Home-Indikator (Safe Area).
 */
export function Layout() {
  const { pathname } = useLocation();
  const shown = useRef(pathname);

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
      <main className="mx-auto max-w-2xl px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <Outlet />
        <PushSync />
      </main>
      <TabBar />
    </div>
  );
}
