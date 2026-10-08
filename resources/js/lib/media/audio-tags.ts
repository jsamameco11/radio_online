/**
 * Recognizes a song from its own file, in the browser and before uploading: the tags music files
 * carry (ID3 in MP3 and AAC, atoms in M4A, Vorbis comments in FLAC, OGG and Opus, INFO in WAV) and,
 * when a file says nothing, its name («Artista - Canción (feat. Otro).mp3»).
 */

export interface AudioTags {
  title?: string;
  artist?: string;
  /** Guests of the song («feat.», «ft.», several authors), main artist excluded. */
  featured?: string[];
  album?: string;
  year?: number;
  genre?: string;
  picture?: Blob;
  /** Where the title and artist came from: the file's tags, its name, or neither. */
  source?: "tags" | "name" | "none";
}

/** Authors already known (in the library or repeated across the files being added), by their lowercase name. */
export type ArtistHints = Map<string, string>;

export interface ParsedName {
  title: string;
  artist: string;
  featured: string[];
}

export const MAX_FEATURED = 4;

/** Covers larger than this are left out (the library accepts up to 8 MB). */
const MAX_COVER_BYTES = 8 * 1024 * 1024;

/** Metadata blocks are read up to this size; covers usually take well under 2 MB. */
const MAX_HEADER_BYTES = 24 * 1024 * 1024;

type RawTags = { title?: string; artists?: string[]; albumArtist?: string; album?: string; year?: string; genre?: string; cover?: Blob | null };

export async function readTags(file: File, hints: ArtistHints = new Map()): Promise<AudioTags> {
  let tags: RawTags | null = null;
  try {
    tags = await readRaw(file);
  } catch {
    tags = null;
  }
  const fromName = parseFileName(file.name, hints);

  let tagTitle = clean(tags?.title);
  let tagArtists = (tags?.artists ?? []).flatMap(splitCredits).filter(Boolean);
  if (!tagArtists.length && tags?.albumArtist) tagArtists.push(...splitCredits(tags.albumArtist));

  // Downloads often keep «Song - Author» in the title tag, and the channel as the author.
  if (tagTitle && namedSides(withoutNoise(tagTitle)).length >= 2) {
    const tagged = new Map(hints);
    tagArtists.forEach((name) => tagged.set(key(name), name));
    const split = parseName(withoutNoise(tagTitle), tagged);
    const credited = split.artist && (hints.has(key(split.artist)) || tagArtists.some((name) => key(name) === key(split.artist)));
    if (split.title && (credited || !tagArtists.length)) {
      tagTitle = split.title;
      tagArtists = unique([split.artist, ...split.featured, ...tagArtists.filter((name) => credited && hints.has(key(name)))]);
    }
  }

  const titled = cleanTitle(tagTitle || fromName.title);
  const artists = tagArtists.length ? tagArtists.map(tidyName) : [fromName.artist, ...fromName.featured].filter(Boolean);
  const [artist = "", ...rest] = unique([...artists, ...titled.featured]);
  const year = yearOf(tags?.year);

  return {
    title: optional(tidyTitle(titled.title).slice(0, 160)),
    artist: optional(artist.slice(0, 120)),
    featured: rest.length ? rest.slice(0, MAX_FEATURED).map((name) => name.slice(0, 120)) : undefined,
    album: optional(clean(tags?.album).slice(0, 160)),
    year: year ? Number(year) : undefined,
    genre: optional(normalizeGenre(tags?.genre).slice(0, 60)),
    picture: tags?.cover && tags.cover.size <= MAX_COVER_BYTES ? tags.cover : undefined,
    source: tagTitle || tagArtists.length ? "tags" : fromName.artist ? "name" : "none",
  };
}

/** «Rubén Blades - Pedro Navaja (feat. X) [Official Video].mp3» → artist, title and guests. */
export function fromFileName(name: string, hints: ArtistHints = new Map()): Pick<AudioTags, "title" | "artist" | "featured"> {
  const parsed = parseFileName(name, hints);
  return {
    title: optional(parsed.title),
    artist: optional(parsed.artist),
    featured: parsed.featured.length ? parsed.featured.slice(0, MAX_FEATURED) : undefined,
  };
}

function optional(value: string): string | undefined {
  return value || undefined;
}

/* ------------------------------------------------------------------ names */

/** What the computer adds to a copied or re-downloaded file: «… (1)», «… - copia», «… - Copy (2)». */
const COPY_MARK = /(?:\s*[-–—]\s*(?:copia|copy)(?:\s*\(\d{1,2}\))?|\s*\(\d{1,2}\))\s*$/i;

