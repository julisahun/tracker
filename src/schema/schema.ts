import {
  readFile,
  createFile,
  createDirectory,
  type TreeNode,
} from "../fs/directory";
import { parseFrontmatter, type Frontmatter } from "../format/frontmatter";

// Every item shares the same structure, defined once by a Schema. The schema
// lives at `<root>/.tracker/schema.json` and is the single source of truth for
// which fields exist, their types, and their defaults. Item frontmatter is
// normalized against it on load and save.

export type FieldType = "text" | "number" | "boolean" | "date" | "select" | "tags";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  /** Allowed values, for `select`. */
  options?: string[];
  /** Default applied when an item is missing this field. */
  default?: unknown;
}

export interface Schema {
  fields: FieldDef[];
}

const SCHEMA_DIR = ".tracker";
const SCHEMA_FILE = "schema.json";

export function defaultValueFor(type: FieldType): unknown {
  switch (type) {
    case "boolean":
      return false;
    case "tags":
      return [];
    default:
      return "";
  }
}

/** Coerce a raw frontmatter value into the shape expected for `field.type`. */
export function coerceValue(field: FieldDef, raw: unknown): unknown {
  switch (field.type) {
    case "boolean":
      return (
        raw === true ||
        raw === "true" ||
        raw === "yes" ||
        raw === 1 ||
        raw === "1"
      );
    case "number": {
      if (raw === "" || raw == null) return "";
      const n = typeof raw === "number" ? raw : Number(raw);
      return Number.isNaN(n) ? "" : n;
    }
    case "tags":
      if (Array.isArray(raw)) return raw.map((v) => String(v));
      if (typeof raw === "string" && raw.trim() !== "")
        return raw.split(",").map((v) => v.trim()).filter(Boolean);
      return [];
    default: // text, date, select
      return raw == null ? "" : String(raw);
  }
}

function humanize(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function guessType(value: unknown): FieldType {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (Array.isArray(value)) return "tags";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim()))
    return "date";
  return "text";
}

export function defaultSchema(): Schema {
  return {
    fields: [
      { key: "title", label: "Title", type: "text" },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: ["todo", "in_progress", "done"],
        default: "todo",
      },
      { key: "tags", label: "Tags", type: "tags" },
    ],
  };
}

/** Build a schema from the union of frontmatter keys seen across items. */
export function inferSchema(frontmatters: Frontmatter[]): Schema {
  const fields: FieldDef[] = [];
  const seen = new Set<string>();
  for (const fm of frontmatters) {
    for (const [key, value] of Object.entries(fm)) {
      if (seen.has(key)) continue;
      seen.add(key);
      const field: FieldDef = { key, label: humanize(key), type: guessType(value) };
      fields.push(field);
    }
  }
  return fields.length ? { fields } : defaultSchema();
}

/**
 * Produce frontmatter that matches the schema: schema fields first (coerced, in
 * order, defaults applied for missing ones), followed by any non-schema keys
 * preserved verbatim so hand-edited data is never lost.
 */
export function normalizeFrontmatter(
  schema: Schema,
  frontmatter: Frontmatter,
): Frontmatter {
  const result: Frontmatter = {};
  const schemaKeys = new Set(schema.fields.map((f) => f.key));

  for (const field of schema.fields) {
    const raw =
      field.key in frontmatter
        ? frontmatter[field.key]
        : field.default !== undefined
          ? field.default
          : defaultValueFor(field.type);
    result[field.key] = coerceValue(field, raw);
  }
  for (const [key, value] of Object.entries(frontmatter)) {
    if (!schemaKeys.has(key)) result[key] = value;
  }
  return result;
}

/** Frontmatter for a brand-new item, from schema defaults. */
export function templateFrontmatter(schema: Schema, title: string): Frontmatter {
  const fm = normalizeFrontmatter(schema, {});
  if (schema.fields.some((f) => f.key === "title")) fm.title = title;
  return fm;
}

// ---- Config IO over the root directory handle --------------------------

async function readSchemaFile(
  root: FileSystemDirectoryHandle,
): Promise<string | null> {
  try {
    const dir = await root.getDirectoryHandle(SCHEMA_DIR);
    const file = await dir.getFileHandle(SCHEMA_FILE);
    return await readFile(file);
  } catch {
    return null;
  }
}

export async function loadSchema(
  root: FileSystemDirectoryHandle,
): Promise<Schema | null> {
  const raw = await readSchemaFile(root);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.fields)) return parsed as Schema;
  } catch {
    /* fall through */
  }
  return null;
}

export async function saveSchema(
  root: FileSystemDirectoryHandle,
  schema: Schema,
): Promise<void> {
  const dir = await createDirectory(root, SCHEMA_DIR);
  await createFile(dir, SCHEMA_FILE, JSON.stringify(schema, null, 2) + "\n");
}

/** Read frontmatter from every item file in the tree (used to infer a schema). */
export async function collectFrontmatters(
  tree: TreeNode[],
): Promise<Frontmatter[]> {
  const out: Frontmatter[] = [];
  const walk = async (nodes: TreeNode[]) => {
    for (const node of nodes) {
      if (node.kind === "directory") {
        if (node.children) await walk(node.children);
      } else {
        try {
          const raw = await readFile(node.handle as FileSystemFileHandle);
          out.push(parseFrontmatter(raw).frontmatter);
        } catch {
          /* ignore unreadable files */
        }
      }
    }
  };
  await walk(tree);
  return out;
}

/** Like `collectFrontmatters`, but keeps each item's tree path so callers can
 *  open the file (used by the calendar to plot and jump to dated items). */
export async function collectItemFrontmatters(
  tree: TreeNode[],
): Promise<{ path: string; frontmatter: Frontmatter }[]> {
  const out: { path: string; frontmatter: Frontmatter }[] = [];
  const walk = async (nodes: TreeNode[]) => {
    for (const node of nodes) {
      if (node.kind === "directory") {
        if (node.children) await walk(node.children);
      } else {
        try {
          const raw = await readFile(node.handle as FileSystemFileHandle);
          out.push({ path: node.path, frontmatter: parseFrontmatter(raw).frontmatter });
        } catch {
          /* ignore unreadable files */
        }
      }
    }
  };
  await walk(tree);
  return out;
}

/** Return the saved schema, or infer + persist one if none exists yet. */
export async function ensureSchema(
  root: FileSystemDirectoryHandle,
  tree: TreeNode[],
): Promise<Schema> {
  const loaded = await loadSchema(root);
  if (loaded) return loaded;
  const inferred = inferSchema(await collectFrontmatters(tree));
  await saveSchema(root, inferred);
  return inferred;
}
