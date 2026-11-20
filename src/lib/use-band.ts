import { useLayoutEffect, type RefObject } from "react";

/**
 * EndLab-Band hinter dem Seitenkopf: Es reicht bis unter den Titelblock der Seite (erste sichtbare
 * Überschrift samt direkt folgender Absätze). Was ganz im Band liegt (Zurück-Knopf, Titel, Stern …),
 * bekommt die Klasse `on-band` und steht hell auf Marineblau. Die Höhe landet als `--band` am <html>.
 * Misst neu, sobald sich der Inhalt ändert (Seitenwechsel, nachgeladene Daten, andere Größe).
 */
export function useBand(main: RefObject<HTMLElement | null>, active: boolean) {
  useLayoutEffect(() => {
    const el = main.current;
    const root = document.documentElement;
    const clear = () => root.style.removeProperty("--band");
    if (!el || !active) {
      clear();
      return undefined;
    }
    const measure = () => {
      for (const marked of el.querySelectorAll(".on-band")) marked.classList.remove("on-band");
      const heading = [...el.querySelectorAll("h1")].find(
        (h) => !h.classList.contains("sr-only") && h.getClientRects().length > 0,
      );
      if (!heading) {
        clear();
        return;
      }
      let last: Element = heading;
      while (last.nextElementSibling?.tagName === "P") last = last.nextElementSibling;
      const band = Math.ceil(last.getBoundingClientRect().bottom + scrollY + 12);
      root.style.setProperty("--band", `${band}px`);
      const mark = (parent: Element) => {
        for (const child of parent.children) {
          const r = child.getBoundingClientRect();
          if (!r.height) continue;
          if (r.bottom + scrollY <= band + 0.5) child.classList.add("on-band");
          else if (r.top + scrollY < band) mark(child);
        }
      };
      mark(el);
    };
    measure();
    // Eigene Klassenänderungen (on-band) lösen keinen neuen Lauf aus: nur Struktur und Text beobachten
    const mutations = new MutationObserver(measure);
    mutations.observe(el, { childList: true, subtree: true, characterData: true });
    // ResizeObserver fehlt in der Testumgebung (jsdom)
    const sizes = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    sizes?.observe(el);
    addEventListener("resize", measure);
    return () => {
      mutations.disconnect();
      sizes?.disconnect();
      removeEventListener("resize", measure);
      clear();
    };
  }, [main, active]);
}
