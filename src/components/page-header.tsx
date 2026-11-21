import type { ReactNode } from "react";
import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Zurück: Link zu einer Seite oder eine Aktion (z. B. Verlauf zurück) */
export type PageBack = { label: string } & ({ to: string } | { onClick: () => void });

/**
 * Einheitlicher Seitenkopf im EndLab-Band: Zurück-Pfeil, Titel und Aktionen in einer Zeile, damit
 * das Band auf jeder Seite gleich hoch ist. Der Titel ist einzeilig (lange Namen enden mit „…“,
 * der volle Name steht im Tooltip). Was sonst zum Kopf gehört (Stand, Ort, Hinweise), steht als
 * `children` darunter – schon unter dem Band.
 */
export function PageHeader({
  title,
  id,
  back,
  badge,
  actions,
  children,
}: {
  title: string;
  id?: string;
  back?: PageBack;
  /** Vor dem Titel, z. B. das Liniensymbol */
  badge?: ReactNode;
  /** Rechts im Kopf, z. B. der Favoriten-Stern */
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <>
      <header className="flex min-h-10 items-center gap-1.5">
        {back &&
          ("to" in back ? (
            <Button asChild variant="ghost" size="icon" className="-ml-2 shrink-0">
              <Link to={back.to} aria-label={back.label}>
                <ArrowLeft aria-hidden="true" />
              </Link>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="-ml-2 shrink-0"
              aria-label={back.label}
              onClick={back.onClick}
            >
              <ArrowLeft aria-hidden="true" />
            </Button>
          ))}
        <h1
          id={id}
          title={title}
          className="flex min-w-0 flex-1 items-center gap-2 text-2xl font-semibold tracking-tight"
        >
          {badge && <span className="shrink-0 text-base">{badge}</span>}
          <span className="min-w-0 truncate">{title}</span>
        </h1>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </header>
      {children}
    </>
  );
}
