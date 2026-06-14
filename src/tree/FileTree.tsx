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

interface RowProps {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  toggle: (path: string) => void;
}

function Row({ node, depth, expanded, toggle }: RowProps) {
  const selectedPath = useStore((s) => s.selectedPath);
  const selectFile = useStore((s) => s.selectFile);
  const newFile = useStore((s) => s.newFile);
  const newFolder = useStore((s) => s.newFolder);
  const remove = useStore((s) => s.remove);

  const isDirty = useStore((s) => node.path in s.drafts);

  const isDir = node.kind === "directory";
  const isOpen = expanded.has(node.path);
  const isSelected = selectedPath === node.path;

  const onRowClick = () => (isDir ? toggle(node.path) : selectFile(node.path));

  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };
  const onNewFile = stop(async () => {
    const name = window.prompt("New item name (.md):");
    if (name) await newFile(node.path, name.trim());
  });
  const onNewFolder = stop(async () => {
    const name = window.prompt("New folder name:");
    if (name) await newFolder(node.path, name.trim());
  });
  const onDelete = stop(async () => {
    const label = isDir ? `folder "${node.name}" and its contents` : `"${node.name}"`;
    if (window.confirm(`Delete ${label}?`)) await remove(node.path);
  });

  return (
    <div>
      <div
        className={`group flex h-8 cursor-pointer select-none items-center gap-1.5 rounded-md pr-1 text-sm transition-colors ${
          isSelected
            ? "bg-accent-soft font-medium text-accent-soft-fg"
            : "text-fg/80 hover:bg-raised"
        }`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={onRowClick}
        title={node.path}
      >
        <span className="flex w-4 shrink-0 justify-center text-muted">
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

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });

  if (tree.length === 0) {
    return <p className="px-3 py-3 text-sm text-muted">This folder is empty.</p>;
  }

  return (
    <div className="space-y-0.5 py-1">
      {tree.map((node) => (
        <Row key={node.path} node={node} depth={0} expanded={expanded} toggle={toggle} />
      ))}
    </div>
  );
}
