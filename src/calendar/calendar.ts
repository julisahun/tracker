import { readFile, createFile, createDirectory } from "../fs/directory";
import type { Frontmatter } from "../format/frontmatter";
import type { Schema } from "../schema/schema";

// The calendar lays items out in time. It is fed by two sources:
//   1. Existing items' `date` fields (a pure projection — no new data on disk).
//   2. Standalone "events" (title + date, optionally done) that aren't tied to a
//      Markdown file, stored alongside the schema at `<root>/.tracker/calendar.json`.
// The same file also records which date field(s) drive the projection (`dateFields`;
// empty ⇒ every `type: "date"` field). Config IO mirrors the schema/dashboard flow;
// the grouping/agenda/grid helpers are pure (today is injected) and unit-tested.

const SCHEMA_DIR = ".tracker";
const CALENDAR_FILE = "calendar.json";

/** A quick event not backed by a tracked file. */
export interface CalEvent {
  /** Stable id (used as React key and for removal). */
  id: string;
  title: string;
  /** ISO calendar date, `YYYY-MM-DD`. */
  date: string;
  done?: boolean;
}

export interface Calendar {
  /** Schema field keys to project onto the calendar; empty ⇒ all `date` fields. */
  dateFields: string[];
  events: CalEvent[];
}

/** One thing happening on a day: either a dated item or a standalone event. */
export type CalEntry =
  | { kind: "item"; date: string; path: string; title: string; field: string }
  | { kind: "event"; date: string; event: CalEvent };

/** A path + parsed frontmatter pair, as produced by `collectItemFrontmatters`. */
export interface Item {
  path: string;
  frontmatter: Frontmatter;
}

export function defaultCalendar(): Calendar {
  return { dateFields: [], events: [] };
}

// ---- Pure helpers (today injected; unit-tested) ------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a `YYYY-MM-DD` string. String compare on these is date-ordered. */
export function isDateStr(v: unknown): v is string {
  return typeof v === "string" && DATE_RE.test(v.trim());
}

const baseName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

/** Display title for an item: its `title` field, else the filename sans `.md`. */
export function itemTitle(item: Item): string {
  const t = item.frontmatter.title;
  if (typeof t === "string" && t.trim()) return t.trim();
  return baseName(item.path).replace(/\.md$/, "");
}

/** Resolve which schema fields drive the calendar. Configured keys are kept only
 *  if they still exist as `date` fields; an empty config means "all date fields". */
export function dateFieldsFor(schema: Schema, calendar: Calendar): string[] {
  const dateKeys = schema.fields
    .filter((f) => f.type === "date")
    .map((f) => f.key);
  if (calendar.dateFields.length === 0) return dateKeys;
  return calendar.dateFields.filter((k) => dateKeys.includes(k));
}

/** Group items' dated fields and standalone events into a `date → entries` map.
 *  Each day's entries are sorted by title for a stable display. */
export function groupByDate(
  items: Item[],
  calendar: Calendar,
  fields: string[],
): Map<string, CalEntry[]> {
  const byDate = new Map<string, CalEntry[]>();
  const push = (date: string, entry: CalEntry) => {
    const list = byDate.get(date);
    if (list) list.push(entry);
    else byDate.set(date, [entry]);
  };

  for (const item of items) {
    const title = itemTitle(item);
    for (const field of fields) {
      const value = item.frontmatter[field];
      if (isDateStr(value)) {
        push(value.trim(), {
          kind: "item",
          date: value.trim(),
          path: item.path,
          title,
          field,
        });
      }
    }
  }

  for (const event of calendar.events) {
    if (isDateStr(event.date)) {
      push(event.date.trim(), { kind: "event", date: event.date.trim(), event });
    }
  }

  for (const list of byDate.values()) {
    list.sort((a, b) => entryTitle(a).localeCompare(entryTitle(b)));
  }
  return byDate;
}

/** The user-visible label for an entry. */
export function entryTitle(entry: CalEntry): string {
  return entry.kind === "item" ? entry.title : entry.event.title;
}

/** Completed events drop out of reminders; items have no "done" notion. */
function isOpen(entry: CalEntry): boolean {
  return entry.kind === "item" || !entry.event.done;
}

/** Split all entries into overdue / today / the next 7 days, relative to `today`
 *  (a `YYYY-MM-DD` string). Done events are excluded. Buckets are date-ordered. */
export function buildAgenda(
  byDate: Map<string, CalEntry[]>,
  today: string,
): { overdue: CalEntry[]; today: CalEntry[]; thisWeek: CalEntry[] } {
  const weekEnd = addDays(today, 7);
  const overdue: CalEntry[] = [];
  const todayList: CalEntry[] = [];
  const thisWeek: CalEntry[] = [];

  for (const date of [...byDate.keys()].sort()) {
    for (const entry of byDate.get(date)!) {
      if (!isOpen(entry)) continue;
      if (date < today) overdue.push(entry);
      else if (date === today) todayList.push(entry);
      else if (date <= weekEnd) thisWeek.push(entry);
    }
  }
  return { overdue, today: todayList, thisWeek };
}

// ---- Date math on `YYYY-MM-DD` (UTC, so no DST drift) -------------------

function fmtUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Add `n` calendar days to a `YYYY-MM-DD` string. */
export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return fmtUTC(new Date(Date.UTC(y, m - 1, d + n)));
}

/** A 6×7 grid (42 cells) of `YYYY-MM-DD` strings covering `month` (0-indexed),
 *  Monday-first, padded with the trailing/leading days of adjacent months. */
export function monthMatrix(year: number, month: number): string[] {
  const weekday = new Date(Date.UTC(year, month, 1)).getUTCDay(); // 0 Sun..6 Sat
  const offset = (weekday + 6) % 7; // shift so Monday is column 0
  const cells: string[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push(fmtUTC(new Date(Date.UTC(year, month, 1 - offset + i))));
  }
  return cells;
}

/** Today as a local `YYYY-MM-DD` (matches what the native date input writes).
 *  Date is injectable for tests; the default uses the real clock. */
export function todayStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Weekday column headers, Monday-first, aligned with `monthMatrix`. */
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ---- Config IO over the root directory handle --------------------------

async function readCalendarFile(
  root: FileSystemDirectoryHandle,
): Promise<string | null> {
  try {
    const dir = await root.getDirectoryHandle(SCHEMA_DIR);
    const file = await dir.getFileHandle(CALENDAR_FILE);
    return await readFile(file);
  } catch {
    return null;
  }
}

export async function loadCalendar(
  root: FileSystemDirectoryHandle,
): Promise<Calendar | null> {
  const raw = await readCalendarFile(root);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.events)) {
      return {
        dateFields: Array.isArray(parsed.dateFields) ? parsed.dateFields : [],
        events: parsed.events,
      };
    }
  } catch {
    /* fall through */
  }
  return null;
}

export async function saveCalendar(
  root: FileSystemDirectoryHandle,
  calendar: Calendar,
): Promise<void> {
  const dir = await createDirectory(root, SCHEMA_DIR);
  await createFile(dir, CALENDAR_FILE, JSON.stringify(calendar, null, 2) + "\n");
}

/** Return the saved calendar, or an empty one (events are added in-app). */
export async function ensureCalendar(
  root: FileSystemDirectoryHandle,
): Promise<Calendar> {
  return (await loadCalendar(root)) ?? defaultCalendar();
}
