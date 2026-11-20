// Einzelauswahl als Segmentschalter (Optionen #101, Einstellungen #37)
import { cn } from "cn";

/** Akzentfarbe für gewählte Optionen (#101: mehr farbliche Klarheit) */
export const ACCENT_ON = "bg-primary text-primary-foreground shadow-xs";

/** Einzelauswahl als Segmentschalter: der gewählte Teil blau */
export function Segmented<T>({
  choices,
  value,
  onChange,
}: {
  choices: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex rounded-lg bg-muted p-0.5">
      {choices.map((choice) => (
        <button
          key={choice.label}
          type="button"
          aria-pressed={choice.value === value}
          onClick={() => onChange(choice.value)}
          className={cn(
            "min-h-8 min-w-0 flex-1 rounded-md px-1.5 py-1 text-sm leading-tight font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
            choice.value === value ? ACCENT_ON : "text-muted-foreground hover:text-foreground",
          )}
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}
