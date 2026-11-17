import { Outlet } from "react-router";
import { PushSync } from "@/components/push-sync";
import { TabBar } from "@/components/tab-bar";

/**
 * Rahmen wie in einer App (#106): Inhalt oben, feste Navigation unten. Jede Seite bringt ihre
 * eigene Überschrift mit; Platz unten für Navigation und Home-Indikator (Safe Area).
 */
export function Layout() {
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
