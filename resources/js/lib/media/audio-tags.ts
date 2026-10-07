/**
 * Reads what an audio file says about itself, in the browser and before uploading: ID3v2 and ID3v1
 * (MP3), Vorbis comments (FLAC, OGG, OPUS) and the iTunes atoms of M4A. When the file says nothing,
 * the file name («Artista - Canción (feat. Otro).mp3») fills the gaps.
 */

export interface AudioTags {
  title?: string;
  artist?: string;
  album?: string;
  year?: number;
  genre?: string;
  picture?: Blob;
}

/** Bytes read from each end of the file: tags and covers live there. */
const HEAD_BYTES = 4 * 1024 * 1024;

/** The numeric genres of ID3v1 most often found in music files. */
const ID3_GENRES: Record<number, string> = {
  0: "Blues", 1: "Classic Rock", 2: "Country", 3: "Dance", 4: "Disco", 5: "Funk", 6: "Grunge", 7: "Hip-Hop", 8: "Jazz", 9: "Metal",
  10: "New Age", 11: "Oldies", 12: "Other", 13: "Pop", 14: "R&B", 15: "Rap", 16: "Reggae", 17: "Rock", 18: "Techno", 19: "Industrial",
  20: "Alternative", 21: "Ska", 22: "Death Metal", 24: "Soundtrack", 26: "Ambient", 28: "Vocal", 31: "Trance", 32: "Classical",
  33: "Instrumental", 34: "Acid", 35: "House", 37: "Sound Clip", 38: "Gospel", 40: "Alternative Rock", 41: "Bass", 42: "Soul",
  43: "Punk", 44: "Space", 52: "Electronic", 56: "Southern Rock", 57: "Comedy", 58: "Cult", 59: "Gangsta", 60: "Top 40",
  61: "Christian Rap", 62: "Pop/Funk", 66: "New Wave", 76: "Retro", 77: "Musical", 78: "Rock & Roll", 79: "Hard Rock", 80: "Folk",
  81: "Folk-Rock", 83: "Swing", 86: "Latin", 88: "Celtic", 89: "Bluegrass", 98: "Easy Listening", 99: "Acoustic", 101: "Speech",
  102: "Chanson", 105: "Symphony", 109: "Primus", 113: "Tango", 114: "Samba", 115: "Folklore", 116: "Ballad", 117: "Power Ballad",
  121: "Punk Rock", 125: "Dance Hall", 129: "Hardcore", 130: "Terror", 131: "Indie", 137: "Heavy Metal", 140: "Contemporary Christian",
  141: "Christian Rock", 142: "Merengue", 143: "Salsa", 145: "Anime", 147: "Synthpop",
};

const latin1 = new TextDecoder("latin1");
const utf8 = new TextDecoder("utf-8");

function clean(text: string | undefined): string | undefined {
  const value = text?.replace(/\0/g, "").trim();
  return value ? value : undefined;
}

function decode(bytes: Uint8Array, encoding: number): string {
  if (encoding === 1 || encoding === 2) {
    let little = encoding === 1;
    let start = 0;
    if (encoding === 1 && bytes[0] === 0xfe && bytes[1] === 0xff) little = false;
    if (encoding === 1 && (bytes[0] === 0xff || bytes[0] === 0xfe)) start = 2;
    return new TextDecoder(little ? "utf-16le" : "utf-16be").decode(bytes.subarray(start));
  }
  return (encoding === 3 ? utf8 : latin1).decode(bytes);
}

function genreName(raw: string | undefined): string | undefined {
  const value = clean(raw);
  if (!value) return undefined;
  const numeric = value.match(/^\(?(\d+)\)?$/);
  if (numeric) return ID3_GENRES[Number(numeric[1])];
  return value.replace(/^\(\d+\)/, "") || undefined;
}

function year(raw: string | undefined): number | undefined {
  const match = raw?.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : undefined;
}

function syncsafe(view: DataView, offset: number) {
  return ((view.getUint8(offset) & 0x7f) << 21) | ((view.getUint8(offset + 1) & 0x7f) << 14) | ((view.getUint8(offset + 2) & 0x7f) << 7) | (view.getUint8(offset + 3) & 0x7f);
}

