import { Link } from "@inertiajs/react";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** A titled block of a public page, with an optional "Ver todo" link. */
export function Section({
  title,
  description,
  href,
  linkLabel = "Ver todo",
  icon,
  className,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  href?: string;
  linkLabel?: string;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-ink sm:text-2xl">
            {icon}
            {title}
          </h2>
          {description && <p className="text-sm text-muted">{description}</p>}
        </div>
        {href && (
          <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
            {linkLabel} <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