const NOISE = /\s*[([][^)\]]*\b(?:official|oficial|video|vídeo|audio|lyrics?|letra|visualizer|videoclip|videolyrics?|hd|hq|4k|1080p|720p|kbps|mp3)\b[^)\]]*[)\]]/gi;

/**
 * Labels that videos and downloads add around a song name without brackets:
 * «VideoLyric Pedro Navaja», «Pedro Navaja Lyrics», «Pedro Navaja - Video Oficial», «Pedro Navaja Con Letra HD».
 */
const LOOSE_LABEL = String.raw`(?:(?:official|oficial)\s+)?(?:music\s+)?(?:video\s*-?\s*lyrics?|lyrics?\s*-?\s*video|videolyrics?|lyricvideo|v[ií]deo\s*clip|videoclip|v[ií]deo|lyrics?|con\s+letra|letra|audio|visualizer|visualizador|clip)(?:\s+(?:official|oficial))?|(?:official|oficial)|hd|hq|4k|1080p|720p|480p|\d{2,3}\s*kbps|mp3|descargar|download|estreno|premiere`;
/** At the start only labels that are never part of a name («Audioslave» and «Audio Adrenalina» keep their «Audio»). */
const START_LABEL = String.raw`videolyrics?|lyricvideo|video\s*-?\s*lyrics?|lyrics?\s*-?\s*video|(?:official|oficial)\s+(?:music\s+)?(?:video|v[ií]deo|audio)|(?:video|v[ií]deo|audio)\s+(?:official|oficial)|estreno|premiere`;
const LABEL_AT_START = new RegExp(String.raw`^(?:(?:${START_LABEL})\b[\s:|·.-]*)+`, "i");
const LABEL_AT_END = new RegExp(String.raw`(?:[\s:|·.-]*\b(?:${LOOSE_LABEL}))+[\s:|·.-]*$`, "i");
const FEAT_IN_TITLE = /\s*[([]\s*(?:feat\.?|ft\.?|featuring|con)\s+([^)\]]+)[)\]]/i;
const FEAT_AT_END = /\s+(?:feat\.?|ft\.?|featuring)\s+(.+)$/i;
const FEAT_SPLIT = /\s+(?:feat\.?|ft\.?|featuring)\s+/i;
const SEPARATOR = /\s+[-–—|]\s+/g;

const key = (name: string) => clean(name).toLocaleLowerCase("es");

/** File name without extension, copy marks, track number, @mentions and video noise. */
function baseName(name: string): string {
  return withoutNoise(name.replace(/\.[a-z0-9]{2,5}$/i, "").replace(COPY_MARK, ""));
}

/** A name without underscores, track number, @mentions and bracketed video noise. */
function withoutNoise(name: string): string {
  return name
    .replace(/_+/g, " ")
    .replace(NOISE, "")
    .replace(/[([]?\s*\b(?:feat\.?|ft\.?|featuring)\s+@[\w.]+(?:\s*(?:,|&|\by\b|\band\b|\bx\b)\s*@[\w.]+)*\s*[)\]]?/giu, " ")
    .replace(/(^|\s)@[\w.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\d{1,3}\s*[-.)]\s*/, "");
}

/** Splits «A - B - C» on the dashes that are not inside parentheses. */
function sides(text: string): string[] {
  const parts: string[] = [];
  let start = 0;
  for (const match of text.matchAll(SEPARATOR)) {
    const at = match.index ?? 0;
    const before = text.slice(0, at);
    const depth = (before.match(/[([]/g)?.length ?? 0) - (before.match(/[)\]]/g)?.length ?? 0);
    if (depth > 0) continue;
    parts.push(text.slice(start, at));
    start = at + match[0].length;
  }
  parts.push(text.slice(start));
  return parts.map(clean).filter(Boolean);
}

/** A side of the name without the video labels at its edges, and whether it had any. */
function unlabeled(side: string): { text: string; labeled: boolean } {
  const text = clean(side.replace(LABEL_AT_START, "").replace(LABEL_AT_END, ""));
  return { text, labeled: text !== clean(side) };
}

/** The sides of a file name that hold words, with the video labels taken out. */
function namedSides(base: string): { text: string; labeled: boolean }[] {
  return sides(base)
    .map(unlabeled)
    .filter((side) => /[\p{L}\p{N}]/u.test(side.text));
}

