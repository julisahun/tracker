import { type ReactNode } from "react";
import { type Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  SquareCode,
  Minus,
  Link2,
} from "lucide-react";

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

function ToolbarDivider() {
  return <span className="mx-0.5 h-4 w-px bg-line" />;
}

/** WYSIWYG formatting toolbar shared by the item editor and the folder note. */
export function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  const setLink = () => {
    const url = window.prompt(
      "Link URL",
      (editor.getAttributes("link").href as string | undefined) ?? "",
    );
    if (url === null) return; // cancelled
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  };

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
        title="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough size={15} />
      </ToolbarButton>
      <ToolbarButton
        title="Inline code"
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code size={15} />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        title="Heading 1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 size={15} />
      </ToolbarButton>
      <ToolbarButton
        title="Heading 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 size={15} />
      </ToolbarButton>
      <ToolbarButton
        title="Heading 3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 size={15} />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        title="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={15} />
      </ToolbarButton>
      <ToolbarButton
        title="Ordered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={15} />
      </ToolbarButton>
      <ToolbarButton
        title="Task list"
        active={editor.isActive("taskList")}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        <ListTodo size={15} />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        title="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote size={15} />
      </ToolbarButton>
      <ToolbarButton
        title="Code block"
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <SquareCode size={15} />
      </ToolbarButton>
      <ToolbarButton
        title="Horizontal rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus size={15} />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton title="Link" active={editor.isActive("link")} onClick={setLink}>
        <Link2 size={15} />
      </ToolbarButton>
    </div>
  );
}
