import { useLayoutEffect, type RefObject } from "react";

/**
 * EndLab-Band hinter dem Seitenkopf: Es reicht bis unter den Titelblock der Seite (erste sichtbare
 * Überschrift samt direkt folgender Absätze). Was ganz im Band liegt (Zurück-Knopf, Titel, Stern …),
 * bekommt die Klasse `on-band` und steht hell auf Marineblau. Die Höhe landet als `--band` am <html>.
 * Das erste Element unter dem Titelblock rückt so weit ab, dass es ganz unter der Welle beginnt –
 * nichts Bedienbares liegt halb im Band.
 * Misst neu, sobald sich der Inhalt ändert (Seitenwechsel, nachgeladene Daten, andere Größe).
 */

/** Wie weit die Welle unter --band reicht (endlab.css: Band 20px höher) plus Luft */
const BELOW_WAVE = 28;

/** Erstes sichtbares Element nach `node` innerhalb von `root` (display: contents wird durchsucht) */
function nextBox(node: Element, root: Element): HTMLElement | null {
  const firstBox = (e: Element | null): HTMLElement | null => {
    for (; e; e = e.nextElementSibling) {
      if (!(e instanceof HTMLElement)) continue;
      if (e.getClientRects().length && e.getBoundingClientRect().height) return e;
      if (getComputedStyle(e).display === "contents") {
        const inner = firstBox(e.firstElementChild);
        if (inner) return inner;
      }
    }
    return null;
  };
  for (let cur: Element | null = node; cur && cur !== root; cur = cur.parentElement) {
    const found = firstBox(cur.nextElementSibling);
    if (found) return found;
  }
  return null;
}
export function useBand(main: RefObject<HTMLElement | null>, active: boolean) {
  useLayoutEffect(() => {
    const el = main.current;
    const root = document.documentElement;
    const clear = () => root.style.removeProperty("--band");
    if (!el || !active) {
      clear();
      return undefined;
    }
    let pushed: HTMLElement | null = null;
    const unpush = () => {
      if (pushed) pushed.style.removeProperty("margin-top");
      pushed = null;
    };
    const measure = () => {
      for (const marked of el.querySelectorAll(".on-band")) marked.classList.remove("on-band");
      unpush();
      const heading = [...el.querySelectorAll("h1")].find(
        (h) => !h.classList.contains("sr-only") && h.getClientRects().length > 0,
      );
      if (!heading) {
        clear();
        return;
      }
      // Titelblock: der Seitenkopf um die Überschrift (Titel, Unterzeile, Knöpfe), sonst Überschrift samt Absätzen
      const kopf = heading.closest("header");
      let last: Element = kopf && el.contains(kopf) ? kopf : heading;
      if (last === heading)
        while (last.nextElementSibling?.tagName === "P") last = last.nextElementSibling;
      const band = Math.ceil(last.getBoundingClientRect().bottom + scrollY + 12);
      root.style.setProperty("--band", `${band}px`);
      // Das Element darunter beginnt erst unter der Welle (gemessen ohne eigenen Zusatzabstand)
      const next = nextBox(last, el);
      if (next) {
        const gap = band + BELOW_WAVE - (next.getBoundingClientRect().top + scrollY);
        if (gap > 0) {
          const base = parseFloat(getComputedStyle(next).marginTop) || 0;
          next.style.marginTop = `${Math.ceil(base + gap)}px`;
          pushed = next;
        }
      }
      const mark = (parent: Element) => {
        for (const child of parent.children) {
          const r = child.getBoundingClientRect();
          // display: contents (z. B. ein fieldset um die Seite) hat keine eigene Box: hineinsehen
          if (!r.height) {
            if (child.children.length) mark(child);
            continue;
          }
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
      unpush();
      clear();
    };
  }, [main, active]);
}
