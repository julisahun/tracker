import { create } from "zustand";
import {
  pickRootDirectory,
  verifyPermission,
  hasPermission,
  buildTree,
  writeFile,
  createFile,
  createDirectory,
  deleteEntry,
  type TreeNode,
} from "../fs/directory";
import {
  ensureOrder,
  saveOrder,
  applyOrder,
  type OrderConfig,
} from "../fs/order";
import { saveRootHandle, loadRootHandle } from "../fs/handleStore";
import { buildSearchIndex, type SearchIndex } from "../search/searchIndex";
import { stringifyFrontmatter, type Frontmatter } from "../format/frontmatter";
import {
  ensureSchema,
  saveSchema,
  templateFrontmatter,
  normalizeFrontmatter,
  defaultSchema,
  type Schema,
} from "../schema/schema";
import {
  ensureDashboard,
  saveDashboard,
  emptyDashboard,
  type Dashboard,
} from "../dashboard/dashboard";
import { ensurePhrases, defaultPhrases, type Phrases } from "../phrases/phrases";
import {
  ensureCalendar,
  saveCalendar,
  defaultCalendar,
  type Calendar,
} from "../calendar/calendar";
import {
  ensureBanners,
  saveBanners,
  defaultBanners,
  writeBannerImage,
  deleteBannerImage,
  extForType,
  sanitizeKey,
  type Banners,
} from "../banners/banners";
import {
  ensureFavicon,
  defaultFavicon,
  type Favicon,
} from "../favicon/favicon";
import {
  makeBundle,
  applyBundle,
  readBundleImages,
  type ConfigBundle,
} from "../config/configBundle";

export type FolderStatus =
  | "unsupported" // browser lacks the File System Access API
  | "empty" // no folder open
  | "loading"
  | "ready"
  | "denied"; // permission to a remembered folder was refused

/** Which screen fills the main pane when no item file is selected. */
export type HomeView = "dashboard" | "schema" | "calendar";

/** An unsaved, in-memory edit to a single item, keyed by path in `drafts`. */
export interface FileDraft {
  frontmatter: Frontmatter;
  body: string;
}

interface TrackerState {
  status: FolderStatus;
  rootHandle: FileSystemDirectoryHandle | null;
  rootName: string;
  tree: TreeNode[];
  selectedPath: string | null;
  /** Folder whose items the dashboard aggregates (null = whole tree / root). */
  dashboardScope: string | null;
  homeView: HomeView;
  searchIndex: SearchIndex;
  schema: Schema;
  dashboard: Dashboard;
  /** Custom sibling ordering for the sidebar tree, persisted per-root. */
  order: OrderConfig;
  phrases: Phrases;
  /** Image banners keyed by scope (`""` = root, else a folder path). */
  banners: Banners;
  /** Bumped on every banner write so the image reloads even when the derived
   *  filename is unchanged (e.g. replacing a JPG with another JPG). */
  bannersRev: number;
  /** Custom browser-tab favicon for the workspace (one per folder). */
  favicon: Favicon;
  /** Calendar config: which date fields to project + standalone events. */
  calendar: Calendar;
  /** Day (`YYYY-MM-DD`) the agenda banner was dismissed on; reappears next day. */
  dismissedAgendaDate: string | null;
  canReopen: boolean;
  /** Unsaved edits across any number of files; flushed together by `saveAll`. */
  drafts: Record<string, FileDraft>;
  saving: boolean;

  init: () => Promise<void>;
  openFolder: () => Promise<void>;
  reopenLast: () => Promise<void>;
  refreshTree: () => Promise<void>;
  selectFile: (path: string | null) => void;
  selectFolder: (path: string) => void;
  showHome: (view: HomeView) => void;
  moveNode: (
    fromPath: string,
    toPath: string,
    place: "before" | "after",
  ) => Promise<void>;
  setDraft: (path: string, draft: FileDraft) => void;
  saveAll: () => Promise<void>;
  updateSchema: (next: Schema) => Promise<void>;
  updateDashboard: (next: Dashboard) => Promise<void>;
  updateCalendar: (next: Calendar) => Promise<void>;
  dismissAgenda: (date: string) => void;
  setBanner: (key: string, file: File) => Promise<void>;
  removeBanner: (key: string) => Promise<void>;
  exportConfig: () => Promise<ConfigBundle>;
  importConfig: (bundle: ConfigBundle) => Promise<void>;
  newFile: (parentPath: string, name: string) => Promise<string | null>;
  newFolder: (parentPath: string, name: string) => Promise<void>;
  remove: (path: string) => Promise<void>;
}

const isSupported = typeof window !== "undefined" && "showDirectoryPicker" in window;