/** The known author a text starts or ends with, and the rest of it: «Rubén Blades Pedro Navaja». */
function authorAtEdge(text: string, hints: ArtistHints): { artist: string; title: string } | null {
  const lower = text.toLocaleLowerCase("es");
  let best: { artist: string; title: string; length: number } | null = null;
  for (const [hint] of hints) {
    if (hint.length < 3 || (best && hint.length <= best.length)) continue;
    if (lower.startsWith(hint) && /^[\s,.:-]/.test(text.slice(hint.length))) {
      best = { artist: text.slice(0, hint.length), title: text.slice(hint.length), length: hint.length };
    } else if (lower.endsWith(hint) && /[\s,.:-]$/.test(text.slice(0, text.length - hint.length))) {
      best = { artist: text.slice(text.length - hint.length), title: text.slice(0, text.length - hint.length), length: hint.length };
    }
  }
  if (!best) return null;
  const title = clean(best.title.replace(/^[\s,.:-]+|[\s,.:-]+$/g, ""));
  return /[\p{L}\p{N}]/u.test(title) ? { artist: best.artist, title } : null;
}

/**
 * Authors to recognize in file names: those of the library, and any name that appears on one side of
 * the dash in two or more of the files being added («Soda Stereo - Persiana americana», «Soda Stereo - De música ligera»).
 */
export function artistHints(fileNames: string[], library: string[] = []): ArtistHints {
  const hints: ArtistHints = new Map();
  const add = (name: string) => {
    const current = hints.get(key(name));
    if (!current || (isShouting(current) && !isShouting(name))) hints.set(key(name), clean(name));
  };
  library.filter(Boolean).forEach(add);
  const known = new Set(hints.keys());
  const seen = new Map<string, { count: number; name: string }>();
  for (const fileName of fileNames) {
    const parts = namedSides(baseName(fileName)).map((side) => side.text);
    if (parts.length < 2) continue;
    const credits = [splitCredits(parts[0])[0], splitCredits(parts.slice(1).join(" - "))[0]].filter(Boolean);
    // Next to a known author, the other side is the song, even when several files repeat it.
    if (credits.some((name) => known.has(key(name)))) continue;
    for (const name of new Set(credits)) {
      const entry = seen.get(key(name)) ?? { count: 0, name };
      entry.count++;
      if (isShouting(entry.name) && !isShouting(name)) entry.name = name;
      seen.set(key(name), entry);
    }
  }
  seen.forEach((entry) => entry.count > 1 && add(entry.name));
  return hints;
}

/**
 * «Soda Stereo - Persiana americana (Video Oficial).mp3» → author «Soda Stereo», song «Persiana americana».
 * The author may come first or last («VideoLyric Persiana americana - Soda Stereo»): a known author,
 * several names or a «ft.» point to the author's side, and the video labels («VideoLyric», «Letra») to
 * the song's; otherwise the first side is the author's.
 */
export function parseFileName(name: string, hints: ArtistHints = new Map()): ParsedName {
  return parseName(baseName(name), hints);
}

/** Author, song and guests of a name already free of extension and track number. */
function parseName(base: string, hints: ArtistHints): ParsedName {
  const parts = namedSides(base);
  let titleText = unlabeled(base).text;
  let artistText = "";

  if (parts.length >= 2) {
    const first = parts[0];
    const last = { text: parts.slice(1).map((side) => side.text).join(" - "), labeled: parts.slice(1).some((side) => side.labeled) };
    const score = (side: { text: string; labeled: boolean }) => {
      const credits = splitCredits(side.text);
      const known = hints.has(key(credits[0] ?? "")) ? 6 : authorAtEdge(side.text, hints) ? 2 : 0;
      return known + (credits.length > 1 ? 3 : 0) + (isShouting(side.text) ? 1 : 0) - (side.labeled ? 2 : 0);
    };
    [artistText, titleText] = score(last) > score(first) ? [last.text, first.text] : [first.text, last.text];
  } else {
    const edge = authorAtEdge(titleText, hints);
    if (edge) {
      artistText = edge.artist;
      titleText = edge.title;
    }
  }

  const titled = cleanTitle(titleText);
  const [artist = "", ...featured] = splitCredits(artistText).map((credit) => hints.get(key(credit)) ?? tidyName(credit));
  return { title: tidyTitle(titled.title), artist, featured: unique([...featured, ...titled.featured.map(tidyName)]) };
}

/** «Rubén Blades feat. Willie Colón & Héctor Lavoe» → the author first, then the guests. */
export function splitCredits(text: string): string[] {
  const value = clean(text);
  if (!value) return [];
  const [main, ...guests] = value.split(FEAT_SPLIT);
  const names = [...main.split(/\s*[;/,+]\s*|\s+[&x]\s+/i), ...guests.flatMap((guest) => guest.split(/\s*[;/,&+]\s*|\s+(?:y|and|x)\s+/i))];
  return unique(names.map(clean).filter(Boolean));
}

