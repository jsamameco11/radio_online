import { Link, useForm } from "@inertiajs/react";
import { ArrowLeft, AudioLines, CheckCircle2, Disc3, Heart, Library, LogIn, Mic2, Podcast, RadioTower, ShieldCheck, Star, Tag, Wallet } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { stationArtwork } from "@/Components/site/station-card";
import { FrequencyTitle, StationLogo } from "@/Components/station/station-identity";
import { Badge } from "@/Components/ui/badge";
import { Button, ButtonLink, buttonClasses } from "@/Components/ui/button";
import { Checkbox, Field, Input } from "@/Components/ui/field";
import { Modal } from "@/Components/ui/modal";
import SiteLayout from "@/Layouts/SiteLayout";
import { count, dateTime, money, rating } from "@/lib/format";
import { useSignInUrl } from "@/lib/sign-in";
import type { Station } from "@/types";
import type { StationListing } from "@/types/marketplace";

interface Props {
  listing: StationListing;
  description: string | null;
  createdAt: string | null;
  viewer: {
    balance_cents: number;
    is_seller: boolean;
    bought: boolean;
  } | null;
  studioUrl: string | null;
  listenUrl: string | null;
}

export default function MarketplaceShow({ listing, description, createdAt, viewer, studioUrl, listenUrl }: Props) {
  const [confirming, setConfirming] = useState(false);
  const { station } = listing;

  return (
    <SiteLayout title={`${station?.display_name ?? `Canal ${listing.frequency.display}`} en venta`}>
      <div className="space-y-6">
        <Link href="/frecuencias-en-venta" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Canales en venta
        </Link>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          {station === null ? (
            <FrequencyOffer listing={listing} />
          ) : (
            <StationOffer listing={listing} station={station} description={description} createdAt={createdAt} listenUrl={listenUrl} />
          )}

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="space-y-4 rounded-3xl border border-line bg-surface p-5 shadow-[0_18px_40px_-28px_rgb(0_0_0/0.35)]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold tracking-[0.14em] text-muted uppercase">Precio fijo</span>
                {listing.status === "active" ? <Badge tone="gold">En venta</Badge> : <Badge tone="neutral">{listing.status_label}</Badge>}
              </div>
              <p className="font-display text-4xl font-bold text-ink tabular">{money(listing.price_cents, listing.currency)}</p>
              <PurchaseBox listing={listing} viewer={viewer} studioUrl={studioUrl} onBuy={() => setConfirming(true)} />
              <p className="flex items-start gap-2 border-t border-line pt-4 text-xs text-muted">
                <ShieldCheck className="mt-px size-4 shrink-0 text-onair" aria-hidden />
                {listing.by_platform
                  ? "La vende la plataforma: pagas con tu billetera y el canal queda a tu nombre al instante."
                  : "La plataforma retiene tu pago y se lo entrega al vendedor después de que el canal ya es tuyo."}
              </p>
            </div>
          </aside>
        </div>
      </div>

      {confirming && <ConfirmPurchase listing={listing} onClose={() => setConfirming(false)} />}
    </SiteLayout>
  );
}

function FrequencyOffer({ listing }: { listing: StationListing }) {
  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-[2rem] border border-line bg-gold-soft px-5 py-10 text-center sm:px-8 sm:py-14">
        <RadioTower className="mx-auto size-8 text-gold" aria-hidden />
        <h1 className="mt-4 font-display text-6xl font-bold text-ink tabular sm:text-7xl">{listing.frequency.label}</h1>
        <p className="mt-3 text-lg text-muted">Un canal libre, listo para tu transmisión.</p>
      </header>

      {listing.pitch && (
        <section className="space-y-2 rounded-3xl border border-line bg-surface p-5 sm:p-6">
          <h2 className="text-xs font-bold tracking-[0.14em] text-muted uppercase">Sobre este canal</h2>
          <p className="whitespace-pre-line text-ink">{listing.pitch}</p>
        </section>
      )}

      <section className="space-y-4 rounded-3xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold">Qué incluye la compra</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          <Included icon={<RadioTower className="size-4" />} title={`El canal ${listing.frequency.display}`}>
            Tu lugar fijo en la plataforma, para siempre a tu nombre.
          </Included>
          <Included icon={<Mic2 className="size-4" />} title="Tu canal, con el nombre que elijas">
            La abrimos al instante y quedas como propietaria o propietario.
          </Included>
          <Included icon={<Disc3 className="size-4" />} title="Consola profesional">
            Transmisión en vivo, piloto automático, programación y editor de audio.
          </Included>
          <Included icon={<Library className="size-4" />} title="Biblioteca y episodios">
            Sube tu música y tus programas, y publica episodios a la carta.
          </Included>
        </ul>
      </section>
    </div>
  );
}

