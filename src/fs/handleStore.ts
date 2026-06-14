import { get, set, del } from "idb-keyval";

// FileSystemDirectoryHandle objects are structured-cloneable, so they can be
// stashed in IndexedDB and re-used across sessions (permission must be
// re-confirmed on load via verifyPermission).

const ROOT_HANDLE_KEY = "tracker:root-handle";

export async function saveRootHandle(
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  await set(ROOT_HANDLE_KEY, handle);
}

export async function loadRootHandle(): Promise<FileSystemDirectoryHandle | null> {
  const handle = await get<FileSystemDirectoryHandle>(ROOT_HANDLE_KEY);
  return handle ?? null;
}

export async function clearRootHandle(): Promise<void> {
  await del(ROOT_HANDLE_KEY);
}