/** Takes «(feat. …)» and video noise out of a song name; the guests are returned apart. */
export function cleanTitle(text: string): { title: string; featured: string[] } {
  let title = unlabeled(clean(text).replace(NOISE, "")).text || clean(text);
  const featured: string[] = [];
  const inParens = title.match(FEAT_IN_TITLE);
  if (inParens) {
    featured.push(...splitCredits(inParens[1]));
    title = title.replace(FEAT_IN_TITLE, "");
  }
  const atEnd = title.match(FEAT_AT_END);
  if (atEnd) {
    featured.push(...splitCredits(atEnd[1]));
    title = title.replace(FEAT_AT_END, "");
  }
  return { title: clean(title), featured: unique(featured) };
}

/** A text written all in capitals (SODA STEREO). */
function isShouting(text: string): boolean {
  const letters = text.replace(/[^\p{L}]/gu, "");
  return letters.length > 3 && letters === letters.toLocaleUpperCase("es") && letters !== letters.toLocaleLowerCase("es");
}

/** SODA STEREO → Soda Stereo */
function tidyName(name: string): string {
  return isShouting(name) ? name.toLocaleLowerCase("es").replace(/(^|[\s(-])(\p{L})/gu, (_, space: string, letter: string) => space + letter.toLocaleUpperCase("es")) : name;
}

/** PERSIANA AMERICANA → Persiana americana */
function tidyTitle(title: string): string {
  if (!isShouting(title)) return title;
  const lower = title.toLocaleLowerCase("es");
  return lower.charAt(0).toLocaleUpperCase("es") + lower.slice(1);
}

function clean(value: string | undefined | null): string {
  return (value ?? "").replace(/\u0000/g, " ").replace(/\s+/g, " ").trim();
}

function unique(names: string[]): string[] {
  const seen = new Set<string>();
  return names.filter((name) => {
    const lower = name.toLocaleLowerCase("es");
    if (!name || seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}

function yearOf(value: string | undefined): string {
  const match = (value ?? "").match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : "";
}

/* ----------------------------------------------------------------- genres */

/** The numeric genres of ID3v1 and their Winamp extensions, by number. */
export const ID3_GENRES: readonly string[] = [
  "Blues", "Classic Rock", "Country", "Dance", "Disco", "Funk", "Grunge", "Hip-Hop", "Jazz", "Metal",
  "New Age", "Oldies", "Other", "Pop", "R&B", "Rap", "Reggae", "Rock", "Techno", "Industrial",
  "Alternative", "Ska", "Death Metal", "Pranks", "Soundtrack", "Euro-Techno", "Ambient", "Trip-Hop", "Vocal", "Jazz+Funk",
  "Fusion", "Trance", "Classical", "Instrumental", "Acid", "House", "Game", "Sound Clip", "Gospel", "Noise",
  "Alternative Rock", "Bass", "Soul", "Punk", "Space", "Meditative", "Instrumental Pop", "Instrumental Rock", "Ethnic", "Gothic",
  "Darkwave", "Techno-Industrial", "Electronic", "Pop-Folk", "Eurodance", "Dream", "Southern Rock", "Comedy", "Cult", "Gangsta",
  "Top 40", "Christian Rap", "Pop/Funk", "Jungle", "Native American", "Cabaret", "New Wave", "Psychedelic", "Rave", "Showtunes",
  "Trailer", "Lo-Fi", "Tribal", "Acid Punk", "Acid Jazz", "Polka", "Retro", "Musical", "Rock & Roll", "Hard Rock",
  "Folk", "Folk-Rock", "National Folk", "Swing", "Fast Fusion", "Bebop", "Latin", "Revival", "Celtic", "Bluegrass",
  "Avantgarde", "Gothic Rock", "Progressive Rock", "Psychedelic Rock", "Symphonic Rock", "Slow Rock", "Big Band", "Chorus", "Easy Listening", "Acoustic",
  "Humour", "Speech", "Chanson", "Opera", "Chamber Music", "Sonata", "Symphony", "Booty Bass", "Primus", "Porn Groove",
  "Satire", "Slow Jam", "Club", "Tango", "Samba", "Folklore", "Ballad", "Power Ballad", "Rhythmic Soul", "Freestyle",
  "Duet", "Punk Rock", "Drum Solo", "A Cappella", "Euro-House", "Dancehall", "Goa", "Drum & Bass", "Club-House", "Hardcore",
  "Terror", "Indie", "Britpop", "Afro-Punk", "Polsk Punk", "Beat", "Christian Gangsta Rap", "Heavy Metal", "Black Metal", "Crossover",
  "Contemporary Christian", "Christian Rock", "Merengue", "Salsa", "Thrash Metal", "Anime", "J-Pop", "Synthpop", "Abstract", "Art Rock",
  "Baroque", "Bhangra", "Big Beat", "Breakbeat", "Chillout", "Downtempo", "Dub", "EBM", "Eclectic", "Electro",
  "Electroclash", "Emo", "Experimental", "Garage", "Global", "IDM", "Illbient", "Industro-Goth", "Jam Band", "Krautrock",
  "Leftfield", "Lounge", "Math Rock", "New Romantic", "Nu-Breakz", "Post-Punk", "Post-Rock", "Psytrance", "Shoegaze", "Space Rock",
  "Trop Rock", "World Music", "Neoclassical", "Audiobook", "Audio Theatre", "Neue Deutsche Welle", "Podcast", "Indie Rock", "G-Funk", "Dubstep",
  "Garage Rock", "Psybient",
];

/**
 * Catalog genres for the names music stores and taggers use, keyed without accents or punctuation.
 * Every value is the name of a genre of the starter catalog.
 */
export const GENRE_ALIASES: Readonly<Record<string, string>> = {
  "hip hop rap": "Hip hop",
  "hip hop": "Hip hop",
  "r b soul": "R&B",
  "rhythm and blues": "R&B",
  "rhythmic soul": "Soul",
  alternative: "Rock alternativo",
  "alternative rock": "Rock alternativo",
  alternativo: "Rock alternativo",
  "singer songwriter": "Cantautor",
  "children s music": "Música infantil",
  kids: "Música infantil",
  soundtrack: "Banda sonora",
  "original soundtrack": "Banda sonora",
  classical: "Clásica",
  electronic: "Electrónica",
  electronica: "Electrónica",
  "latin pop": "Pop latino",
  "latin rock": "Rock en español",
  "rock en espanol": "Rock en español",
  "latin urban": "Urbano latino",
  urbano: "Urbano latino",
  reggaeton: "Reguetón",
  "musica mexicana": "Regional mexicano",
  "salsa y tropical": "Salsa",
  "musica tropical": "Tropical",
  "tropical latino": "Tropical",
  christmas: "Música navideña",
  holiday: "Música navideña",
  "world music": "Música del mundo",
  world: "Música del mundo",
  humour: "Comedia",
  comedy: "Comedia",
  speech: "Palabra hablada",
  "spoken word": "Palabra hablada",
  opera: "Ópera",
  metal: "Heavy metal",
  punk: "Punk rock",
  indie: "Indie rock",
  "j pop": "J-pop",
  "christian gospel": "Música cristiana",
  "contemporary christian": "Música cristiana",
  christian: "Música cristiana",
  worship: "Adoración",
  "praise worship": "Adoración",
};

const genreKey = (name: string) =>
  name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** «(17)», «17», «(17)Rock», «Hip-Hop/Rap» → the genre name the catalog uses when it knows it. */
export function normalizeGenre(raw: string | undefined): string {
  let value = clean(raw);
  const numbered = value.match(/^\(?(\d{1,3})\)?(.*)$/);
  if (numbered) value = clean(numbered[2]) || ID3_GENRES[Number(numbered[1])] || "";
  return GENRE_ALIASES[genreKey(value)] ?? value;
}

/* ------------------------------------------------------------------- bytes */

async function bytes(file: Blob, start: number, end: number): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(start, Math.min(end, file.size)).arrayBuffer());
}

const latin1 = new TextDecoder("iso-8859-1");
const utf8 = new TextDecoder("utf-8");

function ascii(data: Uint8Array, start: number, length: number): string {
  return latin1.decode(data.subarray(start, start + length));
}

function u32(data: Uint8Array, at: number): number {
  return ((data[at] << 24) >>> 0) + (data[at + 1] << 16) + (data[at + 2] << 8) + data[at + 3];
}

function u32le(data: Uint8Array, at: number): number {
  return data[at] + (data[at + 1] << 8) + (data[at + 2] << 16) + ((data[at + 3] << 24) >>> 0);
}

function syncsafe(data: Uint8Array, at: number): number {
  return ((data[at] & 0x7f) << 21) | ((data[at + 1] & 0x7f) << 14) | ((data[at + 2] & 0x7f) << 7) | (data[at + 3] & 0x7f);
}

function imageBlob(data: Uint8Array, mime = ""): Blob | null {
  let type = "";
  if (data[0] === 0xff && data[1] === 0xd8) type = "image/jpeg";
  else if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) type = "image/png";
  else if (ascii(data, 0, 4) === "RIFF" && ascii(data, 8, 4) === "WEBP") type = "image/webp";
  else if (/jpe?g/i.test(mime)) type = "image/jpeg";
  else if (/png/i.test(mime)) type = "image/png";
  return type && data.length > 64 ? new Blob([data.slice()], { type }) : null;
}

/* -------------------------------------------------------------- dispatcher */

async function readRaw(file: File): Promise<RawTags | null> {
  const head = await bytes(file, 0, 64);
  const magic = ascii(head, 0, 4);

  if (ascii(head, 0, 3) === "ID3") {
    const size = 10 + syncsafe(head, 6) + (head[5] & 0x10 ? 10 : 0);
    const tag = readId3v2(await bytes(file, 0, Math.min(size, MAX_HEADER_BYTES)));
    const afterTag = await bytes(file, size, size + 4);
    if (ascii(afterTag, 0, 4) === "fLaC") return merge(tag, await readFlac(file, size));
    return merge(tag, await readId3v1(file));
  }
  if (magic === "fLaC") return readFlac(file, 0);
  if (magic === "OggS") return readOgg(file);
  if (ascii(head, 4, 4) === "ftyp") return readMp4(file);
  if (magic === "RIFF" && ascii(head, 8, 4) === "WAVE") return readWav(file);
  return readId3v1(file);
}

function merge(first: RawTags | null, second: RawTags | null): RawTags | null {
  if (!first) return second;
  if (!second) return first;
  return {
    title: first.title || second.title,
    artists: first.artists?.length ? first.artists : second.artists,
    albumArtist: first.albumArtist || second.albumArtist,
    album: first.album || second.album,
    year: first.year || second.year,
    genre: first.genre || second.genre,
    cover: first.cover ?? second.cover ?? null,
  };
}

/* ------------------------------------------------------------------- ID3v2 */

function removeUnsync(data: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length);
  let length = 0;
  for (let i = 0; i < data.length; i++) {
    out[length++] = data[i];
    if (data[i] === 0xff && data[i + 1] === 0x00) i++;
  }
  return out.subarray(0, length);
}