function StationOffer({
  listing,
  station,
  description,
  createdAt,
  listenUrl,
}: {
  listing: StationListing;
  station: Station;
  description: string | null;
  createdAt: string | null;
  listenUrl: string | null;
}) {
  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-[2rem] border border-line bg-surface">
        <div className="relative h-40 sm:h-52" style={station.cover_url ? undefined : { background: stationArtwork(station) }}>
          {station.cover_url && <img src={station.cover_url} alt={`Foto de portada de ${station.display_name}`} className="size-full object-cover" />}
        </div>
        <div className="space-y-4 px-5 pb-6 sm:px-8">
          <StationLogo station={station} size="lg" className="relative z-10 -mt-12 shadow-xl ring-4 ring-surface sm:-mt-16 sm:size-32 sm:rounded-[2rem]" />
          <div className="space-y-2">
            <h1>
              <FrequencyTitle station={station} size="xl" />
            </h1>
            {station.tagline && <p className="text-lg text-muted">{station.tagline}</p>}
          </div>
          {listenUrl && (
            <a href={listenUrl} className={buttonClasses("secondary", "sm")}>
              <AudioLines className="size-3.5" /> Escuchar el canal
            </a>
          )}
        </div>
      </header>

      {listing.pitch && (
        <section className="space-y-2 rounded-3xl border border-line bg-surface p-5 sm:p-6">
          <h2 className="text-xs font-bold tracking-[0.14em] text-muted uppercase">{listing.by_platform ? "Sobre este canal" : "Lo que cuenta su propietario"}</h2>
          <p className="whitespace-pre-line text-ink">{listing.pitch}</p>
        </section>
      )}

      <section className="space-y-4 rounded-3xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold">Qué incluye la compra</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          <Included icon={<RadioTower className="size-4" />} title={`El canal ${station.frequency.display}`}>
            Tu lugar fijo en la plataforma.
          </Included>
          <Included icon={<Mic2 className="size-4" />} title="Nombre, logo y portada">
            La identidad con la que la conocen sus oyentes.
          </Included>
          <Included icon={<Heart className="size-4" />} title={`${count(station.follower_count)} ${station.follower_count === 1 ? "suscriptor" : "suscriptores"}`}>
            Siguen al canal y reciben sus novedades.
          </Included>
          <Included icon={<Podcast className="size-4" />} title={`${count(listing.episode_count)} ${listing.episode_count === 1 ? "episodio publicado" : "episodios publicados"}`}>
            Su archivo de programas a la carta.
          </Included>
          <Included
            icon={<Library className="size-4" />}
            title={`${count(listing.track_count)} ${listing.track_count === 1 ? "audio en la biblioteca" : "audios en la biblioteca"}`}
          >
            Música, cuñas y grabaciones listas para emitir.
          </Included>
          <Included icon={<Star className="size-4" />} title={station.rating_count > 0 ? `${rating(station.rating_average)} de 5 estrellas` : "Sin calificaciones aún"}>
            {station.rating_count > 0
              ? `${count(station.rating_count)} ${station.rating_count === 1 ? "calificación" : "calificaciones"} de oyentes.`
              : "Las calificaciones de los oyentes se mantienen."}
          </Included>
        </ul>
        <p className="text-xs text-muted">
          {!listing.by_platform && "No incluye el saldo que el canal tenga en su billetera: ese dinero es del vendedor. "}
          {createdAt && `Al aire desde ${dateTime(createdAt, { dateStyle: "long" })}.`}
        </p>
      </section>

      {description && (
        <section className="space-y-2 rounded-3xl border border-line bg-surface p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold">Sobre el canal</h2>
          <p className="whitespace-pre-line text-muted">{description}</p>
        </section>
      )}
    </div>
  );
}

