import { useEffect } from "react";

const APP = "Abfahrt";

/**
 * Eigener Titel je Ansicht (WCAG 2.4.2, #128): Screenreader und Tabs nennen, wo man ist.
 * „Düsseldorf Hbf · Abfahrt“; ohne Titel nur „Abfahrt“.
 */
export function usePageTitle(title: string | null | undefined): void {
  useEffect(() => {
    document.title = title ? `${title} · ${APP}` : APP;
  }, [title]);
}
