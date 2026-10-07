import { Check, Copy, Link2, MessageCircle } from "lucide-react";
import { useState } from "react";
import { Button, buttonClasses } from "@/Components/ui/button";
import type { Station } from "@/types";

function useCopy(): [string | null, (key: string, text: string) => void] {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (key: string, text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 2000);
    });
  };
  return [copied, copy];
}

/** Everything a team needs to invite friends: the station link, a ready-made text and WhatsApp. */
export function ShareKit({ station, shareUrl }: { station: Pick<Station, "display_name">; shareUrl: string }) {
  const [copied, copy] = useCopy();
  const invitation = `Sintoniza ${station.display_name}. Estoy transmitiendo en vivo: entra, escúchame y suscríbete para no perderte ningún programa. ${shareUrl}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-line bg-raised p-1.5 pl-3">
        <Link2 className="size-4 shrink-0 text-faint" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm text-ink">{shareUrl}</span>
        <Button size="sm" variant="secondary" icon={copied === "link" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} onClick={() => copy("link", shareUrl)}>
          {copied === "link" ? "¡Copiado!" : "Copiar enlace"}
        </Button>
      </div>
      <figure className="rounded-xl border border-dashed border-line-strong bg-surface p-3.5">
        <figcaption className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">Mensaje de invitación</figcaption>
        <blockquote className="text-sm text-ink">{invitation}</blockquote>
      </figure>
      <div className="flex flex-wrap gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(invitation)}`} target="_blank" rel="noreferrer" className={buttonClasses("signal", "sm")}>
          <MessageCircle className="size-3.5" aria-hidden />
          Compartir por WhatsApp
        </a>
        <Button size="sm" variant="secondary" icon={copied === "text" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} onClick={() => copy("text", invitation)}>
          {copied === "text" ? "¡Copiado!" : "Copiar mensaje"}
        </Button>
      </div>
    </div>
  );
}
