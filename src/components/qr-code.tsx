import { useMemo } from "react";
import { encode } from "uqr";

/**
 * QR-Code als SVG, aus der Punktmatrix von uqr selbst gezeichnet (kein eingeschleustes HTML).
 * Dunkle Punkte in Marineblau auf Weiß, mit Ruhezone; lesbar in Hell und Dunkel.
 */
export function QrCode({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const { size, path } = useMemo(() => {
    const qr = encode(value, { ecc: "M", border: 2 });
    let d = "";
    qr.data.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) d += `M${x} ${y}h1v1h-1z`;
      }),
    );
    return { size: qr.size, path: d };
  }, [value]);
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={size} height={size} fill="#ffffff" rx="1" />
      <path d={path} fill="#0e2240" />
    </svg>
  );
}
