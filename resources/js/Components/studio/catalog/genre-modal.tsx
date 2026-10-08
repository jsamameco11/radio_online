import { useForm } from "@inertiajs/react";
import type { FormEvent } from "react";
import { Button } from "@/Components/ui/button";
import { Field, Input, Select } from "@/Components/ui/field";
import { Modal } from "@/Components/ui/modal";
import { useStudioUrl } from "@/Layouts/StudioLayout";
import type { CatalogGenre, Option } from "@/types/media";

interface Props {
  /** The style to edit; a new one when absent. */
  genre?: CatalogGenre;
  families: Option[];
  onClose: () => void;
}

/** Adds a style to the shared catalog, or changes one the station added. */
export function GenreModal({ genre, families, onClose }: Props) {
  const url = useStudioUrl();
  const form = useForm({ name: genre?.name ?? "", family: genre?.family ?? "", aliases: genre?.aliases.join(", ") ?? "" });
  const aliasError = form.errors.aliases ?? Object.entries(form.errors).find(([key]) => key.startsWith("aliases."))?.[1];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const options = { preserveScroll: true, onSuccess: onClose };
    if (genre) form.put(url(`/catalogo/estilos/${genre.id}`), options);
    else form.post(url("/catalogo/estilos"), options);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={genre ? `Editar ${genre.name}` : "Nuevo estilo"}
      description="Los estilos son compartidos por todas las radios: cualquiera podrá elegirlo para sus canciones."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="catalog-genre" loading={form.processing}>
            {genre ? "Guardar" : "Agregar"}
          </Button>
        </>
      }
    >
      <form id="catalog-genre" onSubmit={submit} className="space-y-4">
        <Field label="Nombre" error={form.errors.name}>
          {(id, invalid) => <Input id={id} invalid={invalid} value={form.data.name} maxLength={60} onChange={(event) => form.setData("name", event.target.value)} autoFocus />}
        </Field>
        <Field label="Familia" hint="Agrupa el estilo con los parecidos en la programación y los filtros." error={form.errors.family}>
          {(id, invalid) => (
            <Select id={id} invalid={invalid} value={form.data.family} onChange={(event) => form.setData("family", event.target.value)}>
              <option value="">Elige una familia</option>
              {families.map((family) => (
                <option key={family.value} value={family.value}>
                  {family.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Otros nombres (opcional)" hint="Separados por comas, como lo escriben las tiendas de música: «Reggaeton, Perreo»." error={aliasError}>
          {(id, invalid) => <Input id={id} invalid={invalid} value={form.data.aliases} onChange={(event) => form.setData("aliases", event.target.value)} />}
        </Field>
      </form>
    </Modal>
  );
}