function decodeText(encoding: number, data: Uint8Array): string[] {
  let text: string;
  if (encoding === 0) text = latin1.decode(data);
  else if (encoding === 3) text = utf8.decode(data);
  else {
    let order = encoding === 2 ? "utf-16be" : "utf-16le";
    let body = data;
    if (data[0] === 0xfe && data[1] === 0xff) {
      order = "utf-16be";
      body = data.subarray(2);
    } else if (data[0] === 0xff && data[1] === 0xfe) {
      body = data.subarray(2);
    }
    text = new TextDecoder(order).decode(body).replace(/\ufeff/g, "");
  }
  return text
    .split("\u0000")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Length of a text ended by its terminator (one zero byte, or two for UTF-16). */
function terminated(encoding: number, data: Uint8Array, from: number): number {
  const wide = encoding === 1 || encoding === 2;
  for (let i = from; i < data.length; i += wide ? 2 : 1) {
    if (data[i] === 0 && (!wide || data[i + 1] === 0)) return i - from;
  }
  return data.length - from;
}

function readId3v2(tag: Uint8Array): RawTags | null {
  if (ascii(tag, 0, 3) !== "ID3") return null;
  const major = tag[3];
  const flags = tag[5];
  let data = tag.subarray(10, 10 + syncsafe(tag, 6));
  if (flags & 0x80 && major < 4) data = removeUnsync(data);

  let pos = 0;
  if (flags & 0x40) pos = major === 3 ? 4 + u32(data, 0) : syncsafe(data, 0);

  const tags: RawTags = {};
  let coverPicked = false;
  const headerSize = major === 2 ? 6 : 10;

  while (pos + headerSize <= data.length) {
    const id = ascii(data, pos, major === 2 ? 3 : 4);
    if (!/^[A-Z0-9]{3,4}$/.test(id)) break;
    const size = major === 2 ? (data[pos + 3] << 16) | (data[pos + 4] << 8) | data[pos + 5] : major === 4 ? syncsafe(data, pos + 4) : u32(data, pos + 4);
    const formatFlags = major === 2 ? 0 : data[pos + 9];
    let frame = data.subarray(pos + headerSize, pos + headerSize + size);
    pos += headerSize + size;
    if (!size) continue;

    if (major === 4) {
      if (formatFlags & 0x0c) continue;
      if (formatFlags & 0x02) frame = removeUnsync(frame);
      if (formatFlags & 0x01) frame = frame.subarray(4);
    } else if (major === 3) {
      if (formatFlags & 0xc0) continue;
      if (formatFlags & 0x20) frame = frame.subarray(1);
    }

    const text = () => decodeText(frame[0], frame.subarray(1));
    switch (id) {
      case "TIT2":
      case "TT2":
        tags.title ||= text()[0];
        break;
      case "TPE1":
      case "TP1":
        tags.artists = text();
        break;
      case "TPE2":
      case "TP2":
        tags.albumArtist ||= text()[0];
        break;
      case "TALB":
      case "TAL":
        tags.album ||= text()[0];
        break;
      case "TYER":
      case "TYE":
      case "TDRC":
      case "TDOR":
      case "TORY":
        tags.year ||= text()[0];
        break;
      case "TCON":
      case "TCO":
        tags.genre ||= text()[0];
        break;
      case "APIC":
      case "PIC": {
        const encoding = frame[0];
        let at = 1;
        let mime = "";
        if (id === "PIC") {
          mime = ascii(frame, 1, 3);
          at = 4;
        } else {
          const length = terminated(0, frame, 1);
          mime = ascii(frame, 1, length);
          at = 1 + length + 1;
        }
        const pictureType = frame[at];
        at += 1;
        at += terminated(encoding, frame, at) + (encoding === 1 || encoding === 2 ? 2 : 1);
        // The front cover (type 3) wins over any other picture of the file.
        if (coverPicked && pictureType !== 3) break;
        const cover = imageBlob(frame.subarray(at), mime);
        if (cover) {
          tags.cover = cover;
          coverPicked = pictureType === 3;
        }
        break;
      }
    }
  }
  return tags;
}

/* ------------------------------------------------------------------- ID3v1 */

async function readId3v1(file: File): Promise<RawTags | null> {
  if (file.size < 128) return null;
  const tail = await bytes(file, file.size - 128, file.size);
  if (ascii(tail, 0, 3) !== "TAG") return null;
  const field = (start: number, length: number) => clean(ascii(tail, start, length));
  return {
    title: field(3, 30),
    artists: field(33, 30) ? [field(33, 30)] : [],
    album: field(63, 30),
    year: field(93, 4),
    genre: ID3_GENRES[tail[127]],
  };
}

/* --------------------------------------------------- Vorbis comments, FLAC */

function vorbisComments(data: Uint8Array, at: number): RawTags {
  const tags: RawTags = {};
  const artists: string[] = [];
  const vendor = u32le(data, at);
  at += 4 + vendor;
  const count = u32le(data, at);
  at += 4;
  for (let i = 0; i < count && at + 4 <= data.length; i++) {
    const length = u32le(data, at);
    const comment = utf8.decode(data.subarray(at + 4, at + 4 + length));
    at += 4 + length;
    const split = comment.indexOf("=");
    if (split < 1) continue;
    const field = comment.slice(0, split).toUpperCase();
    const value = comment.slice(split + 1).trim();
    if (!value) continue;
    if (field === "TITLE") tags.title ||= value;
    else if (field === "ARTIST") artists.push(value);
    else if (field === "ALBUMARTIST" || field === "ALBUM ARTIST") tags.albumArtist ||= value;
    else if (field === "ALBUM") tags.album ||= value;
    else if (field === "DATE" || field === "YEAR") tags.year ||= value;
    else if (field === "GENRE") tags.genre ||= value;
    else if (field === "METADATA_BLOCK_PICTURE" && !tags.cover) tags.cover = embeddedPicture(value);
  }
  tags.artists = artists;
  return tags;
}

function embeddedPicture(base64: string): Blob | null {
  try {
    return flacPicture(Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)));
  } catch {
    return null;
  }
}

