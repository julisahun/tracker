import { readFile, createFile, createDirectory } from "../fs/directory";

// The custom browser-tab favicon for a workspace. Like the schema, dashboard,
// phrases and banners config, the chosen image's filename lives on disk at
// `<root>/.tracker/favicon.json` and the image itself under
// `<root>/.tracker/favicon-images/`. Unlike banners there is a single favicon
// per workspace (not a per-scope map), since the tab icon is workspace-wide.

const SCHEMA_DIR = ".tracker";
const FAVICON_FILE = "favicon.json";
/** Folder under `.tracker/` where the favicon image lives, referenced by name. */
export const FAVICON_IMAGES_DIR = "favicon-images";

/** Filename of the custom favicon image in `.tracker/favicon-images/`, or null. */
export interface Favicon {
  favicon: string | null;
}

export function defaultFavicon(): Favicon {
  return { favicon: null };
}

// ---- Config IO over the root directory handle --------------------------

async function readFaviconFile(
  root: FileSystemDirectoryHandle,
): Promise<string | null> {
  try {
    const dir = await root.getDirectoryHandle(SCHEMA_DIR);
    const file = await dir.getFileHandle(FAVICON_FILE);
    return await readFile(file);
  } catch {
    return null;
  }
}

export async function loadFavicon(
  root: FileSystemDirectoryHandle,
): Promise<Favicon | null> {
  const raw = await readFaviconFile(root);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      (typeof parsed.favicon === "string" || parsed.favicon === null)
    ) {
      return { favicon: parsed.favicon };
    }
  } catch {
    /* fall through */
  }
  return null;
}

export async function saveFavicon(
  root: FileSystemDirectoryHandle,
  favicon: Favicon,
): Promise<void> {
  const dir = await createDirectory(root, SCHEMA_DIR);
  await createFile(dir, FAVICON_FILE, JSON.stringify(favicon, null, 2) + "\n");
}

/**
 * Return the saved favicon, or seed an empty config on first open. Mirrors
 * `ensureBanners`: best-effort creates the `.tracker/favicon-images/` drop folder
 * so it's discoverable, and falls back to in-memory defaults when read-only.
 */
export async function ensureFavicon(
  root: FileSystemDirectoryHandle,
): Promise<Favicon> {
  try {
    const dir = await createDirectory(root, SCHEMA_DIR);
    await createDirectory(dir, FAVICON_IMAGES_DIR);
  } catch {
    /* read-only or permission issue */
  }

  const existing = await loadFavicon(root);
  if (existing) return existing;
  const seed = defaultFavicon();
  try {
    await saveFavicon(root, seed);
  } catch {
    /* read-only or permission issue — fall back to in-memory defaults */
  }
  return seed;
}
