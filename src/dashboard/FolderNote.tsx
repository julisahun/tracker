import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Plus } from "lucide-react";
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

type SaveStatus = "idle" | "saving" | "saved";

const AUTOSAVE_MS = 800;

/**
 * Seamless inline editor for the folder note: no card, title or Save button —
 * just prose flush with the dashboard. The toolbar fades in only while focused,
 * and edits autosave (debounced + on blur), so it reads as part of the page.
 */
function NoteEditor({
  handle,
  frontmatter,
  initialBody,
}: {
  handle: FileSystemFileHandle;
  frontmatter: Frontmatter;
  initialBody: string;
}) {
  const [focused, setFocused] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");

  // `dirty` tracks whether the latest content has been flushed; refs keep the
  // newest editor/dirty reachable from debounce + unmount closures.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: bodyExtensions,
    content: initialBody,
    editorProps: bodyEditorProps,
    onUpdate: () => {
      dirtyRef.current = true;
      scheduleSave();
    },
    onFocus: () => setFocused(true),
    onBlur: () => {
      setFocused(false);
      flushSave();
    },
  });
  const editorRef = useRef(editor);
  editorRef.current = editor;

  const save = useCallback(async () => {
    const ed = editorRef.current;
    if (!ed || !dirtyRef.current) return;
    dirtyRef.current = false;
    setStatus("saving");
    const body = ed.storage.markdown.getMarkdown();
    await writeFile(handle, stringifyFrontmatter(frontmatter, body));
    setStatus("saved");
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setStatus("idle"), 1500);
  }, [handle, frontmatter]);

  const flushSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    void save();
  }, [save]);

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void save(), AUTOSAVE_MS);
  }, [save]);

  // Cmd/Ctrl+S forces an immediate save (no conflict: DocEditor's handler isn't
  // mounted on the dashboard). Flush any pending edit on unmount / scope change.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        flushSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      void save(); // flush pending edits before the editor goes away
    };
  }, [flushSave, save]);

  return (
    <section className="relative mt-10">
      {/* Toolbar floats in the top-margin gap, only while editing — no layout shift. */}
      <div
        onMouseDown={(e) => e.preventDefault()}
        className={`absolute left-0 top-0 z-10 -translate-y-full pb-2 transition-opacity ${
          focused ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <Toolbar editor={editor} />
      </div>
      <span
        className={`absolute right-0 top-0 -translate-y-full pb-2 text-xs text-muted transition-opacity ${
          status === "idle" ? "opacity-0" : "opacity-60"
        }`}
      >
        {status === "saving" ? "Saving…" : "Saved"}
      </span>
      <EditorContent editor={editor} />
    </section>
  );
}
