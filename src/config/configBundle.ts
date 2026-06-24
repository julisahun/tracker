// Import / export of the on-disk `.tracker` config as a single portable JSON
// bundle. A bundle gathers the config files (schema, dashboard, phrases, banners,
// favicon) plus every image under `.tracker/phrase-images/`,
// `.tracker/banner-images/` and `.tracker/favicon-images/`
// (base64-embedded, each tagged with its `dir`), so it round-trips a folder's
// entire configuration without touching the tracked items themselves.
//
// The bundle assembly (`makeBundle`) and validation (`parseBundle`) are pure
// and unit-tested; reading/writing images and applying a bundle to disk are the
// File System Access IO, kept here alongside the other config IO (schema.ts,
// dashboard.ts, phrases.ts) per the project convention.

import {
  createDirectory,
  createFileFromBlob,
  readFileAsBlob,
} from "../fs/directory";
import { saveSchema, type Schema } from "../schema/schema";
import { saveDashboard, type Dashboard } from "../dashboard/dashboard";
import { savePhrases, PHRASE_IMAGES_DIR, type Phrases } from "../phrases/phrases";
import { saveBanners, BANNER_IMAGES_DIR, type Banners } from "../banners/banners";
import {
  saveFavicon,
  FAVICON_IMAGES_DIR,
  type Favicon,
} from "../favicon/favicon";
import { saveCalendar, type Calendar } from "../calendar/calendar";

const TRACKER_DIR = ".tracker";
/** Marker so we can recognize (and reject non-) config bundles on import. */
export const BUNDLE_MARKER = "tracker-config-bundle";
export const BUNDLE_VERSION = 1;

/** One config image, embedded base64 (no `data:` prefix) with its MIME type.
 *  `dir` is the `.tracker` subfolder it belongs to; omitted means phrase-images
 *  (the original bundle shape, kept for backward compatibility). */
export interface BundleImage {
  name: string;
  type: string;
  data: string;
  dir?: string;
}

export interface ConfigBundle {
  tracker: typeof BUNDLE_MARKER;
  version: number;
  exportedAt: string;
  schema?: Schema;
  dashboard?: Dashboard;
  phrases?: Phrases;
  banners?: Banners;
  favicon?: Favicon;
  calendar?: Calendar;
  images?: BundleImage[];
}

export interface BundleParts {
  schema?: Schema;
  dashboard?: Dashboard;
  phrases?: Phrases;
  banners?: Banners;
  favicon?: Favicon;
  calendar?: Calendar;
  images?: BundleImage[];
  exportedAt: string;
}

export type ParseResult =
  | { ok: true; bundle: ConfigBundle }
  | { ok: false; error: string };

// ---- Pure: assemble & validate -----------------------------------------

/**
 * Assemble a bundle object from its parts. Only parts that are actually present
 * are included, so a bundle never claims to carry config it doesn't have.
 */
export function makeBundle(parts: BundleParts): ConfigBundle {
  const bundle: ConfigBundle = {
    tracker: BUNDLE_MARKER,
    version: BUNDLE_VERSION,
    exportedAt: parts.exportedAt,
  };
  if (parts.schema) bundle.schema = parts.schema;
  if (parts.dashboard) bundle.dashboard = parts.dashboard;
  if (parts.phrases) bundle.phrases = parts.phrases;
  if (parts.banners) bundle.banners = parts.banners;
  if (parts.favicon) bundle.favicon = parts.favicon;
  if (parts.calendar) bundle.calendar = parts.calendar;
  if (parts.images && parts.images.length) bundle.images = parts.images;
  return bundle;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function validImages(value: unknown): value is BundleImage[] {
  return (
    Array.isArray(value) &&
    value.every(
      (i) =>
        isObject(i) &&
        typeof i.name === "string" &&
        typeof i.type === "string" &&
        typeof i.data === "string" &&
        (i.dir === undefined || typeof i.dir === "string"),
    )
  );
}

/**
 * Parse and validate raw JSON text into a `ConfigBundle`. Returns a typed
 * result with a human-readable `error` rather than throwing, so callers can
 * surface the reason to the user. Validation is lenient about config shapes
 * (just enough to avoid writing obvious garbage) but strict about the envelope.
 */
export function parseBundle(raw: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Not a valid JSON file." };
  }
  if (!isObject(parsed)) {
    return { ok: false, error: "File is not a config object." };
  }
  if (parsed.tracker !== BUNDLE_MARKER) {
    return { ok: false, error: "This isn't a Tracker config export." };
  }
  if (typeof parsed.version !== "number") {
    return { ok: false, error: "Config is missing a version." };
  }
  if (parsed.version > BUNDLE_VERSION) {
    return {
      ok: false,
      error: `Config was exported by a newer version (v${parsed.version}).`,
    };
  }

  const { schema, dashboard, phrases, banners, favicon, calendar, images } =
    parsed;
  if (schema !== undefined && !(isObject(schema) && Array.isArray(schema.fields))) {
    return { ok: false, error: "Config has a malformed schema." };
  }
  if (
    dashboard !== undefined &&
    !(isObject(dashboard) && Array.isArray(dashboard.metrics))
  ) {
    return { ok: false, error: "Config has a malformed dashboard." };
  }
  if (
    phrases !== undefined &&
    !(isObject(phrases) && Array.isArray(phrases.phrases))
  ) {
    return { ok: false, error: "Config has malformed phrases." };
  }
  if (
    banners !== undefined &&
    !(isObject(banners) && isObject(banners.banners))
  ) {
    return { ok: false, error: "Config has malformed banners." };
  }
  if (
    favicon !== undefined &&
    !(
      isObject(favicon) &&
      (typeof favicon.favicon === "string" || favicon.favicon === null)
    )
  ) {
    return { ok: false, error: "Config has a malformed favicon." };
  }
  if (
    calendar !== undefined &&
    !(isObject(calendar) && Array.isArray(calendar.events))
  ) {
    return { ok: false, error: "Config has a malformed calendar." };
  }
  if (images !== undefined && !validImages(images)) {
    return { ok: false, error: "Config has malformed images." };
  }
  if (
    schema === undefined &&
    dashboard === undefined &&
    phrases === undefined &&
    banners === undefined &&
    favicon === undefined &&
    calendar === undefined
  ) {
    return { ok: false, error: "Config has nothing to import." };
  }

  return { ok: true, bundle: parsed as unknown as ConfigBundle };
}

