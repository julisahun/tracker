import { useEffect, useState } from "react";
import { findNode, useStore } from "../state/store";
import { readFile } from "../fs/directory";
import { parseFrontmatter, type Frontmatter } from "../format/frontmatter";
import { DocEditor } from "./DocEditor";

interface ItemEditorProps {
  path: string;
}

interface Loaded {
  frontmatter: Frontmatter;
  body: string;
}

/** Resolves the file for `path`, reads it, and hands off to the live editor. */
export function ItemEditor({ path }: ItemEditorProps) {
  const tree = useStore((s) => s.tree);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const node = findNode(tree, path);
    if (!node || node.kind !== "file") {
      setError("Item not found.");
      return;
    }
    const handle = node.handle as FileSystemFileHandle;
    readFile(handle)
      .then((raw) => {
        if (cancelled) return;
        const { frontmatter, body } = parseFrontmatter(raw);
        setLoaded({ frontmatter, body });
      })
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
    // tree is intentionally omitted: we load once per path (key remounts on change)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  if (error) {
    return <div className="p-6 text-sm text-red-600">{error}</div>;
  }
  if (!loaded) {
    return <div className="p-6 text-sm text-slate-400">Loading…</div>;
  }

  return (
    <DocEditor
      path={path}
      initialFrontmatter={loaded.frontmatter}
      initialBody={loaded.body}
    />
  );
}