function readId3v2(buffer: ArrayBuffer): AudioTags | null {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return null;
  const view = new DataView(buffer);
  const version = bytes[3];
  const size = Math.min(syncsafe(view, 6) + 10, bytes.length);
  let offset = 10;
  if (bytes[5] & 0x40) offset += version === 4 ? syncsafe(view, 10) : view.getUint32(10) + 4;

  const tags: AudioTags = {};
  const idLength = version === 2 ? 3 : 4;
  while (offset + idLength * 2 < size) {
    const id = latin1.decode(bytes.subarray(offset, offset + idLength));
    if (!/^[A-Z0-9]+$/.test(id)) break;
    const frameSize = version === 2
      ? (bytes[offset + 3] << 16) | (bytes[offset + 4] << 8) | bytes[offset + 5]
      : version === 4 ? syncsafe(view, offset + 4) : view.getUint32(offset + 4);
    const header = version === 2 ? 6 : 10;
    const body = bytes.subarray(offset + header, Math.min(size, offset + header + frameSize));
    offset += header + frameSize;
    if (frameSize <= 0 || body.length === 0) continue;

    const text = () => clean(decode(body.subarray(1), body[0]).split("\0").filter(Boolean)[0]);
    switch (id) {
      case "TIT2": case "TT2": tags.title ??= text(); break;
      case "TPE1": case "TP1": tags.artist ??= text(); break;
      case "TALB": case "TAL": tags.album ??= text(); break;
      case "TYER": case "TDRC": case "TYE": case "TDRL": tags.year ??= year(text()); break;
      case "TCON": case "TCO": tags.genre ??= genreName(text()); break;
      case "APIC": case "PIC": {
        if (tags.picture) break;
        const encoding = body[0];
        let cursor = 1;
        let mime = "image/jpeg";
        if (id === "APIC") {
          const end = body.indexOf(0, cursor);
          mime = latin1.decode(body.subarray(cursor, end)) || mime;
          cursor = end + 1;
        } else {
          mime = latin1.decode(body.subarray(cursor, cursor + 3)).toLowerCase() === "png" ? "image/png" : mime;
          cursor += 3;
        }
        cursor += 1;
        const wide = encoding === 1 || encoding === 2;
        while (cursor < body.length && !(wide ? body[cursor] === 0 && body[cursor + 1] === 0 : body[cursor] === 0)) cursor += wide ? 2 : 1;
        cursor += wide ? 2 : 1;
        if (cursor < body.length) tags.picture = new Blob([body.slice(cursor)], { type: mime.includes("/") ? mime : `image/${mime}` });
        break;
      }
    }
  }
  return tags;
}

function readId3v1(buffer: ArrayBuffer): AudioTags | null {
  const bytes = new Uint8Array(buffer);
  const start = bytes.length - 128;
  if (start < 0 || latin1.decode(bytes.subarray(start, start + 3)) !== "TAG") return null;
  const field = (from: number, length: number) => clean(latin1.decode(bytes.subarray(start + from, start + from + length)));
  return { title: field(3, 30), artist: field(33, 30), album: field(63, 30), year: year(field(93, 4)), genre: ID3_GENRES[bytes[start + 127]] };
}