function flacPicture(data: Uint8Array): Blob | null {
  let at = 4;
  const mimeLength = u32(data, at);
  const mime = ascii(data, at + 4, mimeLength);
  at += 4 + mimeLength;
  at += 4 + u32(data, at);
  at += 16;
  const length = u32(data, at);
  return imageBlob(data.subarray(at + 4, at + 4 + length), mime);
}

async function readFlac(file: File, offset: number): Promise<RawTags | null> {
  let pos = offset + 4;
  let tags: RawTags | null = null;
  let cover: Blob | null = null;
  for (let guard = 0; guard < 64 && pos < Math.min(file.size, offset + MAX_HEADER_BYTES); guard++) {
    const header = await bytes(file, pos, pos + 4);
    if (header.length < 4) break;
    const last = header[0] & 0x80;
    const type = header[0] & 0x7f;
    const length = (header[1] << 16) | (header[2] << 8) | header[3];
    if (type === 4) tags = vorbisComments(await bytes(file, pos + 4, pos + 4 + length), 0);
    else if (type === 6 && !cover) cover = flacPicture(await bytes(file, pos + 4, pos + 4 + length));
    pos += 4 + length;
    if (last) break;
  }
  if (!tags && !cover) return null;
  return { ...(tags ?? {}), cover: tags?.cover ?? cover };
}

