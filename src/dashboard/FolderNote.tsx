import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { FileText, Plus, Save, Check } from "lucide-react";
import { useStore, findNode } from "../state/store";
import {
  readFile,
  writeFile,
  createFile,
  FOLDER_NOTE_NAME,
} from "../fs/directory";
import {
  parseFrontmatter,
  stringifyFrontmatter,
  type Frontmatter,
} from "../format/frontmatter";
import { Toolbar } from "../editor/Toolbar";
import { bodyExtensions, bodyEditorProps } from "../editor/bodyEditor";

interface FolderNoteProps {
  /** Folder whose note to show (null = root). Matches `dashboardScope`. */
  scope: string | null;
}

interface Loaded {
  handle: FileSystemFileHandle;
  frontmatter: Frontmatter;
  body: string;
}

type State =
  | { status: "loading" }
  | { status: "absent" }
  | ({ status: "present" } & Loaded);

/**
 * The per-folder "main" note (`index.md`), rendered below the dashboard metrics.
 * It lives outside the tracked-item tree, so it manages its own load/save rather
 * than going through the store's draft/`saveAll` machinery.
 */
export function FolderNote({ scope }: FolderNoteProps) {
  const tree = useStore((s) => s.tree);
  const rootHandle = useStore((s) => s.rootHandle);
  const dir = (
    scope ? (findNode(tree, scope)?.handle ?? null) : rootHandle
  ) as FileSystemDirectoryHandle | null;

  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    if (!dir) return;
    setState({ status: "loading" });
    void dir
      .getFileHandle(FOLDER_NOTE_NAME)
      .then(async (handle) => {
        const { frontmatter, body } = parseFrontmatter(await readFile(handle));
        if (!cancelled) setState({ status: "present", handle, frontmatter, body });
      })
      .catch(() => {
        // NotFoundError (no note yet) — anything else also degrades to "add note".
        if (!cancelled) setState({ status: "absent" });
      });
    return () => {
      cancelled = true;
    };
  }, [dir]);

  if (!dir || state.status === "loading") return null;

  if (state.status === "absent") {
    const add = () =>
      void createFile(dir, FOLDER_NOTE_NAME).then((handle) =>
        setState({ status: "present", handle, frontmatter: {}, body: "" }),
      );
    return (
      <section className="mt-10">
        <button
          onClick={add}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-8 text-sm text-muted transition-colors hover:border-accent hover:text-accent"
        >
          <Plus size={16} /> Add a note for this folder
        </button>
      </section>
    );
  }

  return (
    <NoteEditor
      key={scope ?? "__root__"}
      handle={state.handle}
      frontmatter={state.frontmatter}
      initialBody={state.body}
    />
  );
}

function NoteEditor({
  handle,
  frontmatter,
  initialBody,
}: {
  handle: FileSystemFileHandle;
  frontmatter: Frontmatter;
  initialBody: string;
}) {
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const editor = useEditor({
    extensions: bodyExtensions,
    content: initialBody,
    editorProps: bodyEditorProps,
    onUpdate: () => setDirty(true),
  });

  // Keep the freshest editor reachable from the keydown closure.
  const editorRef = useRef(editor);
  editorRef.current = editor;

  const save = useCallback(async () => {
    const ed = editorRef.current;
    if (!ed) return;
    setSaving(true);
    try {
      const body = ed.storage.markdown.getMarkdown();
      await writeFile(handle, stringifyFrontmatter(frontmatter, body));
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }, [handle, frontmatter]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted">
          <FileText size={15} /> Note
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                dirty ? "bg-accent" : "bg-muted/40"
              }`}
            />
            {saving ? "Saving…" : dirty ? "Unsaved" : "Saved"}
          </span>
          <button
            onClick={() => void save()}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg transition-colors hover:bg-accent-hover disabled:opacity-40"
          >
            {saving ? <Check size={14} /> : <Save size={14} />}
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      <div className="rounded-xl border border-line bg-surface">
        <div className="border-b border-line px-3 py-2">
          <Toolbar editor={editor} />
        </div>
        <div className="px-5 py-4">
          <EditorContent editor={editor} />
        </div>
      </div>
    </section>
  );
}
