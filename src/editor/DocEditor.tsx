import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { Bold, Italic, Heading2, List, Save, Check } from "lucide-react";
import { type Frontmatter } from "../format/frontmatter";
import { useStore } from "../state/store";
import { normalizeFrontmatter } from "../schema/schema";
import { FieldsPanel } from "./FieldsPanel";
import { SchemaEditor } from "../schema/SchemaEditor";

interface DocEditorProps {
  path: string;
  initialFrontmatter: Frontmatter;
  initialBody: string;
}

export function DocEditor({
  path,
  initialFrontmatter,
  initialBody,
}: DocEditorProps) {
  const schema = useStore((s) => s.schema);
  const updateSchema = useStore((s) => s.updateSchema);
  const setDraft = useStore((s) => s.setDraft);
  const saveAll = useStore((s) => s.saveAll);
  const saving = useStore((s) => s.saving);
  // Dirty state lives in the store so edits survive switching files and a single
  // Save flushes every file at once. `dirty` = this file has a pending draft.
  const dirty = useStore((s) => path in s.drafts);
  const dirtyCount = useStore((s) => Object.keys(s.drafts).length);

  // Hydrate from an in-memory draft (unsaved edits to this file) when one exists,
  // otherwise from what was read off disk.
  const initialDraft = useStore.getState().drafts[path];
  const [frontmatter, setFrontmatter] = useState<Frontmatter>(() =>
    normalizeFrontmatter(schema, initialDraft?.frontmatter ?? initialFrontmatter),
  );
  const [schemaOpen, setSchemaOpen] = useState(false);

  // Keep the latest frontmatter reachable from the editor's onUpdate closure.
  const fmRef = useRef(frontmatter);
  fmRef.current = frontmatter;

  // Reflect schema changes in the open item (new fields appear with defaults).
  useEffect(() => {
    setFrontmatter((fm) => normalizeFrontmatter(schema, fm));
  }, [schema]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown.configure({ html: false, transformPastedText: true }),
    ],
    content: initialDraft?.body ?? initialBody,
    editorProps: {
      attributes: { class: "tracker-prose focus:outline-none" },
    },
    onUpdate: ({ editor }) =>
      setDraft(path, {
        frontmatter: fmRef.current,
        body: editor.storage.markdown.getMarkdown(),
      }),
  });

  const updateFrontmatter = (next: Frontmatter) => {
    setFrontmatter(next);
    setDraft(path, {
      frontmatter: next,
      body: editor
        ? editor.storage.markdown.getMarkdown()
        : initialDraft?.body ?? initialBody,
    });
  };

  const save = useCallback(() => void saveAll(), [saveAll]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  const statusLabel = saving
    ? "Saving…"
    : dirtyCount > 0
      ? `${dirtyCount} unsaved`
      : "Saved";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-line px-7">
        <Toolbar editor={editor} />
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                dirtyCount > 0 ? "bg-accent" : "bg-muted/40"
              }`}
            />
            {statusLabel}
          </span>
          <button
            onClick={save}
            disabled={dirtyCount === 0 || saving}
            title={dirty ? "Save this and any other edited files" : undefined}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg transition-colors hover:bg-accent-hover disabled:opacity-40"
          >
            {saving ? <Check size={14} /> : <Save size={14} />}
            {saving ? "Saving…" : dirtyCount > 1 ? "Save all" : "Save"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-3xl space-y-6 px-7 py-8">
          <FieldsPanel
            schema={schema}
            frontmatter={frontmatter}
            onChange={updateFrontmatter}
            onManageFields={() => setSchemaOpen(true)}
          />
          <EditorContent editor={editor} />
        </div>
      </div>

      {schemaOpen && (
        <SchemaEditor
          schema={schema}
          onClose={() => setSchemaOpen(false)}
          onSave={(next) => void updateSchema(next)}
        />
      )}
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
        active
          ? "bg-accent-soft text-accent-soft-fg"
          : "text-muted hover:bg-raised hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  return (
    <div className="flex items-center gap-1 rounded-lg border border-line bg-raised/40 p-0.5">
      <ToolbarButton
        title="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={15} />
      </ToolbarButton>
      <ToolbarButton
        title="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={15} />
      </ToolbarButton>
      <ToolbarButton
        title="Heading"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 size={15} />
      </ToolbarButton>
      <ToolbarButton
        title="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={15} />
      </ToolbarButton>
    </div>
  );
}
