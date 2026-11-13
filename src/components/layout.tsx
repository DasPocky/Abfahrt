import { Link, Outlet } from "react-router";
import { TramFront } from "lucide-react";

export function Layout() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-2xl items-center px-4 py-3">
          <Link to="/" className="flex items-center gap-2 rounded-md">
            <TramFront className="size-6" aria-hidden="true" />
            <span className="text-xl font-semibold tracking-tight">Abfahrt</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
