// Navigation unten wie in einer App (#106): fünf Bereiche, aktiver Bereich blau.
import { useState } from "react";
import { Link, useLocation } from "react-router";
import {
  Ellipsis,
  Map as MapIcon,
  Route,
  TramFront,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { remember, TABS, tabForPath, tabTarget, type TabKey, type TabMemory } from "@/lib/tabs";

const ICONS: Record<TabKey, LucideIcon> = {
  abfahrten: TramFront,
  verbindung: Route,
  karte: MapIcon,
  stoerungen: TriangleAlert,
  mehr: Ellipsis,
};

export function TabBar() {
  const { pathname, search } = useLocation();
  const current = tabForPath(pathname);
  // Je Bereich die zuletzt besuchte Seite (nur im Speicher dieser Sitzung)
  // (beim Rendern angepasst, wie von React empfohlen; `remember` liefert ohne Änderung dasselbe Objekt)
  const [memory, setMemory] = useState<TabMemory>({});
  const next = remember(memory, pathname, search);
  if (next !== memory) setMemory(next);

  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/75"
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-5">
        {TABS.map((tab) => {
          const Icon = ICONS[tab.key];
          const active = tab.key === current;
          return (
            <li key={tab.key}>
              <Link
                to={tabTarget(tab, current, memory)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium outline-none focus-visible:bg-muted",
                  active
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
