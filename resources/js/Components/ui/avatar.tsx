import { cn } from "@/lib/cn";

const sizes = { sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-14 text-base" };

export function Avatar({ name, src, size = "md", className }: { name: string; src?: string | null; size?: keyof typeof sizes; className?: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return src ? (
    <img src={src} alt="" className={cn("shrink-0 rounded-full object-cover", sizes[size], className)} />
  ) : (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-raised font-semibold text-muted ring-1 ring-line", sizes[size], className)}>
      {initials}
    </span>
  );
}
