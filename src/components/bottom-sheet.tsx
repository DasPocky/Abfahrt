// Panel von unten auf Basis des nativen <dialog> (showModal): Fokusfalle, Escape, inerter
// Hintergrund und Fokus-Rückgabe liefert der Browser. Bewusst kein Radix-Dialog: dessen
// Scroll-Sperre fügt <style>-Elemente ein, die unsere CSP (style-src 'self') blockiert.
import { XIcon } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

export function BottomSheet({
  title,
  description,
  trigger,
  triggerLabel,
  triggerClassName,
  children,
  className,
}: {
  title: string;
  description?: string;
  /** Inhalt des auslösenden Buttons */
  trigger: ReactNode;
  /** Zugänglicher Name des Buttons, falls der Inhalt nicht reicht (z. B. nur ein Symbol) */
  triggerLabel?: string;
  triggerClassName?: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const id = useId();

  const show = () => {
    setOpen(true);
    ref.current?.showModal();
  };
  const close = () => ref.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        aria-label={triggerLabel}
        className={triggerClassName}
      >
        {trigger}
      </button>
      <dialog
        ref={ref}
        id={id}
        aria-labelledby={`${id}-title`}
        aria-describedby={description ? `${id}-description` : undefined}
        onClose={() => setOpen(false)}
        // Tipp auf den abgedunkelten Hintergrund schließt (Ziel ist dann das <dialog> selbst)
        onClick={(event) => event.target === event.currentTarget && close()}
        className={cn(
          "mx-auto mt-auto mb-0 max-h-[80dvh] w-full max-w-2xl overflow-y-auto rounded-t-xl border-t bg-popover p-0 text-sm text-popover-foreground shadow-lg backdrop:bg-black/30 open:animate-in open:fade-in-0 open:slide-in-from-bottom-10",
          className,
        )}
      >
        {open && (
          <div className="pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-start gap-2 p-4">
              <div className="min-w-0 flex-1 space-y-1">
                <h2 id={`${id}-title`} className="font-heading font-medium text-foreground">
                  {title}
                </h2>
                {description && (
                  <p id={`${id}-description`} className="text-muted-foreground">
                    {description}
                  </p>
                )}
              </div>
              <Button variant="ghost" size="icon-sm" onClick={close} className="-mt-1 -mr-1">
                <XIcon aria-hidden="true" />
                <span className="sr-only">Schließen</span>
              </Button>
            </div>
            <div className="px-4">{children}</div>
          </div>
        )}
      </dialog>
    </>
  );
}