function PurchaseBox({ listing, viewer, studioUrl, onBuy }: { listing: StationListing; viewer: Props["viewer"]; studioUrl: string | null; onBuy: () => void }) {
  const signInUrl = useSignInUrl();

  if (viewer?.bought) {
    return (
      <div className="space-y-3">
        <p className="flex items-start gap-2 rounded-2xl bg-onair-soft px-4 py-3 text-sm text-onair">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {listing.by_platform ? "¡El canal es tuyo! Compraste " : "¡El canal es tuyo! Compraste "}
            {listing.station?.display_name ?? listing.frequency.display}
            {listing.sold_at && ` el ${dateTime(listing.sold_at, { dateStyle: "long" })}`}.
          </span>
        </p>
        {studioUrl && (
          <a href={studioUrl} className={buttonClasses("primary", "lg", "w-full")}>
            <Mic2 className="size-4" /> Ir a mi consola
          </a>
        )}
      </div>
    );
  }

  if (listing.status !== "active") {
    return <p className="rounded-2xl bg-raised px-4 py-3 text-sm text-muted">Este canal ya fue vendido.</p>;
  }

  if (viewer === null) {
    return (
      <ButtonLink href={signInUrl} size="lg" className="w-full" icon={<LogIn className="size-4" />}>
        Ingresa para comprar
      </ButtonLink>
    );
  }

  if (viewer.is_seller) {
    return <p className="rounded-2xl bg-raised px-4 py-3 text-sm text-muted">Este es tu canal. Puedes cambiar el precio o retirarlo de la venta desde tu consola.</p>;
  }

  const missing = listing.price_cents - viewer.balance_cents;

  return (
    <div className="space-y-3">
      <p className="flex items-center justify-between rounded-2xl bg-raised px-4 py-3 text-sm">
        <span className="flex items-center gap-2 text-muted">
          <Wallet className="size-4" aria-hidden /> Tu saldo
        </span>
        <span className="font-semibold text-ink tabular">{money(viewer.balance_cents, listing.currency)}</span>
      </p>
      {missing > 0 ? (
        <>
          <p className="text-sm text-muted">
            Te faltan <span className="font-semibold text-ink">{money(missing, listing.currency)}</span> para comprarla.
          </p>
          <ButtonLink href="/billetera" size="lg" className="w-full" icon={<Wallet className="size-4" />}>
            Recargar mi billetera
          </ButtonLink>
        </>
      ) : (
        <Button size="lg" className="w-full" icon={<Tag className="size-4" />} onClick={onBuy}>
          Comprar por {money(listing.price_cents, listing.currency)}
        </Button>
      )}
    </div>
  );
}

function ConfirmPurchase({ listing, onClose }: { listing: StationListing; onClose: () => void }) {
  const form = useForm({ accepted: false, station_name: "" });
  const errors: Partial<Record<string, string>> = form.errors;
  const price = money(listing.price_cents, listing.currency);
  const ready = form.data.accepted && (!listing.by_platform || form.data.station_name.trim().length >= 3);

  form.transform(({ station_name, ...data }) => (listing.by_platform ? { ...data, station_name: station_name.trim() } : data));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post(`/frecuencias-en-venta/${listing.id}/comprar`, {
      preserveScroll: true,
      onSuccess: onClose,
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Comprar ${listing.station?.display_name ?? `el canal ${listing.frequency.display}`}`}
      description="Revisa los detalles antes de confirmar: la compra es definitiva."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="confirm-purchase" loading={form.processing} disabled={!ready} icon={<Tag className="size-4" />}>
            Pagar {price}
          </Button>
        </>
      }
    >
      <form id="confirm-purchase" onSubmit={submit} className="space-y-4">
        {listing.by_platform && (
          <Field label="Nombre de tu canal" hint="Así te encontrará la audiencia. Podrás cambiarlo después desde tu consola." error={errors.station_name}>
            {(id, invalid) => (
              <Input
                id={id}
                invalid={invalid}
                required
                minLength={3}
                maxLength={80}
                value={form.data.station_name}
                onChange={(event) => form.setData("station_name", event.target.value)}
                placeholder="Radio Aurora"
                autoFocus
              />
            )}
          </Field>
        )}
        <ul className="space-y-2.5 text-sm text-ink">
          <Point>
            Pagarás <strong>{price}</strong> con el saldo de tu billetera.
          </Point>
          {listing.by_platform ? (
            <>
              <Point>El canal {listing.frequency.display} pasa a ser tuyo al instante y lo abrimos con este nombre.</Point>
              <Point>Quedas como propietaria o propietario y entras directo a tu consola.</Point>
            </>
          ) : (
            <>
              <Point>El canal, su número, sus suscriptores, su biblioteca y sus episodios pasan a ser tuyos al instante.</Point>
              <Point>El equipo actual del canal pierde el acceso y tú quedas como única propietaria o propietario.</Point>
            </>
          )}
          <Point>La compra no se puede deshacer.</Point>
        </ul>
        <Checkbox
          checked={form.data.accepted}
          onChange={(event) => form.setData("accepted", event.target.checked)}
          label="Entiendo y quiero comprar este canal"
        />
        {(errors.listing ?? errors.accepted) && (
          <p className="text-sm text-danger" role="alert">
            {errors.listing ?? errors.accepted}
          </p>
        )}
      </form>
    </Modal>
  );
}

function Included({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3 rounded-2xl bg-raised p-3.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-surface text-signal">{icon}</span>
      <span className="space-y-0.5">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block text-xs text-muted">{children}</span>
      </span>
    </li>
  );
}

function Point({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Disc3 className="mt-0.5 size-4 shrink-0 text-signal" aria-hidden />
      <span>{children}</span>
    </li>
  );
}