/* --------------------------------------------------------------- OGG, Opus */

async function readOgg(file: File): Promise<RawTags | null> {
  const data = await bytes(file, 0, MAX_HEADER_BYTES);
  const packets: Uint8Array[] = [];
  let current: number[] = [];
  let pos = 0;
  while (pos + 27 <= data.length && packets.length < 2) {
    if (ascii(data, pos, 4) !== "OggS") break;
    const segments = data[pos + 26];
    const table = data.subarray(pos + 27, pos + 27 + segments);
    let body = pos + 27 + segments;
    for (const length of table) {
      for (let i = 0; i < length; i++) current.push(data[body + i]);
      body += length;
      if (length < 255) {
        packets.push(Uint8Array.from(current));
        current = [];
        if (packets.length === 2) break;
      }
    }
    pos = body;
  }
  const comments = packets[1];
  if (!comments) return null;
  if (ascii(comments, 0, 8) === "OpusTags") return vorbisComments(comments, 8);
  if (comments[0] === 3 && ascii(comments, 1, 6) === "vorbis") return vorbisComments(comments, 7);
  return null;
}

/* -------------------------------------------------------------- M4A, MP4 */

async function readMp4(file: File): Promise<RawTags | null> {
  let pos = 0;
  for (let guard = 0; guard < 64 && pos + 8 <= file.size; guard++) {
    const header = await bytes(file, pos, pos + 16);
    let size = u32(header, 0);
    const type = ascii(header, 4, 4);
    if (size === 1) size = u32(header, 8) * 2 ** 32 + u32(header, 12);
    else if (size === 0) size = file.size - pos;
    if (size < 8) break;
    if (type === "moov") return mp4Tags(await bytes(file, pos, pos + Math.min(size, MAX_HEADER_BYTES)));
    pos += size;
  }
  return null;
}

