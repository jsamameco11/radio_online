import { Link, usePage } from "@inertiajs/react";
import { AlertCircle, Gift as GiftIcon, Loader2, Minus, Plus, Sparkles, Wallet } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { VoiceClip } from "@/Components/gifts/voice-recorder";
import { VoiceRecorder, voiceExtension } from "@/Components/gifts/voice-recorder";
import { FrequencyTitle } from "@/Components/station/station-identity";
import { Button, ButtonLink } from "@/Components/ui/button";
import { Field, Switch, Textarea } from "@/Components/ui/field";
import { Modal } from "@/Components/ui/modal";
import { announceWalletChange } from "@/Components/wallet/wallet-events";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { HttpError, http } from "@/lib/http";
import { useSignInUrl } from "@/lib/sign-in";
import type { SharedProps, Station } from "@/types";
import type { GiftCatalog, SentGift } from "@/types/wallet";

const QUICK_QUANTITIES = [1, 5, 10, 25];

/** Random key per gift composition: retries of the same gift are sent once. */
function newIdempotencyKey(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * "Enviar regalo" button of a station page, with its modal: pick a gift,
 * how many, add a text or a voice note recorded in the browser, and send it
 * from the wallet. Guests are sent to sign in.
 */
export function GiftLauncher({ station, className }: { station: Station; className?: string }) {
  const { auth } = usePage<SharedProps>().props;
  const signInUrl = useSignInUrl();
  const [open, setOpen] = useState(false);

  if (!auth.user) {
    return (
      <ButtonLink href={signInUrl} variant="signal" title="Ingresa con Google para enviar regalos" className={className} icon={<GiftIcon className="size-4" />}>
        Enviar regalo
      </ButtonLink>
    );
  }

  return (
    <>
      <Button variant="signal" className={className} onClick={() => setOpen(true)} icon={<GiftIcon className="size-4" />}>
        Enviar regalo
      </Button>
      {open && <GiftModal station={station} onClose={() => setOpen(false)} />}
    </>
  );
}

function GiftModal({ station, onClose }: { station: Station; onClose: () => void }) {
  const { app } = usePage<SharedProps>().props;
  const url = `/radio/${station.frequency.slug}/regalos`;
  const [catalog, setCatalog] = useState<GiftCatalog | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [giftId, setGiftId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const [voice, setVoice] = useState<VoiceClip | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState<SentGift | null>(null);
  const idempotencyKey = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    http
      .get<GiftCatalog>(url)
      .then((data) => active && setCatalog(data))
      .catch((failure: unknown) => active && setLoadError(failure instanceof HttpError ? failure.firstError() : "No pudimos cargar los regalos."));
    return () => {
      active = false;
    };
  }, [url]);

  useEffect(() => {
    idempotencyKey.current = null;
  }, [giftId, quantity, message, voice, anonymous]);

  const formatMoney = (cents: number) => money(cents, app.currency);
  const gift = catalog?.gifts.find((item) => item.id === giftId) ?? null;
  const total = gift ? gift.price_cents * quantity : 0;
  const balance = catalog?.balance_cents ?? 0;
  const shortOfBalance = gift !== null && total > balance;
  const belowMinimum = gift !== null && catalog !== null && total < catalog.station.min_gift_cents;
  const maxQuantity = catalog?.limits.max_quantity ?? 99;

  const changeQuantity = (next: number) => setQuantity(Math.max(1, Math.min(maxQuantity, Math.round(next) || 1)));

  const reset = () => {
    setSent(null);
    setGiftId(null);
    setQuantity(1);
    setMessage("");
    setVoice(null);
    setError(null);
    setFieldErrors({});
  };

  const send = async () => {
    if (!gift || !catalog) return;
    const key = (idempotencyKey.current ??= newIdempotencyKey());

    const body = new FormData();
    body.append("gift_id", String(gift.id));
    body.append("quantity", String(quantity));
    body.append("idempotency_key", key);
    body.append("anonymous", anonymous ? "1" : "0");
    if (message.trim()) body.append("message", message.trim());
    if (voice) {
      body.append("voice", new File([voice.blob], `mensaje.${voiceExtension(voice.mime)}`, { type: voice.mime }));
      body.append("voice_duration", String(voice.seconds));
    }

    setSending(true);
    setError(null);
    setFieldErrors({});
    try {
      const result = await http.post<SentGift>(url, body);
      setSent(result);
      setCatalog({ ...catalog, balance_cents: result.balance_cents });
      announceWalletChange(result.balance_cents);
      idempotencyKey.current = null;
    } catch (failure) {
      if (failure instanceof HttpError) {
        setError(failure.firstError());
        setFieldErrors(Object.fromEntries(Object.entries(failure.body.errors ?? {}).map(([field, messages]) => [field, messages[0]])));
        if (failure.body.reason === "insufficient_balance") {
          http.get<{ balance_cents: number }>("/billetera/saldo").then((data) => setCatalog((current) => current && { ...current, balance_cents: data.balance_cents }));
        }
      } else {
        setError("Se perdió la conexión. Revisa tu internet e inténtalo otra vez.");
      }
    } finally {
      setSending(false);
    }
  };

  const footer = sent ? (
    <>
      <Button variant="ghost" onClick={onClose}>
        Cerrar
      </Button>
      <Button variant="signal" onClick={reset} icon={<GiftIcon className="size-4" />}>
        Enviar otro regalo
      </Button>
    </>
  ) : catalog && gift ? (
    <div className="flex w-full flex-wrap items-center justify-between gap-3">
      <div className="text-sm">
        <span className="text-muted">Total </span>
        <span className="font-display text-lg font-semibold tabular">{formatMoney(total)}</span>
      </div>
      {shortOfBalance ? (
        <Link href="/billetera" className="inline-flex h-10 items-center gap-2 rounded-xl bg-gold px-4 text-sm font-medium text-white hover:opacity-90">
          <Wallet className="size-4" /> Recargar saldo
        </Link>
      ) : (
        <Button variant="signal" onClick={send} loading={sending} disabled={belowMinimum || !catalog.station.accepts_gifts} icon={<Sparkles className="size-4" />}>
          Enviar {gift.emoji} {quantity > 1 ? `×${quantity}` : ""}
        </Button>
      )}
    </div>
  ) : undefined;

  return (
    <Modal open onClose={onClose} size="lg" title="Enviar un regalo" description={<FrequencyTitle station={station} size="sm" />} footer={footer}>
      {sent ? (
        <SentView sent={sent} station={station} balance={formatMoney(sent.balance_cents)} />
      ) : !catalog ? (
        <div className="flex min-h-48 items-center justify-center text-sm text-muted">
          {loadError ? (
            <span className="flex items-center gap-2 text-danger">
              <AlertCircle className="size-4" /> {loadError}
            </span>
          ) : (
            <Loader2 className="size-5 animate-spin" aria-label="Cargando regalos" />
          )}
        </div>
      ) : !catalog.station.accepts_gifts ? (
        <p className="py-10 text-center text-sm text-muted">Esta emisora no está recibiendo regalos en este momento.</p>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-raised px-4 py-3">
            <span className="flex items-center gap-2 text-sm text-muted">
              <Wallet className="size-4 text-gold" /> Tu saldo
              <strong className="font-display text-base text-ink tabular">{formatMoney(balance)}</strong>
            </span>
            <Link href="/billetera" className="text-sm font-medium text-ink underline-offset-4 hover:underline">
              Recargar
            </Link>
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Elige un regalo</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {catalog.gifts.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setGiftId(item.id)}
                  aria-pressed={item.id === giftId}
                  className={cn(
                    "group flex flex-col items-center gap-1 rounded-2xl border px-2 pt-3 pb-2 transition",
                    item.id === giftId ? "border-signal bg-signal-soft" : "border-line bg-surface hover:border-line-strong hover:bg-raised",
                  )}
                >
                  <span className="text-3xl leading-none transition group-hover:scale-110" aria-hidden>
                    {item.emoji ?? "🎁"}
                  </span>
                  <span className="w-full truncate text-center text-xs text-muted">{item.name}</span>
                  <span className="text-xs font-semibold tabular">{formatMoney(item.price_cents)}</span>
                </button>
              ))}
            </div>
            {fieldErrors.gift_id && <p className="text-xs text-danger">{fieldErrors.gift_id}</p>}
          </fieldset>

          {gift && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-medium">Cantidad</span>
                <div className="flex flex-wrap items-center gap-2">
                  {QUICK_QUANTITIES.filter((value) => value <= maxQuantity).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => changeQuantity(value)}
                      className={cn("h-8 min-w-10 rounded-lg px-2 text-xs font-semibold tabular", quantity === value ? "bg-primary text-on-primary" : "bg-raised text-muted hover:text-ink")}
                    >
                      ×{value}
                    </button>
                  ))}
                  <div className="flex items-center rounded-xl border border-line-strong">
                    <Button variant="ghost" size="icon" onClick={() => changeQuantity(quantity - 1)} aria-label="Menos">
                      <Minus className="size-4" />
                    </Button>
                    <input
                      type="number"
                      min={1}
                      max={maxQuantity}
                      value={quantity}
                      onChange={(event) => changeQuantity(Number(event.target.value))}
                      className="w-12 bg-transparent text-center text-sm font-semibold tabular focus:outline-none"
                      aria-label="Cantidad"
                    />
                    <Button variant="ghost" size="icon" onClick={() => changeQuantity(quantity + 1)} aria-label="Más">
                      <Plus className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
              {fieldErrors.quantity && <p className="text-xs text-danger">{fieldErrors.quantity}</p>}
              {belowMinimum && <p className="text-xs text-warning">El regalo mínimo para esta emisora es de {formatMoney(catalog.station.min_gift_cents)}.</p>}
            </>
          )}

          {catalog.station.accepts_text && (
            <Field
              label="Mensaje para la cabina (opcional)"
              hint={`${message.length}/${catalog.limits.max_message_length}`}
              error={fieldErrors.message}
            >
              {(id, invalid) => (
                <Textarea
                  id={id}
                  invalid={invalid}
                  rows={3}
                  value={message}
                  maxLength={catalog.limits.max_message_length}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="¡Saludos para todos los que escuchan!"
                />
              )}
            </Field>
          )}

          {catalog.station.accepts_voice && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Mensaje de voz (opcional)</p>
              <p className="text-xs text-muted">La cabina lo escucha en su consola y puede ponerlo al aire.</p>
              <VoiceRecorder maxSeconds={catalog.limits.max_voice_seconds} value={voice} onChange={setVoice} disabled={sending} />
              {(fieldErrors.voice || fieldErrors.voice_duration) && <p className="text-xs text-danger">{fieldErrors.voice ?? fieldErrors.voice_duration}</p>}
            </div>
          )}

          <Switch checked={anonymous} onChange={setAnonymous} label="Enviar como anónimo" description="Ni la emisora ni los oyentes verán tu nombre." />

          {shortOfBalance && (
            <p className="flex items-start gap-2 rounded-xl bg-gold-soft px-3 py-2 text-sm text-gold">
              <Wallet className="mt-0.5 size-4 shrink-0" />
              Te faltan {formatMoney(total - balance)}. La recarga mínima es de {formatMoney(catalog.limits.min_deposit_cents)}.
            </p>
          )}
          {error && !Object.keys(fieldErrors).length && (
            <p className="flex items-start gap-2 text-sm text-danger" role="alert">
              <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

function SentView({ sent, station, balance }: { sent: SentGift; station: Station; balance: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <span className="animate-bounce text-6xl leading-none" aria-hidden>
        {sent.gift.emoji ?? "🎁"}
      </span>
      <div className="space-y-1">
        <p className="font-display text-xl font-semibold">
          ¡{sent.gift.name}
          {sent.gift.quantity > 1 ? ` ×${sent.gift.quantity}` : ""} enviado!
        </p>
        <p className="text-sm text-muted">
          Llegó a la cabina de <FrequencyTitle station={station} size="sm" />
        </p>
      </div>
      {sent.thank_you_message && <blockquote className="max-w-sm rounded-2xl bg-raised px-4 py-3 text-sm italic">“{sent.thank_you_message}”</blockquote>}
      <p className="text-xs text-muted">
        Saldo disponible: <span className="font-semibold text-ink tabular">{balance}</span>
      </p>
    </div>
  );
}
