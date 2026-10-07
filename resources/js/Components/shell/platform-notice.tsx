import { usePage } from "@inertiajs/react";
import { Megaphone } from "lucide-react";
import type { SharedProps } from "@/types";

/** The staff's maintenance notice, above every page while it has text. */
export function PlatformNotice() {
  const { notice } = usePage<SharedProps>().props;
  if (!notice) return null;

  return (
    <div role="status" className="border-b border-warning/30 bg-warning-soft px-4 py-2 text-center text-sm text-ink">
      <Megaphone className="mr-2 inline size-4 align-[-0.15em] text-warning" aria-hidden />
      {notice}
    </div>
  );
}
