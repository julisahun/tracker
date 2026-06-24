import {
  FolderOpen,
  FilePlus,
  FolderPlus,
  RefreshCw,
  ListChecks,
  LayoutDashboard,
  CalendarDays,
  SlidersHorizontal,
  Save,
} from "lucide-react";
import { useStore } from "../state/store";
import { FileTree } from "../tree/FileTree";
import { SearchBox } from "../search/SearchBox";
import { ThemeToggle } from "./ThemeToggle";
import { IconButton } from "./IconButton";
import { promptDialog } from "./dialog";
import { ConfigIO } from "../config/ConfigIO";

export function Sidebar() {
  const status = useStore((s) => s.status);
  const rootName = useStore((s) => s.rootName);
  const openFolder = useStore((s) => s.openFolder);
  const refreshTree = useStore((s) => s.refreshTree);
  const newFile = useStore((s) => s.newFile);
  const newFolder = useStore((s) => s.newFolder);
  const selectedPath = useStore((s) => s.selectedPath);
  const homeView = useStore((s) => s.homeView);
  const showHome = useStore((s) => s.showHome);
  const dirtyCount = useStore((s) => Object.keys(s.drafts).length);
  const saving = useStore((s) => s.saving);
  const saveAll = useStore((s) => s.saveAll);

  const onHome = selectedPath === null;

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-line bg-surface">
      {/* Brand + theme */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-accent-fg">
            <ListChecks size={16} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Tracker</span>
        </div>
        <ThemeToggle />
      </div>

      {status === "ready" ? (
        <>
          {/* Root folder bar */}
          <div className="mx-3 flex items-center gap-1 rounded-lg border border-line bg-raised/50 px-2.5 py-1.5">
            <FolderOpen size={15} className="shrink-0 text-muted" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium" title={rootName}>
              {rootName}
            </span>
            <IconButton
              title="New item at root"
              onClick={async () => {
                const name = await promptDialog({
                  title: "New item",
                  placeholder: "name.md",
                  confirmLabel: "Create",
                });
                if (name) await newFile("", name.trim());
              }}
            >
              <FilePlus size={15} />
            </IconButton>
            <IconButton
              title="New folder at root"
              onClick={async () => {
                const name = await promptDialog({
                  title: "New folder",
                  placeholder: "Folder name",
                  confirmLabel: "Create",
                });
                if (name) await newFolder("", name.trim());
              }}
            >
              <FolderPlus size={15} />
            </IconButton>
            <IconButton title="Refresh" onClick={() => void refreshTree()}>
              <RefreshCw size={14} />
            </IconButton>
          </div>

          {/* Home navigation: dashboard + schema */}
          <nav className="space-y-0.5 px-3 pt-3">
            <button
              onClick={() => showHome("dashboard")}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
                onHome && homeView === "dashboard"
                  ? "bg-accent text-accent-fg"
                  : "text-muted hover:bg-raised hover:text-fg"
              }`}
            >
              <LayoutDashboard size={15} className="shrink-0" />
              Dashboard
            </button>
            <button
              onClick={() => showHome("calendar")}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
                onHome && homeView === "calendar"
                  ? "bg-accent text-accent-fg"
                  : "text-muted hover:bg-raised hover:text-fg"
              }`}
            >
              <CalendarDays size={15} className="shrink-0" />
              Calendar
            </button>
            <button
              onClick={() => showHome("schema")}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
                onHome && homeView === "schema"
                  ? "bg-accent text-accent-fg"
                  : "text-muted hover:bg-raised hover:text-fg"
              }`}
            >
              <SlidersHorizontal size={15} className="shrink-0" />
              Manage fields
            </button>
          </nav>

          <div className="px-3 pb-2 pt-3">
            <SearchBox />
          </div>

          {dirtyCount > 0 && (
            <div className="mx-3 mb-1 flex items-center justify-between gap-2 rounded-lg border border-accent/30 bg-accent-soft px-2.5 py-1.5">
              <span className="text-xs font-medium text-accent-soft-fg">
                {dirtyCount} unsaved {dirtyCount === 1 ? "file" : "files"}
              </span>
              <button
                onClick={() => void saveAll()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-fg transition-colors hover:bg-accent-hover disabled:opacity-40"
              >
                <Save size={13} />
                {saving ? "Saving…" : "Save all"}
              </button>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-auto px-2 pb-3">
            <FileTree />
          </div>

          <div className="border-t border-line">
            <ConfigIO />
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          {status === "unsupported" ? (
            <p className="text-sm leading-relaxed text-muted">
              This app needs the File System Access API. Please use Chrome, Edge,
              or another Chromium browser.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted">
                {status === "loading"
                  ? "Loading…"
                  : status === "denied"
                    ? "Folder permission was denied."
                    : "No folder open yet."}
              </p>
              <button
                onClick={() => void openFolder()}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
              >
                <FolderOpen size={16} />
                Open folder
              </button>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