/** Vorbis comments ("TITLE=…") found anywhere in the head of a FLAC or OGG file. */
function readVorbis(buffer: ArrayBuffer): AudioTags | null {
  const bytes = new Uint8Array(buffer);
  const magic = latin1.decode(bytes.subarray(0, 4));
  if (magic !== "fLaC" && magic !== "OggS") return null;
  const view = new DataView(buffer);
  const marker = magic === "fLaC" ? null : [0x03, 0x76, 0x6f, 0x72, 0x62, 0x69, 0x73];
  let offset = -1;
  if (marker) {
    for (let index = 0; index < bytes.length - 8 && offset < 0; index++) {
      if (marker.every((byte, at) => bytes[index + at] === byte)) offset = index + 7;
      else if (latin1.decode(bytes.subarray(index, index + 8)) === "OpusTags") offset = index + 8;
    }
  } else {
    let cursor = 4;
    while (cursor + 4 < bytes.length && offset < 0) {
      const type = bytes[cursor] & 0x7f;
      const length = (bytes[cursor + 1] << 16) | (bytes[cursor + 2] << 8) | bytes[cursor + 3];
      if (type === 4) offset = cursor + 4;
      if (bytes[cursor] & 0x80) break;
      cursor += 4 + length;
    }
  }
  if (offset < 0 || offset + 8 > bytes.length) return null;

  const vendor = view.getUint32(offset, true);
  let cursor = offset + 4 + vendor;
  const count = cursor + 4 <= bytes.length ? view.getUint32(cursor, true) : 0;
  cursor += 4;
  const tags: AudioTags = {};
  for (let index = 0; index < count && cursor + 4 <= bytes.length; index++) {
    const length = view.getUint32(cursor, true);
    const [key, ...rest] = utf8.decode(bytes.subarray(cursor + 4, cursor + 4 + length)).split("=");
    cursor += 4 + length;
    const value = clean(rest.join("="));
    switch (key.toUpperCase()) {
      case "TITLE": tags.title ??= value; break;
      case "ARTIST": tags.artist ??= value; break;
      case "ALBUM": tags.album ??= value; break;
      case "DATE": case "YEAR": tags.year ??= year(value); break;
      case "GENRE": tags.genre ??= genreName(value); break;
    }
  }
  return tags;
}

/** The iTunes atoms (©nam, ©ART, ©alb, ©day, ©gen, covr) of an M4A file. */
function readMp4(buffer: ArrayBuffer): AudioTags | null {
  const bytes = new Uint8Array(buffer);
  if (latin1.decode(bytes.subarray(4, 8)) !== "ftyp") return null;
  const view = new DataView(buffer);
  const tags: AudioTags = {};
  const names: Record<string, keyof AudioTags> = { "©nam": "title", "©ART": "artist", "©alb": "album", "©day": "year", "©gen": "genre" };
  const walk = (start: number, end: number) => {
    let cursor = start;
    while (cursor + 8 <= end) {
      const size = view.getUint32(cursor);
      const type = latin1.decode(bytes.subarray(cursor + 4, cursor + 8));
      if (size < 8 || cursor + size > end) return;
      if (["moov", "udta", "ilst"].includes(type)) walk(cursor + 8, cursor + size);
      else if (type === "meta") walk(cursor + 12, cursor + size);
      else if (type in names || type === "covr") {
        const data = bytes.subarray(cursor + 24, cursor + size);
        const flags = view.getUint32(cursor + 16) & 0xffffff;
        if (type === "covr") tags.picture ??= new Blob([data.slice()], { type: flags === 14 ? "image/png" : "image/jpeg" });
        else if (names[type] === "year") tags.year ??= year(utf8.decode(data));
        else (tags as Record<string, unknown>)[names[type]] ??= clean(utf8.decode(data));
      }
      cursor += size;
    }
  };
  walk(0, bytes.length);
  return tags;
}

/** «Rubén Blades - Pedro Navaja (feat. X) [Official Video].mp3» → artist and title. */
export function fromFileName(name: string): Pick<AudioTags, "title" | "artist"> {
  const base = name.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/_/g, " ").replace(/^\d{1,3}[\s.\-)]+/, "").trim();
  const parts = base.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) return { artist: clean(parts[0]), title: clean(parts.slice(1).join(" - ")) };
  return { title: clean(base) };
}

export async function readTags(file: File): Promise<AudioTags> {
  const head = await file.slice(0, HEAD_BYTES).arrayBuffer();
  let tags: AudioTags | null = readId3v2(head) ?? readVorbis(head) ?? readMp4(head);
  if (!tags?.title && file.size > 128) {
    const tail = readId3v1(await file.slice(file.size - 128).arrayBuffer());
    tags = { ...tail, ...Object.fromEntries(Object.entries(tags ?? {}).filter(([, value]) => value !== undefined)) };
  }
  const named = fromFileName(file.name);
  return { ...tags, title: tags?.title ?? named.title, artist: tags?.artist ?? named.artist };
}
