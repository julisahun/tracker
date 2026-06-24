// File System Access API layer: pick a root folder, walk it recursively,
// and read / write / create / delete files and folders. All entries keep a
// live handle so reads and writes go straight to disk without re-resolving.

export type NodeKind = "file" | "directory";

export interface TreeNode {
  name: string;
  /** POSIX-style path relative to the root, e.g. "year1/calculus.md". */
  path: string;
  kind: NodeKind;
  handle: FileSystemFileHandle | FileSystemDirectoryHandle;
  /** Present (possibly empty) for directories, undefined for files. */
  children?: TreeNode[];
}

/** Files we treat as trackable items. */
export function isItemFile(name: string): boolean {
  return name.toLowerCase().endsWith(".md");
}

/** Per-folder "main" note: a description shown below the folder's dashboard. */
export const FOLDER_NOTE_NAME = "index.md";

/** Whether `name` is the folder note (not a tracked item). */
export function isFolderNote(name: string): boolean {
  return name.toLowerCase() === FOLDER_NOTE_NAME;
}

/** Tree predicate: trackable items, minus the per-folder note. */
export function isTrackedItem(name: string): boolean {
  return isItemFile(name) && !isFolderNote(name);
}

export async function pickRootDirectory(): Promise<FileSystemDirectoryHandle> {
  return window.showDirectoryPicker({ mode: "readwrite", id: "tracker-root" });
}

/** Ensure we hold read/write permission for a (possibly persisted) handle. */
export async function verifyPermission(
  handle: FileSystemHandle,
  readwrite = true,
): Promise<boolean> {
  const opts: FileSystemHandlePermissionDescriptor = {
    mode: readwrite ? "readwrite" : "read",
  };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  return (await handle.requestPermission(opts)) === "granted";
}

/**
 * Check existing permission WITHOUT prompting. Unlike `verifyPermission`, this
 * never calls `requestPermission`, so it is safe to run on page load (outside a
 * user gesture) to decide whether a remembered folder can be auto-reopened.
 */
export async function hasPermission(
  handle: FileSystemHandle,
  readwrite = true,
): Promise<boolean> {
  const opts: FileSystemHandlePermissionDescriptor = {
    mode: readwrite ? "readwrite" : "read",
  };
  return (await handle.queryPermission(opts)) === "granted";
}

const joinPath = (parent: string, name: string) =>
  parent ? `${parent}/${name}` : name;

function sortNodes(nodes: TreeNode[]): TreeNode[] {
  return nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Recursively build the tree rooted at `dir`. Directories are always included;
 * files are included only when `keep` accepts them (defaults to .md items).
 */
export async function buildTree(
  dir: FileSystemDirectoryHandle,
  keep: (name: string) => boolean = isTrackedItem,
  parentPath = "",
): Promise<TreeNode[]> {
  const nodes: TreeNode[] = [];
  for await (const handle of dir.values()) {
    if (handle.name.startsWith(".")) continue; // skip dotfiles/dotfolders
    const path = joinPath(parentPath, handle.name);
    if (handle.kind === "directory") {
      const children = await buildTree(handle, keep, path);
      nodes.push({ name: handle.name, path, kind: "directory", handle, children });
    } else if (keep(handle.name)) {
      nodes.push({ name: handle.name, path, kind: "file", handle });
    }
  }
  return sortNodes(nodes);
}

export async function readFile(handle: FileSystemFileHandle): Promise<string> {
  const file = await handle.getFile();
  return file.text();
}

/** Read a file's raw bytes (for images and other binary content). */
export async function readFileAsBlob(
  handle: FileSystemFileHandle,
): Promise<Blob> {
  return handle.getFile(); // File extends Blob
}

export async function writeFile(
  handle: FileSystemFileHandle,
  content: string,
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

/** Create (or overwrite) a file inside `parent` and write initial content. */
export async function createFile(
  parent: FileSystemDirectoryHandle,
  name: string,
  content = "",
): Promise<FileSystemFileHandle> {
  const handle = await parent.getFileHandle(name, { create: true });
  if (content) await writeFile(handle, content);
  return handle;
}

/** Create (or overwrite) a file inside `parent` from binary `blob` content. */
export async function createFileFromBlob(
  parent: FileSystemDirectoryHandle,
  name: string,
  blob: Blob,
): Promise<FileSystemFileHandle> {
  const handle = await parent.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
  return handle;
}

export async function createDirectory(
  parent: FileSystemDirectoryHandle,
  name: string,
): Promise<FileSystemDirectoryHandle> {
  return parent.getDirectoryHandle(name, { create: true });
}

export async function deleteEntry(
  parent: FileSystemDirectoryHandle,
  name: string,
  recursive = false,
): Promise<void> {
  await parent.removeEntry(name, { recursive });
}
