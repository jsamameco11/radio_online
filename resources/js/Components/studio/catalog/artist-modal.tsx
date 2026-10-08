import { useForm } from "@inertiajs/react";
import type { FormEvent } from "react";
import { GenrePicker } from "@/Components/studio/library/genre-picker";
import { Button } from "@/Components/ui/button";
import { Field, Input, Select } from "@/Components/ui/field";
import { Modal } from "@/Components/ui/modal";
import { useStudioUrl } from "@/Layouts/StudioLayout";
import type { CatalogArtist, GenreBrief, Option } from "@/types/media";

interface Props {
  /** The artist to edit; a new one when absent. */
  artist?: CatalogArtist;
  genres: GenreBrief[];
  families: Option[];
  kinds: Option[];
  maxGenres: number;
  onClose: () => void;
}

/** Adds an artist to the shared catalog, or changes one the station added, so its songs get their genres automatically. */
export function ArtistModal({ artist, genres, families, kinds, maxGenres, onClose }: Props) {
  const url = useStudioUrl();
  const form = useForm({
    name: artist?.name ?? "",
    kind: artist?.kind ?? "",
    country: artist?.country ?? "",
    aliases: artist?.aliases.join(", ") ?? "",
    genre_ids: artist?.genres.map((genre) => genre.id) ?? ([] as string[]),
  });
  const firstError = (field: string) => Object.entries(form.errors).find(([key]) => key.startsWith(`${field}.`))?.[1];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const options = { preserveScroll: true, onSuccess: onClose };
    if (artist) form.put(url(`/catalogo/artistas/${artist.id}`), options);
    else form.post(url("/catalogo/artistas"), options);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={artist ? `Editar ${artist.name}` : "Agregar artista"}
      description="El catálogo es compartido por todas las radios: las canciones de este artista recibirán sus géneros."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="catalog-artist" loading={form.processing}>
            {artist ? "Guardar" : "Agregar"}
          </Button>
        </>
      }
    >
      <form id="catalog-artist" onSubmit={submit} className="space-y-4">
        <Field label="Nombre" error={form.errors.name}>
          {(id, invalid) => <Input id={id} invalid={invalid} value={form.data.name} maxLength={120} onChange={(event) => form.setData("name", event.target.value)} autoFocus />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo (opcional)" error={form.errors.kind}>
            {(id, invalid) => (
              <Select id={id} invalid={invalid} value={form.data.kind} onChange={(event) => form.setData("kind", event.target.value)}>
                <option value="">Sin indicar</option>
                {kinds.map((kind) => (
                  <option key={kind.value} value={kind.value}>
                    {kind.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="País (opcional)" hint="Código de dos letras, como PE o MX." error={form.errors.country}>
            {(id, invalid) => <Input id={id} invalid={invalid} value={form.data.country} maxLength={2} onChange={(event) => form.setData("country", event.target.value.toUpperCase())} />}
          </Field>
        </div>
        <Field label="Otros nombres (opcional)" hint="Separados por comas: como aparece en otros discos o archivos («Juanes, Juan Esteban Aristizábal»)." error={form.errors.aliases ?? firstError("aliases")}>
          {(id, invalid) => <Input id={id} invalid={invalid} value={form.data.aliases} onChange={(event) => form.setData("aliases", event.target.value)} />}
        </Field>
        <Field label="Géneros" hint="El primero es el principal; la estrella cambia cuál lo es." error={form.errors.genre_ids ?? firstError("genre_ids")}>
          {(id) => <GenrePicker id={id} genres={genres} families={families} value={form.data.genre_ids} max={maxGenres} onChange={(ids) => form.setData("genre_ids", ids)} />}
        </Field>
      </form>
    </Modal>
  );
}
