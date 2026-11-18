import { cn } from "cn";
import { DELAY_PILL_CLASS, delayTone, formatDelay } from "@/lib/time";

/**
 * Verspätung als gefülltes, farbiges Kästchen (#124), z. B. „+2“ orange, „+6“ rot, „-1“ grün.
 * Nichts bei pünktlich oder ohne Echtzeit.
 */
export function DelayBadge({ delay, className }: { delay: number | null; className?: string }) {
  if (delay === null || delay === 0) return null;
  const tone = delayTone(delay);
  return (
    <span
      className={cn(
        "inline-block rounded px-1 py-0.5 text-[0.7rem] leading-none font-bold tabular-nums",
        DELAY_PILL_CLASS[tone],
        className,
      )}
      data-tone={tone}
      title={delay > 0 ? `${delay} Min später` : `${-delay} Min früher`}
    >
      {formatDelay(delay)}
    </span>
  );
}