// ---- base64 <-> Blob (browser) -----------------------------------------

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  // Chunk to stay clear of call-stack limits on large images.
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBlob(data: string, type: string): Blob {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

// ---- IO over the root directory handle ---------------------------------

/** Read every image under a `.tracker` subfolder as base64 bundle entries,
 *  tagging each with its `dir` so it round-trips to the right place. */
async function readImagesFrom(
  root: FileSystemDirectoryHandle,
  subdir: string,
): Promise<BundleImage[]> {
  const images: BundleImage[] = [];
  try {
    const tracker = await root.getDirectoryHandle(TRACKER_DIR);
    const dir = await tracker.getDirectoryHandle(subdir);
    for await (const handle of dir.values()) {
      if (handle.kind !== "file" || handle.name.startsWith(".")) continue;
      const blob = await readFileAsBlob(handle as FileSystemFileHandle);
      images.push({
        name: handle.name,
        type: blob.type || "application/octet-stream",
        data: await blobToBase64(blob),
        dir: subdir,
      });
    }
  } catch {
    /* no images folder yet — nothing to bundle */
  }
  return images;
}

/** Read all bundled config images (phrase + banner + favicon) as base64 entries. */
export async function readBundleImages(
  root: FileSystemDirectoryHandle,
): Promise<BundleImage[]> {
  const phrase = await readImagesFrom(root, PHRASE_IMAGES_DIR);
  const banner = await readImagesFrom(root, BANNER_IMAGES_DIR);
  const favicon = await readImagesFrom(root, FAVICON_IMAGES_DIR);
  return [...phrase, ...banner, ...favicon];
}

/** Write bundled images back into their `.tracker` subfolder. Entries with no
 *  `dir` default to `phrase-images/` (the original bundle shape). */
export async function writeBundleImages(
  root: FileSystemDirectoryHandle,
  images: BundleImage[],
): Promise<void> {
  const tracker = await createDirectory(root, TRACKER_DIR);
  const dirs = new Map<string, FileSystemDirectoryHandle>();
  for (const img of images) {
    const subdir = img.dir ?? PHRASE_IMAGES_DIR;
    let dir = dirs.get(subdir);
    if (!dir) {
      dir = await createDirectory(tracker, subdir);
      dirs.set(subdir, dir);
    }
    await createFileFromBlob(dir, img.name, base64ToBlob(img.data, img.type));
  }
}

/**
 * Write a validated bundle to disk: each present config replaces its file, and
 * bundled images are written into the images folder (additive — existing images
 * with other names are left alone). Tracked items are never touched.
 */
export async function applyBundle(
  root: FileSystemDirectoryHandle,
  bundle: ConfigBundle,
): Promise<void> {
  if (bundle.schema) await saveSchema(root, bundle.schema);
  if (bundle.dashboard) await saveDashboard(root, bundle.dashboard);
  if (bundle.phrases) await savePhrases(root, bundle.phrases);
  if (bundle.banners) await saveBanners(root, bundle.banners);
  if (bundle.favicon) await saveFavicon(root, bundle.favicon);
  if (bundle.calendar) await saveCalendar(root, bundle.calendar);
  if (bundle.images?.length) await writeBundleImages(root, bundle.images);
}
