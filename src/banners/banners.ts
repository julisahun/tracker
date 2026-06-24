import {
  readFile,
  createFile,
  createDirectory,
  createFileFromBlob,
  deleteEntry,
} from "../fs/directory";

// Image banners shown at the top of the dashboard and item editor. Like the
// schema, dashboard and phrases config, the mapping lives on disk at
// `<root>/.tracker/banners.json` and the images themselves under
// `<root>/.tracker/banner-images/`. Each banner is keyed by a "scope": the empty
// string is the general/root banner; any other key is a folder's tree path (the
// same string used by `dashboardScope`). There is no inheritance — a view shows
// a banner only if one is set for its exact scope key.

const SCHEMA_DIR = ".tracker";
const BANNERS_FILE = "banners.json";
/** Folder under `.tracker/` where banner images live, referenced by filename. */
export const BANNER_IMAGES_DIR = "banner-images";

/** Map of scope key (`""` = root) to image filename in `.tracker/banner-images/`. */
export interface Banners {
  banners: Record<string, string>;
}

export function defaultBanners(): Banners {
  return { banners: {} };
}

// ---- Pure helpers (tested) ---------------------------------------------

/** A filesystem-safe stem for a scope key. `""` (root) → `"root"`; path
 *  separators become `__` so nested folders stay distinct and flat. */
export function sanitizeKey(key: string): string {
  if (key === "") return "root";
  return key.replace(/[^a-zA-Z0-9-]+/g, "__");
}

/** File extension for a given image MIME type, defaulting to `png`. */
export function extForType(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/svg+xml":
      return "svg";
    case "image/avif":
      return "avif";
    case "image/png":
    default:
      return "png";
  }
}

// ---- Config IO over the root directory handle --------------------------

async function readBannersFile(
  root: FileSystemDirectoryHandle,
): Promise<string | null> {
  try {
    const dir = await root.getDirectoryHandle(SCHEMA_DIR);
    const file = await dir.getFileHandle(BANNERS_FILE);
    return await readFile(file);
  } catch {
    return null;
  }
}

export async function loadBanners(
  root: FileSystemDirectoryHandle,
): Promise<Banners | null> {
  const raw = await readBannersFile(root);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.banners === "object" && parsed.banners) {
      return parsed as Banners;
    }
  } catch {
    /* fall through */
  }
  return null;
}

export async function saveBanners(
  root: FileSystemDirectoryHandle,
  banners: Banners,
): Promise<void> {
  const dir = await createDirectory(root, SCHEMA_DIR);
  await createFile(dir, BANNERS_FILE, JSON.stringify(banners, null, 2) + "\n");
}

/**
 * Return the saved banners, or seed an empty config on first open. Mirrors
 * `ensurePhrases`: best-effort creates the `.tracker/banner-images/` drop folder
 * so it's discoverable, and falls back to in-memory defaults when read-only.
 */
export async function ensureBanners(
  root: FileSystemDirectoryHandle,
): Promise<Banners> {
  try {
    const dir = await createDirectory(root, SCHEMA_DIR);
    await createDirectory(dir, BANNER_IMAGES_DIR);
  } catch {
    /* read-only or permission issue */
  }

  const existing = await loadBanners(root);
  if (existing) return existing;
  const seed = defaultBanners();
  try {
    await saveBanners(root, seed);
  } catch {
    /* read-only or permission issue — fall back to in-memory defaults */
  }
  return seed;
}

// ---- Image IO ----------------------------------------------------------

/** Write a banner image blob into `.tracker/banner-images/` under `name`. */
export async function writeBannerImage(
  root: FileSystemDirectoryHandle,
  name: string,
  blob: Blob,
): Promise<void> {
  const dir = await createDirectory(root, SCHEMA_DIR);
  const imagesDir = await createDirectory(dir, BANNER_IMAGES_DIR);
  await createFileFromBlob(imagesDir, name, blob);
}

/** Best-effort delete of a banner image; ignores a missing file. */
export async function deleteBannerImage(
  root: FileSystemDirectoryHandle,
  name: string,
): Promise<void> {
  try {
    const dir = await root.getDirectoryHandle(SCHEMA_DIR);
    const imagesDir = await dir.getDirectoryHandle(BANNER_IMAGES_DIR);
    await deleteEntry(imagesDir, name, false);
  } catch {
    /* already gone or read-only */
  }
}
