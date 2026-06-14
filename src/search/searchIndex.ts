import Fuse from "fuse.js";
import { readFile, type TreeNode } from "../fs/directory";
import { parseFrontmatter } from "../format/frontmatter";

// Folders are small (dozens–hundreds of files), so we read every item once on
// load and build an in-memory fuzzy index over filename + frontmatter values.

export interface SearchEntry {
  path: string;
  name: string;
  /** Stringified frontmatter values, for matching by field content. */
  fields: string;
}

export interface SearchIndex {
  entries: SearchEntry[];
}

async function collectEntries(
  nodes: TreeNode[],
  out: SearchEntry[],
): Promise<void> {
  for (const node of nodes) {
    if (node.kind === "directory") {
      if (node.children) await collectEntries(node.children, out);
      continue;
    }
    let fields = "";
    try {
      const raw = await readFile(node.handle as FileSystemFileHandle);
      const { frontmatter } = parseFrontmatter(raw);
      fields = Object.values(frontmatter)
        .map((v) => (v == null ? "" : String(v)))
        .join(" ");
    } catch {
      // Unreadable file: still searchable by name.
    }
    out.push({ path: node.path, name: node.name, fields });
  }
}

export async function buildSearchIndex(tree: TreeNode[]): Promise<SearchIndex> {
  const entries: SearchEntry[] = [];
  await collectEntries(tree, entries);
  return { entries };
}

export function searchItems(index: SearchIndex, query: string): SearchEntry[] {
  const q = query.trim();
  if (!q) return [];
  const fuse = new Fuse(index.entries, {
    keys: [
      { name: "name", weight: 0.7 },
      { name: "fields", weight: 0.3 },
    ],
    threshold: 0.4,
    ignoreLocation: true,
  });
  return fuse.search(q, { limit: 20 }).map((r) => r.item);
}