function mp4Children(data: Uint8Array, start: number, end: number): { type: string; start: number; end: number }[] {
  const atoms = [];
  let pos = start;
  while (pos + 8 <= end) {
    const size = u32(data, pos);
    if (size < 8 || pos + size > end) break;
    atoms.push({ type: ascii(data, pos + 4, 4), start: pos + 8, end: pos + size });
    pos += size;
  }
  return atoms;
}

function mp4Tags(moov: Uint8Array): RawTags | null {
  const find = (start: number, end: number, type: string) => mp4Children(moov, start, end).find((atom) => atom.type === type);
  const udta = find(8, moov.length, "udta");
  const meta = udta && find(udta.start, udta.end, "meta");
  const ilst = meta && find(meta.start + 4, meta.end, "ilst");
  if (!ilst) return null;

  const tags: RawTags = {};
  for (const item of mp4Children(moov, ilst.start, ilst.end)) {
    const data = find(item.start, item.end, "data");
    if (!data) continue;
    const kind = u32(moov, data.start) & 0xffffff;
    const value = moov.subarray(data.start + 8, data.end);
    const text = () => utf8.decode(value).trim();
    switch (item.type) {
      case "\u00a9nam":
        tags.title = text();
        break;
      case "\u00a9ART":
        tags.artists = [text()];
        break;
      case "aART":
        tags.albumArtist = text();
        break;
      case "\u00a9alb":
        tags.album = text();
        break;
      case "\u00a9day":
        tags.year = text();
        break;
      case "\u00a9gen":
        tags.genre = text();
        break;
      case "gnre":
        tags.genre ||= ID3_GENRES[((value[0] << 8) | value[1]) - 1];
        break;
      case "covr":
        tags.cover ??= imageBlob(value, kind === 14 ? "image/png" : "image/jpeg");
        break;
    }
  }
  return tags;
}

/* --------------------------------------------------------------------- WAV */

async function readWav(file: File): Promise<RawTags | null> {
  let pos = 12;
  let tags: RawTags | null = null;
  for (let guard = 0; guard < 64 && pos + 8 <= file.size; guard++) {
    const header = await bytes(file, pos, pos + 12);
    const id = ascii(header, 0, 4);
    const size = u32le(header, 4);
    if (id === "LIST" && ascii(header, 8, 4) === "INFO") {
      const list = await bytes(file, pos + 12, pos + 8 + Math.min(size, MAX_HEADER_BYTES));
      const info: RawTags = { artists: [] };
      let at = 0;
      while (at + 8 <= list.length) {
        const field = ascii(list, at, 4);
        const length = u32le(list, at + 4);
        const value = clean(utf8.decode(list.subarray(at + 8, at + 8 + length)));
        if (field === "INAM") info.title = value;
        else if (field === "IART" && value) info.artists = [value];
        else if (field === "IPRD") info.album = value;
        else if (field === "ICRD") info.year = value;
        else if (field === "IGNR") info.genre = value;
        at += 8 + length + (length % 2);
      }
      tags = merge(tags, info);
    } else if (id === "id3 " || id === "ID3 ") {
      tags = merge(readId3v2(await bytes(file, pos + 8, pos + 8 + Math.min(size, MAX_HEADER_BYTES))), tags);
    }
    pos += 8 + size + (size % 2);
  }
  return tags;
}
