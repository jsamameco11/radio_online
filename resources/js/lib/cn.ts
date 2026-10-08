import { twMerge } from "tailwind-merge";

/** Joins class names, skipping falsy values; when two Tailwind classes clash (h-10 and h-8), the later one wins. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return twMerge(classes);
}
