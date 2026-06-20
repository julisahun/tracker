// Persisted custom ordering for the sidebar tree. The default tree order
// (folders first, then alphabetical — see `directory.ts`) is the baseline;
// once a user drags siblings into a custom order it is recorded here and
// applied on top, so reordering and tree-building stay decoupled.

import {
  createDirectory,
  createFile,
  readFile,
  type TreeNode,
} from "./directory";

const SCHEMA_DIR = ".tracker";
const ORDER_FILE = "order.json";

/** Maps a parent path ("" == root) to its child names in custom order. */
export type OrderConfig = Record<string, string[]>;

/** Default comparator: directories before files, then alphabetical by name. */
function defaultCompare(a: TreeNode, b: TreeNode): number {
  if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
  return a.name.localeCompare(b.name);
}

/**
 * Reorder `nodes` (siblings under `parentPath`) by the saved order: listed
 * names come first in their saved order, anything not listed falls after them
 * in default order. Recurses into directory children. Pure — returns new
 * arrays and never mutates the input.
 */
export function applyOrder(
  nodes: TreeNode[],
  order: OrderConfig,
  parentPath = "",
): TreeNode[] {
  const saved = order[parentPath] ?? [];
  const rank = new Map(saved.map((name, i) => [name, i]));

  const sorted = [...nodes].sort((a, b) => {
    const ra = rank.get(a.name);
    const rb = rank.get(b.name);
    if (ra !== undefined && rb !== undefined) return ra - rb;
    if (ra !== undefined) return -1; // listed names first
    if (rb !== undefined) return 1;
    return defaultCompare(a, b); // both unlisted → default order
  });

  return sorted.map((node) =>
    node.kind === "directory" && node.children
      ? { ...node, children: applyOrder(node.children, order, node.path) }
      : node,
  );
}

async function readOrderFile(
  root: FileSystemDirectoryHandle,
): Promise<string | null> {
  try {
    const dir = await root.getDirectoryHandle(SCHEMA_DIR);
    const file = await dir.getFileHandle(ORDER_FILE);
    return await readFile(file);
  } catch {
    return null;
  }
}

export async function loadOrder(
  root: FileSystemDirectoryHandle,
): Promise<OrderConfig | null> {
  const raw = await readOrderFile(root);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as OrderConfig;
    }
  } catch {
    /* fall through */
  }
  return null;
}

export async function saveOrder(
  root: FileSystemDirectoryHandle,
  order: OrderConfig,
): Promise<void> {
  const dir = await createDirectory(root, SCHEMA_DIR);
  await createFile(dir, ORDER_FILE, JSON.stringify(order, null, 2) + "\n");
}

/** Return the saved order, or an empty one (entries are added in-app). */
export async function ensureOrder(
  root: FileSystemDirectoryHandle,
): Promise<OrderConfig> {
  return (await loadOrder(root)) ?? {};
}
