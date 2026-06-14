import { readFile, createFile, createDirectory } from "../fs/directory";

// Motivational phrases shown on the dashboard. Like the schema and dashboard
// config, the list lives on disk at `<root>/.tracker/phrases.json` and is seeded
// with defaults on first open. There is intentionally no in-app editor — the file
// exists for transparency/portability, not for editing through the UI. One phrase
// is chosen per calendar day (see `phraseForDay`), so it stays stable across
// reloads within a day and changes at midnight.

const SCHEMA_DIR = ".tracker";
const PHRASES_FILE = "phrases.json";
/** Folder under `.tracker/` where phrase images live, referenced by filename. */
export const PHRASE_IMAGES_DIR = "phrase-images";

/** A phrase entry, normalized. `image` is a filename in `.tracker/phrase-images/`. */
export interface PhraseItem {
  text?: string;
  image?: string;
}

/** On-disk form: a bare string (text only) or an object with optional image. */
export type PhraseEntry = string | PhraseItem;

export interface Phrases {
  phrases: PhraseEntry[];
}

/** Coerce a stored entry (string or object) to a normalized `PhraseItem`. */
export function normalizePhrase(entry: PhraseEntry): PhraseItem {
  return typeof entry === "string"
    ? { text: entry }
    : { text: entry.text, image: entry.image };
}

export function defaultPhrases(): Phrases {
  return {
    phrases: [
      "No estoy procrastinando, estoy en fase de incubación cognitiva.",
      "Mi cerebro tiene dos modos: opositar y buscar excusas validadas científicamente.",
      "Pavlov me suena… (y empiezo a estudiar automáticamente).",
      "Refuerzo positivo: si apruebo, me como el temario… digo, una pizza.",
      "No tengo ansiedad, tengo activación fisiológica anticipatoria.",
      "Skinner me programó para estudiar a cambio de cafeína.",
      "El temario y yo tenemos una relación de apego ansioso-evitativo.",
      "Hoy mi sesgo de confirmación dice que voy a aprobar.",
      "Maslow no incluyó 'aprobar la oposición' en su pirámide, pero debería.",
      "Estudio Psicología para entender por qué sigo opositando.",
      "Tu mente es tu superpoder. Entrénala con cariño.",
      "Pequeños pasos también activan grandes neuronas.",
      "Respira. Tu sistema nervioso también está de tu lado.",
      "Confía en el proceso… y en tu corteza prefrontal.",
      "Eres más fuerte que tu peor día de estudio.",
      "Cada repaso es un abrazo a tu futuro yo.",
      "Mente tranquila, opositora imparable.",
      "No estás sola: tú, tus apuntes y tu resiliencia.",
      "Hoy siembras sinapsis, mañana recoges plaza.",
      "El miedo es normal; rendirte no es una opción que elija tu yo valiente.",
      "Opositora con mente de psicóloga 🧠💛",
      "Plaza en proceso… cargando neuronas.",
      "Calma y dopamina.",
      "Resiliencia nivel oposición.",
      "Futura psicóloga, presente luchadora.",
    ],
  };
}

/** Whole days elapsed since the Unix epoch in local time. */
function dayNumber(date: Date): number {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor(local.getTime() / 86_400_000);
}

/**
 * Deterministic index into a list of `length` for the given day: the same date
 * always yields the same index, consecutive days advance, and it wraps around.
 * Returns -1 for an empty list.
 */
export function indexForDay(length: number, date: Date): number {
  if (length === 0) return -1;
  return ((dayNumber(date) % length) + length) % length;
}

/**
 * Pick the phrase item for the given day, normalized. Returns `null` for an
 * empty list. Used by the banner, which needs both text and image.
 */
export function phraseItemForDay(
  phrases: PhraseEntry[],
  date: Date,
): PhraseItem | null {
  const index = indexForDay(phrases.length, date);
  return index === -1 ? null : normalizePhrase(phrases[index]);
}

/**
 * Pick the text of the phrase for the given day. Deterministic and wrapping
 * (see `indexForDay`). Returns "" for an empty list. A string list in yields the
 * string back out.
 */
export function phraseForDay(phrases: PhraseEntry[], date: Date): string {
  return phraseItemForDay(phrases, date)?.text ?? "";
}

// ---- Config IO over the root directory handle --------------------------

async function readPhrasesFile(
  root: FileSystemDirectoryHandle,
): Promise<string | null> {
  try {
    const dir = await root.getDirectoryHandle(SCHEMA_DIR);
    const file = await dir.getFileHandle(PHRASES_FILE);
    return await readFile(file);
  } catch {
    return null;
  }
}

export async function loadPhrases(
  root: FileSystemDirectoryHandle,
): Promise<Phrases | null> {
  const raw = await readPhrasesFile(root);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.phrases)) return parsed as Phrases;
  } catch {
    /* fall through */
  }
  return null;
}

export async function savePhrases(
  root: FileSystemDirectoryHandle,
  phrases: Phrases,
): Promise<void> {
  const dir = await createDirectory(root, SCHEMA_DIR);
  await createFile(dir, PHRASES_FILE, JSON.stringify(phrases, null, 2) + "\n");
}

/**
 * Return the saved phrases, or seed the file with defaults on first open and
 * return those. Mirrors `ensureDashboard`, but persists the seed so the list is
 * present on disk from the start.
 */
export async function ensurePhrases(
  root: FileSystemDirectoryHandle,
): Promise<Phrases> {
  // Make the image drop-folder discoverable so users know where to put files
  // they want to reference from phrases.json. Best-effort; ignore read-only.
  try {
    const dir = await createDirectory(root, SCHEMA_DIR);
    await createDirectory(dir, PHRASE_IMAGES_DIR);
  } catch {
    /* read-only or permission issue */
  }

  const existing = await loadPhrases(root);
  if (existing) return existing;
  const seed = defaultPhrases();
  try {
    await savePhrases(root, seed);
  } catch {
    /* read-only or permission issue — fall back to in-memory defaults */
  }
  return seed;
}