/** Walk the tree to the node at `path`. */
export function findNode(tree: TreeNode[], path: string): TreeNode | null {
  for (const node of tree) {
    if (node.path === path) return node;
    if (node.children) {
      const found = findNode(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

const parentOf = (path: string) => {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
};
const baseName = (path: string) => {
  const i = path.lastIndexOf("/");
  return i === -1 ? path : path.slice(i + 1);
};

export const useStore = create<TrackerState>((set, get) => {
  /** Resolve a directory handle for a tree path ("" == root). */
  const dirHandleFor = (path: string): FileSystemDirectoryHandle | null => {
    if (path === "") return get().rootHandle;
    const node = findNode(get().tree, path);
    return node?.kind === "directory"
      ? (node.handle as FileSystemDirectoryHandle)
      : null;
  };

  const loadRoot = async (handle: FileSystemDirectoryHandle) => {
    set({ status: "loading" });
    const built = await buildTree(handle);
    const schema = await ensureSchema(handle, built);
    const dashboard = await ensureDashboard(handle);
    const order = await ensureOrder(handle);
    const tree = applyOrder(built, order);
    const phrases = await ensurePhrases(handle);
    const banners = await ensureBanners(handle);
    const favicon = await ensureFavicon(handle);
    const calendar = await ensureCalendar(handle);
    const searchIndex = await buildSearchIndex(tree);
    set({
      status: "ready",
      rootHandle: handle,
      rootName: handle.name,
      tree,
      schema,
      dashboard,
      order,
      phrases,
      banners,
      favicon,
      calendar,
      searchIndex,
      drafts: {},
    });
  };

  return {
    status: isSupported ? "empty" : "unsupported",
    rootHandle: null,
    rootName: "",
    tree: [],
    selectedPath: null,
    dashboardScope: null,
    homeView: "dashboard",
    searchIndex: { entries: [] },
    schema: defaultSchema(),
    dashboard: emptyDashboard(),
    order: {},
    phrases: defaultPhrases(),
    banners: defaultBanners(),
    bannersRev: 0,
    favicon: defaultFavicon(),
    calendar: defaultCalendar(),
    dismissedAgendaDate: null,
    canReopen: false,
    drafts: {},
    saving: false,

    async init() {
      if (!isSupported) return;
      const remembered = await loadRootHandle();
      if (!remembered) return;
      set({ canReopen: true });
      // Auto-reopen silently when the browser still holds permission (e.g. the
      // user chose "Allow on every visit"). Otherwise leave the reopen button
      // for them — re-prompting requires a user gesture we don't have on load.
      try {
        if (await hasPermission(remembered)) await loadRoot(remembered);
      } catch {
        // Stale handle / folder moved or deleted — fall back to the button.
      }
    },

    async openFolder() {
      try {
        const handle = await pickRootDirectory();
        await saveRootHandle(handle);
        set({
          canReopen: true,
          selectedPath: null,
          dashboardScope: null,
          homeView: "dashboard",
        });
        await loadRoot(handle);
      } catch (err) {
        // AbortError = user dismissed the picker; ignore.
        if ((err as DOMException)?.name !== "AbortError") throw err;
      }
    },

    async reopenLast() {
      const handle = await loadRootHandle();
      if (!handle) return;
      if (!(await verifyPermission(handle))) {
        set({ status: "denied" });
        return;
      }
      await loadRoot(handle);
    },

    async refreshTree() {
      const handle = get().rootHandle;
      if (!handle) return;
      const tree = applyOrder(await buildTree(handle), get().order);
      const searchIndex = await buildSearchIndex(tree);
      set({ tree, searchIndex });
    },

    selectFile(path) {
      set({ selectedPath: path });
    },

    selectFolder(path) {
      set({ selectedPath: null, dashboardScope: path, homeView: "dashboard" });
    },

    showHome(view) {
      set({ selectedPath: null, dashboardScope: null, homeView: view });
    },

    /** Reorder a sibling within its parent (drag & drop). Same-parent only;
     *  cross-folder moves are not supported. Persists to `.tracker/order.json`
     *  and re-applies the order to the in-memory tree. */
    async moveNode(fromPath, toPath, place) {
      if (fromPath === toPath) return;
      const parent = parentOf(fromPath);
      if (parent !== parentOf(toPath)) return; // siblings only

      const siblings =
        parent === "" ? get().tree : findNode(get().tree, parent)?.children;
      if (!siblings) return;

      const fromName = baseName(fromPath);
      const toName = baseName(toPath);
      const names = siblings.map((n) => n.name).filter((n) => n !== fromName);
      const at = names.indexOf(toName);
      if (at === -1) return;
      names.splice(place === "after" ? at + 1 : at, 0, fromName);

      const next = { ...get().order, [parent]: names };
      const handle = get().rootHandle;
      if (handle) await saveOrder(handle, next);
      set({ order: next, tree: applyOrder(get().tree, next) });
    },

    setDraft(path, draft) {
      set((s) => ({ drafts: { ...s.drafts, [path]: draft } }));
    },

    /** Flush every unsaved draft to disk in one go. Successful writes are
     *  cleared; any that error stay dirty so they can be retried. */
    async saveAll() {
      const { drafts, tree, schema, saving } = get();
      const paths = Object.keys(drafts);
      if (saving || paths.length === 0) return;
      set({ saving: true });
      const remaining = { ...drafts };
      try {
        for (const path of paths) {
          const node = findNode(tree, path);
          if (node?.kind !== "file") {
            delete remaining[path]; // file is gone; drop the orphaned draft
            continue;
          }
          try {
            const { frontmatter, body } = drafts[path];
            const normalized = normalizeFrontmatter(schema, frontmatter);
            await writeFile(
              node.handle as FileSystemFileHandle,
              stringifyFrontmatter(normalized, body),
            );
            delete remaining[path];
          } catch {
            /* keep this draft dirty for retry */
          }
        }
      } finally {
        set({ drafts: remaining, saving: false });
      }
    },

    async updateSchema(next) {
      const handle = get().rootHandle;
      if (handle) await saveSchema(handle, next);
      set({ schema: next });
    },

    async updateDashboard(next) {
      const handle = get().rootHandle;
      if (handle) await saveDashboard(handle, next);
      set({ dashboard: next });
    },

    async updateCalendar(next) {
      const handle = get().rootHandle;
      if (handle) await saveCalendar(handle, next);
      set({ calendar: next });
    },

    dismissAgenda(date) {
      set({ dismissedAgendaDate: date });
    },

    /** Set (or replace) the banner image for a scope key (`""` = root). Writes
     *  the image into `.tracker/banner-images/` and records its filename in
     *  `banners.json`. A prior image with a different name is removed. */
    async setBanner(key, file) {
      const handle = get().rootHandle;
      if (!handle) return;
      const name = `${sanitizeKey(key)}.${extForType(file.type)}`;
      const prev = get().banners.banners[key];
      await writeBannerImage(handle, name, file);
      const next: Banners = {
        banners: { ...get().banners.banners, [key]: name },
      };
      await saveBanners(handle, next);
      if (prev && prev !== name) await deleteBannerImage(handle, prev);
      set({ banners: next, bannersRev: get().bannersRev + 1 });
    },

    /** Remove the banner for a scope key: drop it from `banners.json` and delete
     *  the image file (best-effort). */
    async removeBanner(key) {
      const handle = get().rootHandle;
      if (!handle) return;
      const prev = get().banners.banners[key];
      const rest = { ...get().banners.banners };
      delete rest[key];
      const next: Banners = { banners: rest };
      await saveBanners(handle, next);
      if (prev) await deleteBannerImage(handle, prev);
      set({ banners: next, bannersRev: get().bannersRev + 1 });
    },

    /** Gather the current config (schema, dashboard, phrases + images) into a
     *  portable bundle. Configs come from in-memory state so unsaved config
     *  edits are included; images are read fresh from disk. */
    async exportConfig() {
      const { rootHandle, schema, dashboard, phrases, banners, favicon, calendar } =
        get();
      const images = rootHandle ? await readBundleImages(rootHandle) : [];
      return makeBundle({
        schema,
        dashboard,
        phrases,
        banners,
        favicon,
        calendar,
        images,
        exportedAt: new Date().toISOString(),
      });
    },

    /** Write an imported bundle to disk and adopt its config into state. Only
     *  the parts the bundle carries are replaced; the rest is left as-is. */
    async importConfig(bundle) {
      const handle = get().rootHandle;
      if (!handle) return;
      await applyBundle(handle, bundle);
      set((s) => ({
        schema: bundle.schema ?? s.schema,
        dashboard: bundle.dashboard ?? s.dashboard,
        phrases: bundle.phrases ?? s.phrases,
        banners: bundle.banners ?? s.banners,
        favicon: bundle.favicon ?? s.favicon,
        calendar: bundle.calendar ?? s.calendar,
      }));
      // Rebuild the search index in case the schema (indexed fields) changed.
      await get().refreshTree();
    },

    async newFile(parentPath, name) {
      const dir = dirHandleFor(parentPath);
      if (!dir) return null;
      const fileName = name.endsWith(".md") ? name : `${name}.md`;
      const title = fileName.replace(/\.md$/, "");
      const content = stringifyFrontmatter(
        templateFrontmatter(get().schema, title),
        "",
      );
      await createFile(dir, fileName, content);
      await get().refreshTree();
      const path = parentPath ? `${parentPath}/${fileName}` : fileName;
      set({ selectedPath: path });
      return path;
    },

    async newFolder(parentPath, name) {
      const dir = dirHandleFor(parentPath);
      if (!dir) return;
      await createDirectory(dir, name);
      await get().refreshTree();
    },

    async remove(path) {
      const parent = dirHandleFor(parentOf(path));
      if (!parent) return;
      const node = findNode(get().tree, path);
      await deleteEntry(parent, baseName(path), node?.kind === "directory");
      // Drop any drafts for the deleted file (or for files under a deleted folder).
      set((s) => {
        const drafts = Object.fromEntries(
          Object.entries(s.drafts).filter(
            ([p]) => p !== path && !p.startsWith(`${path}/`),
          ),
        );
        const scopeGone =
          s.dashboardScope === path ||
          (s.dashboardScope?.startsWith(`${path}/`) ?? false);
        return {
          drafts,
          selectedPath: s.selectedPath === path ? null : s.selectedPath,
          dashboardScope: scopeGone ? null : s.dashboardScope,
        };
      });
      await get().refreshTree();
    },
  };
});
