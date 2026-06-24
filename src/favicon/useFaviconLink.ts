import { useEffect } from "react";
import { readFileAsBlob } from "../fs/directory";
import { useStore } from "../state/store";
import { FAVICON_IMAGES_DIR } from "./favicon";

const SCHEMA_DIR = ".tracker";
const DEFAULT_HREF = "./favicon.svg";
const DEFAULT_TYPE = "image/svg+xml";

/** Point the `<link id="app-favicon">` element at the default favicon. */
function resetToDefault(link: HTMLLinkElement) {
  link.type = DEFAULT_TYPE;
  link.href = DEFAULT_HREF;
}

/**
 * Keep the browser-tab favicon in sync with the open workspace's custom favicon.
 * Reads the chosen image (stored in `.tracker/favicon-images/`) into a blob
 * object URL and swaps the `<link id="app-favicon">` href to it; falls back to
 * the bundled default when no favicon is set, no folder is open, or the file is
 * missing/unreadable — a broken favicon must never break the app. The object URL
 * is revoked when the filename changes or on unmount.
 */
export function useFaviconLink(): void {
  const filename = useStore((s) => s.favicon.favicon);
  const rootHandle = useStore((s) => s.rootHandle);

  useEffect(() => {
    const link = document.getElementById(
      "app-favicon",
    ) as HTMLLinkElement | null;
    if (!link) return;

    if (!filename || !rootHandle) {
      resetToDefault(link);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    (async () => {
      try {
        const dir = await rootHandle.getDirectoryHandle(SCHEMA_DIR);
        const imagesDir = await dir.getDirectoryHandle(FAVICON_IMAGES_DIR);
        const handle = await imagesDir.getFileHandle(filename);
        const blob = await readFileAsBlob(handle);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        link.type = blob.type || "image/png";
        link.href = objectUrl;
      } catch {
        if (!cancelled) resetToDefault(link);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resetToDefault(link);
    };
  }, [filename, rootHandle]);
}
