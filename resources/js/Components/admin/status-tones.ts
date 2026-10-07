import type { Tone } from "@/Components/ui/badge";
import type { FrequencyStatusValue, MonitorStatusValue } from "@/types/admin";

/** Cell colors of the live monitor, one per status. */
export const monitorCellClasses: Record<MonitorStatusValue, string> = {
  free: "bg-raised text-faint ring-line",
  reserved: "bg-info-soft text-info ring-info/30",
  live: "bg-signal text-white ring-signal",
  online: "bg-onair text-white ring-onair",
  connecting: "bg-warning-soft text-warning ring-warning/40",
  offline: "bg-surface text-muted ring-line-strong",
  error: "bg-danger text-white ring-danger",
  maintenance: "bg-warning text-white ring-warning",
  suspended: "bg-danger-soft text-danger ring-danger/30",
};

/** Small legend dot per monitor status. */
export const monitorDotClasses: Record<MonitorStatusValue, string> = {
  free: "bg-line-strong",
  reserved: "bg-info",
  live: "bg-signal",
  online: "bg-onair",
  connecting: "bg-warning/60",
  offline: "bg-faint",
  error: "bg-danger",
  maintenance: "bg-warning",
  suspended: "bg-danger/50",
};

export const frequencyTones: Record<FrequencyStatusValue, Tone> = {
  available: "neutral",
  reserved: "info",
  active: "onair",
  suspended: "danger",
  maintenance: "warning",
};

export const frequencyDotClasses: Record<FrequencyStatusValue, string> = {
  available: "bg-line-strong",
  reserved: "bg-info",
  active: "bg-onair",
  suspended: "bg-danger",
  maintenance: "bg-warning",
};
