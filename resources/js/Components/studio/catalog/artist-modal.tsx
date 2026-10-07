import { useForm } from "@inertiajs/react";
import type { FormEvent } from "react";
import { GenrePicker } from "@/Components/studio/library/genre-picker";
import { Button } from "@/Components/ui/button";
import { Field, Input, Select } from "@/Components/ui/field";
import { Modal } from "@/Components/ui/modal";
import { useStudioUrl } from "@/Layouts/StudioLayout";
import type { GenreBrief, Option } from "@/types/media";

interface Props {
  genres: GenreBrief[];
  families: Option[];
  kinds: Option[];
  maxGenres: number;
  onClose: () => void;
}

/** Adds an artist to the shared catalog, so its songs get their genres automatically. */
export function ArtistModal({ genres, families, kinds, maxGenres, onClose }: Props) {
  const url = useStudioUrl();
  const form = useForm({ name: "", kind: "", country: "", genre_ids: [] as string[] });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post(url("/catalogo/artistas"), { preserveScroll: true, onSuccess: onClose });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Agregar artista"
      description="El catálogo es compartido por todas las radios: las canciones de este artista recibirán sus géneros."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="catalog-artist" loading={form.processing}>
            Agregar
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
        <Field label="Géneros" error={form.errors.genre_ids ?? Object.entries(form.errors).find(([key]) => key.startsWith("genre_ids."))?.[1]}>
          {(id) => <GenrePicker id={id} genres={genres} families={families} value={form.data.genre_ids} max={maxGenres} onChange={(ids) => form.setData("genre_ids", ids)} />}
        </Field>
      </form>
    </Modal>
  );
}
