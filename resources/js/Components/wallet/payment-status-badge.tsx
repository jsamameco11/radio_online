import type { Tone } from "@/Components/ui/badge";
import { Badge } from "@/Components/ui/badge";
import type { Labeled, PaymentStatus } from "@/types/wallet";

const tones: Record<PaymentStatus, Tone> = {
  pending: "warning",
  succeeded: "onair",
  failed: "danger",
  cancelled: "neutral",
  refunded: "info",
};

export function PaymentStatusBadge({ status }: { status: Labeled<PaymentStatus> }) {
  return <Badge tone={tones[status.value]}>{status.label}</Badge>;
}
