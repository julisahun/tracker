import { useState } from "react";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FileText,
  FilePlus,
  FolderPlus,
  Trash2,
} from "lucide-react";
import type { TreeNode } from "../fs/directory";
import { useStore } from "../state/store";
import { confirmDialog, promptDialog } from "../components/dialog";

const parentOf = (path: string) => {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
};

interface RowProps {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  toggle: (path: string) => void;
  expand: (path: string) => void;
  dragged: string | null;
  setDragged: (path: string | null) => void;
}

function Row({ node, depth, expanded, toggle, expand, dragged, setDragged }: RowProps) {
  const selectedPath = useStore((s) => s.selectedPath);
  const dashboardScope = useStore((s) => s.dashboardScope);
  const selectFile = useStore((s) => s.selectFile);
  const selectFolder = useStore((s) => s.selectFolder);
  const newFile = useStore((s) => s.newFile);
  const newFolder = useStore((s) => s.newFolder);
  const remove = useStore((s) => s.remove);
  const moveNode = useStore((s) => s.moveNode);

  const isDirty = useStore((s) => node.path in s.drafts);

  const [dropPos, setDropPos] = useState<"before" | "after" | null>(null);

  const isDir = node.kind === "directory";
  const isOpen = expanded.has(node.path);
  const isSelected = isDir
    ? dashboardScope === node.path
    : selectedPath === node.path;

  const onRowClick = () => {
    if (isDir) {
      selectFolder(node.path);
      expand(node.path); // reveal contents without collapsing on re-click
    } else {
      selectFile(node.path);
    }
  };

  const onChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggle(node.path);
  };

  // Drag & drop reordering — siblings within the same parent only.
  const sameParent = dragged !== null && parentOf(dragged) === parentOf(node.path);
  const onDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = "move";
    setDragged(node.path);
  };
  const onDragOver = (e: React.DragEvent) => {
    if (!sameParent || dragged === node.path) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    setDropPos(e.clientY < rect.top + rect.height / 2 ? "before" : "after");
  };
  const onDragLeave = () => setDropPos(null);
  const onDrop = (e: React.DragEvent) => {
    if (!sameParent || dragged === node.path || !dropPos) return;
    e.preventDefault();
    void moveNode(dragged, node.path, dropPos);
    setDropPos(null);
    setDragged(null);
  };

  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };
  const onNewFile = stop(async () => {
    const name = await promptDialog({
      title: "New item",
      placeholder: "name.md",
      confirmLabel: "Create",
    });
    if (name) await newFile(node.path, name.trim());
  });
  const onNewFolder = stop(async () => {
    const name = await promptDialog({
      title: "New folder",
      placeholder: "Folder name",
      confirmLabel: "Create",
    });
    if (name) await newFolder(node.path, name.trim());
  });
  const onDelete = stop(async () => {
    const label = isDir ? `folder "${node.name}" and its contents` : `"${node.name}"`;
    const ok = await confirmDialog({
      title: "Delete",
      message: `Delete ${label}? This can't be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (ok) await remove(node.path);
  });

  return (
    <div>
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={() => setDragged(null)}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`group relative flex h-8 cursor-pointer select-none items-center gap-1.5 rounded-md pr-1 text-sm transition-colors ${
          isSelected
            ? "bg-accent-soft font-medium text-accent-soft-fg"
            : "text-fg/80 hover:bg-raised"
        } ${
          dropPos === "before"
            ? "before:absolute before:inset-x-1 before:top-0 before:h-0.5 before:rounded-full before:bg-accent"
            : dropPos === "after"
              ? "after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent"
              : ""
        }`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={onRowClick}
        title={node.path}
      >
        <span
          className="flex w-4 shrink-0 justify-center text-muted"
          onClick={isDir ? onChevronClick : undefined}
        >
          {isDir && (
            <ChevronRight
              size={14}
              className={`transition-transform ${isOpen ? "rotate-90" : ""}`}
            />
          )}
        </span>
        <span className="shrink-0 text-muted">
          {isDir ? (
            isOpen ? (
              <FolderOpen size={15} className="text-accent" />
            ) : (
              <Folder size={15} className="text-accent" />
            )
          ) : (
            <FileText size={15} />
          )}
        </span>
        <span className="truncate">{node.name.replace(/\.md$/, "")}</span>

        {isDirty && (
          <span
            title="Unsaved changes"
            className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-accent group-hover:hidden"
          />
        )}

        <span className="ml-auto hidden shrink-0 items-center group-hover:flex">
          {isDir && (
            <>
              <button
                onClick={onNewFile}
                title="New item"
                className="rounded p-1 text-muted hover:text-fg"
              >
                <FilePlus size={13} />
              </button>
              <button
                onClick={onNewFolder}
                title="New folder"
                className="rounded p-1 text-muted hover:text-fg"
              >
                <FolderPlus size={13} />
              </button>
            </>
          )}
          <button
            onClick={onDelete}
            title="Delete"
            className="rounded p-1 text-muted hover:text-danger"
          >
            <Trash2 size={13} />
          </button>
        </span>
      </div>

      {isDir && isOpen && node.children && (
        <div>
          {node.children.map((child) => (
            <Row
              key={child.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              expand={expand}
              dragged={dragged}
              setDragged={setDragged}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree() {
  const tree = useStore((s) => s.tree);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dragged, setDragged] = useState<string | null>(null);

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });

  const expand = (path: string) =>
    setExpanded((prev) => (prev.has(path) ? prev : new Set(prev).add(path)));

  if (tree.length === 0) {
    return <p className="px-3 py-3 text-sm text-muted">This folder is empty.</p>;
  }

  return (
    <div className="space-y-0.5 py-1">
      {tree.map((node) => (
        <Row
          key={node.path}
          node={node}
          depth={0}
          expanded={expanded}
          toggle={toggle}
          expand={expand}
          dragged={dragged}
          setDragged={setDragged}
        />
      ))}
    </div>
  );
}
