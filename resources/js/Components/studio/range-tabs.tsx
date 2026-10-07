import { router } from "@inertiajs/react";
import { Tabs } from "@/Components/ui/tabs";

/** Period switch of the analytics screens ("?dias=7|30|90"). */
export function RangeTabs({ range, ranges }: { range: number; ranges: number[] }) {
  return (
    <Tabs
      value={String(range)}
      onChange={(value) => router.get(window.location.pathname, { dias: value }, { preserveState: true, preserveScroll: true, replace: true })}
      items={ranges.map((days) => ({ value: String(days), label: `${days} días` }))}
    />
  );
}
