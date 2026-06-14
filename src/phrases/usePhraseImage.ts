import { useEffect, useState } from "react";
import { readFileAsBlob } from "../fs/directory";
import { useStore } from "../state/store";
import { PHRASE_IMAGES_DIR } from "./phrases";

const SCHEMA_DIR = ".tracker";

/**
 * Resolve a phrase image filename (stored in `.tracker/phrase-images/`) to a blob
 * object URL for use in an `<img src>`. Returns `null` while loading, when no
 * filename is given, or if the file is missing/unreadable — a broken image must
 * never break the banner. The object URL is revoked when the filename changes or
 * on unmount.
 */
export function usePhraseImage(filename: string | undefined): string | null {
  const rootHandle = useStore((s) => s.rootHandle);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!filename || !rootHandle) {
      setUrl(null);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    (async () => {
      try {
        const dir = await rootHandle.getDirectoryHandle(SCHEMA_DIR);
        const imagesDir = await dir.getDirectoryHandle(PHRASE_IMAGES_DIR);
        const handle = await imagesDir.getFileHandle(filename);
        const blob = await readFileAsBlob(handle);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        if (!cancelled) setUrl(null);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [filename, rootHandle]);

  return url;
}
