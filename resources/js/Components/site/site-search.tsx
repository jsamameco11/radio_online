import { router, usePage } from "@inertiajs/react";
import { Search } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

function currentQuery(url: string): string {
  const [path, query = ""] = url.split("?");
  return path === "/buscar" ? (new URLSearchParams(query).get("q") ?? "") : "";
}

/** One box for everything: a name, a frequency ("89.3"), a #hashtag or a category. */
export function SiteSearch({ className, autoFocus = false }: { className?: string; autoFocus?: boolean }) {
  const { url } = usePage();
  const [value, setValue] = useState(() => currentQuery(url));

  useEffect(() => setValue(currentQuery(url)), [url]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const q = value.trim();
    if (q !== "") router.get("/buscar", { q });
  };

  return (
    <form role="search" onSubmit={submit} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" aria-hidden />
      <input
        type="search"
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Radio, 89.3, #hashtag o categoría"
        aria-label="Buscar radios"
        autoFocus={autoFocus}
        maxLength={80}
        className="h-10 w-full rounded-full border border-line bg-raised pr-4 pl-10 text-sm text-ink placeholder:text-faint transition focus:border-ink focus:bg-surface focus:outline-none"
      />
    </form>
  );
}
