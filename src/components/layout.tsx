import { Link, Outlet } from "react-router";
import { TramFront } from "lucide-react";

export function Layout() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-12 max-w-2xl items-center px-4">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-md"
            aria-label="Abfahrt – Startseite"
          >
            <span className="flex size-7 items-center justify-center rounded-lg bg-foreground text-background">
              <TramFront className="size-4" aria-hidden="true" />
            </span>
            <span className="text-base font-semibold tracking-tight">Abfahrt</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 pt-4 pb-10">
        <Outlet />
      </main>
    </div>
  );
}
