import { FileText, UploadCloud, X } from "lucide-react";
import type { DragEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { bytes } from "@/lib/format";

const extensions: Record<string, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "application/pdf": ["pdf"],
};

interface FileDropProps {
  id: string;
  files: File[];
  onChange: (files: File[]) => void;
  /** Accepted MIME types. */
  accept: string[];
  /** Human list of formats: "JPG, PNG, WebP o PDF". */
  formats: string;
  maxKb: number;
  /** How many files it holds; 1 replaces the current file. */
  max?: number;
  /** Smallest width and height of images, in pixels. */
  minPixels?: number;
  invalid?: boolean;
  title: ReactNode;
}

function accepted(file: File, accept: string[]): boolean {
  if (file.type !== "") return accept.includes(file.type);
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return accept.some((type) => extensions[type]?.includes(extension));
}

function imageSize(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });
}

function FileThumb({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file.type.startsWith("image/")) return;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return url ? (
    <img src={url} alt="" className="size-14 shrink-0 rounded-xl object-cover ring-1 ring-line" />
  ) : (
    <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-signal-soft text-signal ring-1 ring-line">
      <FileText className="size-6" aria-hidden />
    </span>
  );
}

/** File picker with drag and drop, type, size and dimension checks, and a preview of what will be sent. */
export function FileDrop({ id, files, onChange, accept, formats, maxKb, max = 1, minPixels, invalid = false, title }: FileDropProps) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);
  const full = max > 1 && files.length >= max;

  const take = async (incoming: File[]) => {
    setRejected(null);
    const valid: File[] = [];
    for (const file of incoming) {
      if (!accepted(file, accept)) {
        setRejected(`“${file.name}” no es un formato permitido. Usa ${formats}.`);
        continue;
      }
      if (file.size > maxKb * 1024) {
        setRejected(`“${file.name}” pesa ${bytes(file.size)}; el máximo es ${bytes(maxKb * 1024)}.`);
        continue;
      }
      if (minPixels && file.type.startsWith("image/")) {
        const size = await imageSize(file);
        if (!size) {
          setRejected(`No pudimos abrir la imagen “${file.name}”.`);
          continue;
        }
        if (size.width < minPixels || size.height < minPixels) {
          setRejected(`La imagen mide ${size.width} × ${size.height} px; necesitamos al menos ${minPixels} × ${minPixels} px.`);
          continue;
        }
      }
      valid.push(file);
    }
    if (valid.length === 0) return;
    if (max === 1) {
      onChange([valid[0]]);
      return;
    }
    const next = [...files, ...valid];
    if (next.length > max) setRejected(`Puedes adjuntar hasta ${max} archivos.`);
    onChange(next.slice(0, max));
  };

  const drop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void take(Array.from(event.dataTransfer.files));
  };

  return (
    <div className="space-y-3">
      <input
        ref={input}
        id={id}
        type="file"
        className="sr-only"
        accept={accept.join(",")}
        multiple={max > 1}
        onChange={(event) => {
          void take(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      {!full && (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={drop}
          className={cn(
            "flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition",
            dragging ? "border-signal bg-signal-soft" : invalid || rejected ? "border-danger/60 bg-danger-soft/40" : "border-line-strong bg-raised hover:border-ink",
          )}
        >
          <UploadCloud className={cn("size-7", dragging ? "text-signal" : "text-faint")} aria-hidden />
          <span className="text-sm font-medium text-ink">{title}</span>
          <span className="text-xs text-muted">
            Arrastra el archivo aquí o <span className="font-medium text-ink underline">elígelo</span> · {formats} · máx. {bytes(maxKb * 1024)}
          </span>
        </button>
      )}
      {rejected && (
        <p className="text-xs text-danger" role="alert">
          {rejected}
        </p>
      )}
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-2.5">
              <FileThumb file={file} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted">{bytes(file.size)}</p>
              </div>
              {max === 1 && (
                <button type="button" onClick={() => input.current?.click()} className="rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-raised hover:text-ink">
                  Cambiar
                </button>
              )}
              <button
                type="button"
                onClick={() => onChange(files.filter((_, other) => other !== index))}
                className="rounded-lg p-1.5 text-muted hover:bg-raised hover:text-danger"
                aria-label={`Quitar ${file.name}`}
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
