import { useEffect } from "react";
import { FolderOpen } from "lucide-react";
import { useStore } from "./state/store";
import { Sidebar } from "./components/Sidebar";
import { Breadcrumbs } from "./tree/Breadcrumbs";
import { ItemEditor } from "./editor/ItemEditor";
import { Banner } from "./banners/Banner";
import { useFaviconLink } from "./favicon/useFaviconLink";
import { Dashboard } from "./dashboard/DashboardView";
import { SchemaView } from "./schema/SchemaView";
import { CalendarView } from "./calendar/CalendarView";
import { AgendaBanner } from "./calendar/AgendaBanner";
import { DialogHost } from "./components/dialog";

export default function App() {
  const init = useStore((s) => s.init);
  const status = useStore((s) => s.status);
  const canReopen = useStore((s) => s.canReopen);
  const reopenLast = useStore((s) => s.reopenLast);
  const openFolder = useStore((s) => s.openFolder);
  const rootName = useStore((s) => s.rootName);
  const selectedPath = useStore((s) => s.selectedPath);
  const homeView = useStore((s) => s.homeView);
  const dirtyCount = useStore((s) => Object.keys(s.drafts).length);

  // Keep the browser-tab favicon in sync with the open workspace.
  useFaviconLink();

  useEffect(() => {
    void init();
  }, [init]);

  // Warn before leaving with unsaved drafts, now that saving is deferred.
  useEffect(() => {
    if (dirtyCount === 0) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirtyCount]);

  return (
    <div className="flex h-full bg-bg text-fg">
      <Sidebar />

      <main className="flex min-w-0 flex-1 flex-col">
        {status === "ready" ? (
          <>
            <AgendaBanner />
            {selectedPath ? (
              <>
                <header className="flex h-12 shrink-0 items-center border-b border-line px-7">
                  <Breadcrumbs rootName={rootName} path={selectedPath} />
                </header>
                <ItemBanner path={selectedPath} />
                <ItemEditor key={selectedPath} path={selectedPath} />
              </>
            ) : homeView === "schema" ? (
              <SchemaView />
            ) : homeView === "calendar" ? (
              <CalendarView />
            ) : (
              <Dashboard />
            )}
          </>
        ) : (
          <EmptyState
            status={status}
            canReopen={canReopen}
            onReopen={() => void reopenLast()}
            onOpen={() => void openFolder()}
          />
        )}
      </main>

      <DialogHost />
    </div>
  );
}

/** Banner shown above the item editor, using the item's parent-folder banner.
 *  Renders nothing (no padding) unless that folder has a banner set. */
function ItemBanner({ path }: { path: string }) {
  const i = path.lastIndexOf("/");
  const parentKey = i === -1 ? "" : path.slice(0, i);
  const hasBanner = useStore((s) => Boolean(s.banners.banners[parentKey]));
  if (!hasBanner) return null;
  return (
    <div className="shrink-0 px-7 pt-6">
      <Banner scopeKey={parentKey} />
    </div>
  );
}

function EmptyState({
  status,
  canReopen,
  onReopen,
  onOpen,
}: {
  status: string;
  canReopen: boolean;
  onReopen: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl border border-line bg-surface text-muted">
        <FolderOpen size={28} />
      </span>

      {status === "empty" && canReopen ? (
        <>
          <p className="text-sm text-muted">Pick up where you left off.</p>
          <button
            onClick={onReopen}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
          >
            <FolderOpen size={16} />
            Reopen last folder
          </button>
        </>
      ) : status === "unsupported" ? (
        <p className="max-w-sm text-sm text-muted">
          This app needs the File System Access API. Please use Chrome, Edge, or
          another Chromium browser.
        </p>
      ) : (
        <>
          <p className="max-w-xs text-sm text-muted">
            Open a folder of Markdown files to start tracking your items.
          </p>
          <button
            onClick={onOpen}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
          >
            <FolderOpen size={16} />
            Open folder
          </button>
        </>
      )}
    </div>
  );
}
