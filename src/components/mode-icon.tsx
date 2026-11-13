import {
  Bus,
  CircleQuestionMark,
  Ship,
  TrainFront,
  TrainFrontTunnel,
  TramFront,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import { MODE_LABEL } from "@/lib/modes";
import type { TransportMode } from "../../shared/api-types";

const MODE_ICON: Record<TransportMode, LucideIcon> = {
  tram: TramFront,
  subway: TrainFrontTunnel,
  bus: Bus,
  suburban: TrainFront,
  regional: TrainFront,
  longdistance: TrainFront,
  ferry: Ship,
  other: CircleQuestionMark,
};

export function ModeIcon({ mode, ...props }: { mode: TransportMode } & LucideProps) {
  const Icon = MODE_ICON[mode];
  return <Icon role="img" aria-label={MODE_LABEL[mode]} {...props} />;
}
