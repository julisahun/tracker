import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Settings2,
  Plus,
  X,
  FileText,
  CalendarPlus,
  CalendarClock,
} from "lucide-react";
import { useStore } from "../state/store";
import { templateFrontmatter } from "../schema/schema";
import { Checkbox } from "../components/Checkbox";
import { useCalendarEntries } from "./useCalendarEntries";
import {
  monthMatrix,
  weekMatrix,
  weekRangeLabel,
  todayStr,
  addDays,
  buildUpcoming,
  dayLabel,
  clampSplit,
  WEEKDAYS,
  type CalEntry,
  type CalendarView as ViewMode,
} from "./calendar";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Inner controls shouldn't also trigger the surrounding cell/column click. */
const stop =
  (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

/** The 1st of a (possibly over/underflowing) month, as a `YYYY-MM-DD` anchor. */
const monthAnchor = (year: number, month: number): string => {
  const d = new Date(Date.UTC(year, month, 1));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-01`;
};

/** Dot color in the month overview: items vs standalone events. */
const dotClass = (entry: CalEntry): string =>
  entry.kind === "item" ? "bg-accent" : "bg-fg/40";

/** Track whether we're at the md+ (row) breakpoint, for the resizable split. */
function useIsWide(): boolean {
  const [wide, setWide] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 768px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const on = () => setWide(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

export function CalendarView() {
  const schema = useStore((s) => s.schema);
  const calendar = useStore((s) => s.calendar);
  const updateCalendar = useStore((s) => s.updateCalendar);
  const selectFile = useStore((s) => s.selectFile);
  const setDraft = useStore((s) => s.setDraft);
  const newFile = useStore((s) => s.newFile);

  const { byDate, fields, loading } = useCalendarEntries();

  const view: ViewMode = calendar.view === "month" ? "month" : "week";
  const today = todayStr();
  const [anchor, setAnchor] = useState(today);
  const [configuring, setConfiguring] = useState(false);
  const [addFor, setAddFor] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [popover, setPopover] = useState<{ date: string; rect: DOMRect } | null>(
    null,
  );

  const isWide = useIsWide();
  const [splitPct, setSplitPct] = useState(() =>
    clampSplit(calendar.splitPct ?? 55),
  );
  const rowRef = useRef<HTMLDivElement>(null);

  const year = Number(anchor.slice(0, 4));
  const month = Number(anchor.slice(5, 7)) - 1; // 0-indexed
  const monthKey = `${year}-${pad2(month + 1)}`;
  const cells = view === "week" ? weekMatrix(anchor) : monthMatrix(year, month);
  const title = view === "week" ? weekRangeLabel(cells) : `${MONTHS[month]} ${year}`;
  const { overdue, days } = buildUpcoming(byDate, today);

  const prev = () =>
    setAnchor(view === "week" ? addDays(anchor, -7) : monthAnchor(year, month - 1));
  const next = () =>
    setAnchor(view === "week" ? addDays(anchor, 7) : monthAnchor(year, month + 1));
  const goToday = () => setAnchor(today);
  const setView = (v: ViewMode) => void updateCalendar({ ...calendar, view: v });

  // Drag the divider between the grid and the agenda; persist on release only.
  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const row = rowRef.current;
    if (!row) return;
    const onMove = (ev: MouseEvent) => {
      const rect = row.getBoundingClientRect();
      setSplitPct(clampSplit(((ev.clientX - rect.left) / rect.width) * 100));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setSplitPct((p) => {
        void updateCalendar({ ...calendar, splitPct: p });
        return p;
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const toggleEvent = (id: string) =>
    void updateCalendar({
      ...calendar,
      events: calendar.events.map((e) =>
        e.id === id ? { ...e, done: !e.done } : e,
      ),
    });
  const deleteEvent = (id: string) =>
    void updateCalendar({
      ...calendar,
      events: calendar.events.filter((e) => e.id !== id),
    });

  const addEvent = (date: string, title: string) =>
    void updateCalendar({
      ...calendar,
      events: [...calendar.events, { id: crypto.randomUUID(), title, date }],
    });

  const createItem = async (date: string, name: string) => {
    const path = await newFile("", name);
    if (!path) return;
    const fm = templateFrontmatter(schema, name);
    if (fields[0]) fm[fields[0]] = date; // prefill the first projected date field
    setDraft(path, { frontmatter: fm, body: "" });
    // newFile already selected the file, so the editor opens for the user to fill in.
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-line px-7 py-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent-soft text-accent-soft-fg">
            <CalendarDays size={17} />
          </span>
          <div>
            <h1 className="text-base font-semibold leading-tight">{title}</h1>
            <p className="text-xs text-muted">
              {loading
                ? "Loading items…"
                : fields.length === 0
                  ? "No date fields — add one in Manage fields"
                  : `Showing: ${fields.join(", ")}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-line p-0.5">
            {(["week", "month"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-2.5 py-1 text-sm font-medium capitalize transition-colors ${
                  view === v
                    ? "bg-accent text-accent-fg"
                    : "text-muted hover:text-fg"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <button
            onClick={goToday}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
          >
            Today
          </button>
          <div className="flex items-center rounded-lg border border-line">
            <button
              onClick={prev}
              aria-label={view === "week" ? "Previous week" : "Previous month"}
              className="rounded-l-lg px-2 py-1.5 text-muted transition-colors hover:bg-raised hover:text-fg"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={next}
              aria-label={view === "week" ? "Next week" : "Next month"}
              className="rounded-r-lg px-2 py-1.5 text-muted transition-colors hover:bg-raised hover:text-fg"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <button
            onClick={() => setConfiguring(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
          >
            <Settings2 size={15} /> Configure
          </button>
        </div>
      </header>

      <div
        ref={rowRef}
        className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row"
      >
        {/* Left: the grid (week or month) */}
        <div
          className="flex min-h-0 flex-col border-b border-line p-5 md:border-b-0"
          style={isWide ? { width: `${splitPct}%` } : undefined}
        >
          {view === "week" ? (
            <WeekGrid
              cells={cells}
              today={today}
              selectedDate={selectedDate}
              byDate={byDate}
              onSelect={setSelectedDate}
              onAdd={setAddFor}
              onOpenItem={selectFile}
              onToggleEvent={toggleEvent}
              onDeleteEvent={deleteEvent}
            />
          ) : (
            <MonthGrid
              cells={cells}
              monthKey={monthKey}
              today={today}
              selectedDate={selectedDate}
              byDate={byDate}
              onAdd={setAddFor}
              onOpenDay={(date, rect) => {
                setSelectedDate(date);
                setPopover({ date, rect });
              }}
            />
          )}
        </div>

        {/* Draggable divider (desktop only) */}
        {isWide && (
          <div
            onMouseDown={startDrag}
            role="separator"
            aria-orientation="vertical"
            className="w-1.5 shrink-0 cursor-col-resize bg-line/60 transition-colors hover:bg-accent"
          />
        )}

        {/* Right: upcoming agenda */}
        <UpcomingList
          overdue={overdue}
          days={days}
          today={today}
          selectedDate={selectedDate}
          onOpenItem={selectFile}
          onToggleEvent={toggleEvent}
          onDeleteEvent={deleteEvent}
          onAddToday={() => setAddFor(today)}
        />
      </div>

      {configuring && (
        <ConfigureModal
          dateFields={schema.fields.filter((f) => f.type === "date")}
          selected={calendar.dateFields}
          onClose={() => setConfiguring(false)}
          onSave={(dateFields) => {
            void updateCalendar({ ...calendar, dateFields });
            setConfiguring(false);
          }}
        />
      )}

      {addFor && (
        <AddModal
          date={addFor}
          canCreateItem={fields.length > 0}
          onClose={() => setAddFor(null)}
          onAddEvent={(title) => { addEvent(addFor, title); setAddFor(null); }}
          onCreateItem={(name) => { void createItem(addFor, name); setAddFor(null); }}
        />
      )}

      {popover && (
        <DayPopover
          date={popover.date}
          rect={popover.rect}
          today={today}
          entries={byDate.get(popover.date) ?? []}
          onClose={() => setPopover(null)}
          onOpenItem={selectFile}
          onToggleEvent={toggleEvent}
          onDeleteEvent={deleteEvent}
          onAdd={() => { setAddFor(popover.date); setPopover(null); }}
        />
      )}
    </div>
  );
}

function WeekGrid({
  cells,
  today,
  selectedDate,
  byDate,
  onSelect,
  onAdd,
  onOpenItem,
  onToggleEvent,
  onDeleteEvent,
}: {
  cells: string[];
  today: string;
  selectedDate: string | null;
  byDate: Map<string, CalEntry[]>;
  onSelect: (date: string) => void;
  onAdd: (date: string) => void;
  onOpenItem: (path: string) => void;
  onToggleEvent: (id: string) => void;
  onDeleteEvent: (id: string) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 overflow-x-auto rounded-lg border border-line">
      {cells.map((date, i) => {
        const entries = byDate.get(date) ?? [];
        const isToday = date === today;
        const selected = date === selectedDate;
        const dayNum = Number(date.slice(8, 10));
        return (
          <div
            key={date}
            onClick={() => onSelect(date)}
            className={`group flex min-w-[11rem] flex-1 cursor-pointer flex-col border-r border-line last:border-r-0 ${
              selected ? "bg-accent-soft/30" : ""
            }`}
          >
            <div className="flex items-center justify-between border-b border-line px-2 py-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-muted">
                  {WEEKDAYS[i]}
                </span>
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full text-xs ${
                    isToday
                      ? "bg-accent font-semibold text-accent-fg"
                      : "text-fg"
                  }`}
                >
                  {dayNum}
                </span>
              </div>
              <button
                onClick={stop(() => onAdd(date))}
                aria-label={`Add to ${date}`}
                className="rounded p-0.5 text-muted opacity-0 transition-opacity hover:bg-raised hover:text-fg group-hover:opacity-100"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-1.5">
              {entries.map((entry, j) => (
                <EntryRow
                  key={
                    entry.kind === "item"
                      ? `i-${entry.path}-${entry.field}`
                      : `e-${entry.event.id}-${j}`
                  }
                  entry={entry}
                  onOpenItem={(p) => stop(() => onOpenItem(p))}
                  onToggleEvent={(id) => stop(() => onToggleEvent(id))}
                  onDeleteEvent={(id) => stop(() => onDeleteEvent(id))}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthGrid({
  cells,
  monthKey,
  today,
  selectedDate,
  byDate,
  onAdd,
  onOpenDay,
}: {
  cells: string[];
  monthKey: string;
  today: string;
  selectedDate: string | null;
  byDate: Map<string, CalEntry[]>;
  onAdd: (date: string) => void;
  onOpenDay: (date: string, rect: DOMRect) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-7 border-b border-line">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-1.5 text-xs font-medium text-muted">
            {d}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-[minmax(4.5rem,1fr)] grid-cols-7 overflow-auto">
        {cells.map((date) => (
          <MonthCell
            key={date}
            date={date}
            inMonth={date.startsWith(monthKey)}
            isToday={date === today}
            selected={date === selectedDate}
            entries={byDate.get(date) ?? []}
            onAdd={() => onAdd(date)}
            onOpenDay={onOpenDay}
          />
        ))}
      </div>
    </>
  );
}

function MonthCell({
  date,
  inMonth,
  isToday,
  selected,
  entries,
  onAdd,
  onOpenDay,
}: {
  date: string;
  inMonth: boolean;
  isToday: boolean;
  selected: boolean;
  entries: CalEntry[];
  onAdd: () => void;
  onOpenDay: (date: string, rect: DOMRect) => void;
}) {
  const dayNum = Number(date.slice(8, 10));
  const dots = entries.slice(0, 4);
  const extra = entries.length - dots.length;
  return (
    <div
      onClick={(e) => onOpenDay(date, e.currentTarget.getBoundingClientRect())}
      className={`group flex cursor-pointer flex-col gap-1 border-b border-r border-line p-1.5 ${
        inMonth ? "" : "bg-raised/30 text-muted"
      } ${selected ? "ring-1 ring-inset ring-accent" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`grid h-6 w-6 place-items-center rounded-full text-xs ${
            isToday
              ? "bg-accent font-semibold text-accent-fg"
              : inMonth
                ? "text-fg"
                : "text-muted"
          }`}
        >
          {dayNum}
        </span>
        <div className="flex items-center gap-1">
          {entries.length > 0 && (
            <span className="rounded-full bg-accent-soft px-1.5 text-[10px] font-semibold leading-4 text-accent-soft-fg">
              {entries.length}
            </span>
          )}
          <button
            onClick={stop(onAdd)}
            aria-label={`Add to ${date}`}
            className="rounded p-0.5 text-muted opacity-0 transition-opacity hover:bg-raised hover:text-fg group-hover:opacity-100"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
      {entries.length > 0 && (
        <div className="mt-auto flex flex-wrap items-center gap-1">
          {dots.map((entry, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${dotClass(entry)}`}
            />
          ))}
          {extra > 0 && <span className="text-[10px] text-muted">+{extra}</span>}
        </div>
      )}
    </div>
  );
}

/** Floating detail for a clicked month-grid day; positioned near the cell. */
function DayPopover({
  date,
  rect,
  today,
  entries,
  onClose,
  onOpenItem,
  onToggleEvent,
  onDeleteEvent,
  onAdd,
}: {
  date: string;
  rect: DOMRect;
  today: string;
  entries: CalEntry[];
  onClose: () => void;
  onOpenItem: (path: string) => void;
  onToggleEvent: (id: string) => void;
  onDeleteEvent: (id: string) => void;
  onAdd: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Plain handlers (the popover isn't a clickable surface that needs stopPropagation).
  const open = (p: string) => () => onOpenItem(p);
  const toggle = (id: string) => () => onToggleEvent(id);
  const del = (id: string) => () => onDeleteEvent(id);

  const width = 240;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  const top = Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 300));

  return createPortal(
    <>
      <div className="fixed inset-0 z-[55]" onMouseDown={onClose} />
      <div
        className="fixed z-[60] flex max-h-72 flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-xl"
        style={{ top, left, width }}
      >
        <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
          <h3
            className={`text-xs font-semibold uppercase tracking-wide ${
              date === today ? "text-accent" : "text-muted"
            }`}
          >
            {dayLabel(date, today)}
          </h3>
          <button
            onClick={onAdd}
            aria-label={`Add to ${date}`}
            className="rounded p-0.5 text-muted transition-colors hover:bg-raised hover:text-fg"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="flex flex-col gap-1 overflow-y-auto p-2">
          {entries.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted">Nothing scheduled.</p>
          ) : (
            entries.map((entry, i) => (
              <EntryRow
                key={
                  entry.kind === "item"
                    ? `i-${entry.path}-${entry.field}`
                    : `e-${entry.event.id}-${i}`
                }
                entry={entry}
                onOpenItem={open}
                onToggleEvent={toggle}
                onDeleteEvent={del}
              />
            ))
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}

/** One item or event, rendered identically in the grid cells and the agenda list.
 *  The `on*` props return a click handler so callers can wrap it (e.g. stopPropagation
 *  inside a clickable day cell). */
function EntryRow({
  entry,
  onOpenItem,
  onToggleEvent,
  onDeleteEvent,
}: {
  entry: CalEntry;
  onOpenItem: (path: string) => (e: React.MouseEvent) => void;
  onToggleEvent: (id: string) => (e: React.MouseEvent) => void;
  onDeleteEvent: (id: string) => (e: React.MouseEvent) => void;
}) {
  if (entry.kind === "item") {
    return (
      <button
        onClick={onOpenItem(entry.path)}
        title={`${entry.title} (${entry.field})`}
        className="truncate rounded bg-accent-soft px-1.5 py-0.5 text-left text-xs text-accent-soft-fg transition-colors hover:bg-accent hover:text-accent-fg"
      >
        {entry.title}
      </button>
    );
  }
  return (
    <div className="group/ev flex items-center gap-1 rounded bg-raised px-1.5 py-0.5 text-xs">
      <button
        onClick={onToggleEvent(entry.event.id)}
        title="Toggle done"
        className={`min-w-0 flex-1 truncate text-left ${
          entry.event.done ? "text-muted line-through" : "text-fg"
        }`}
      >
        {entry.event.title}
      </button>
      <button
        onClick={onDeleteEvent(entry.event.id)}
        aria-label="Delete event"
        className="shrink-0 rounded p-0.5 text-muted opacity-0 transition-opacity hover:text-danger group-hover/ev:opacity-100"
      >
        <X size={12} />
      </button>
    </div>
  );
}

function UpcomingList({
  overdue,
  days,
  today,
  selectedDate,
  onOpenItem,
  onToggleEvent,
  onDeleteEvent,
  onAddToday,
}: {
  overdue: CalEntry[];
  days: { date: string; entries: CalEntry[] }[];
  today: string;
  selectedDate: string | null;
  onOpenItem: (path: string) => void;
  onToggleEvent: (id: string) => void;
  onDeleteEvent: (id: string) => void;
  onAddToday: () => void;
}) {
  const sectionRefs = useRef(new Map<string, HTMLElement>());

  // Scroll the picked day into view when a grid cell is selected.
  useEffect(() => {
    if (!selectedDate) return;
    sectionRefs.current
      .get(selectedDate)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedDate]);

  // Plain (already-wrapped) handlers — no stopPropagation needed in the list.
  const open = (p: string) => () => onOpenItem(p);
  const toggle = (id: string) => () => onToggleEvent(id);
  const del = (id: string) => () => onDeleteEvent(id);

  const empty = overdue.length === 0 && days.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
      <div className="mb-3 flex items-center gap-2">
        <CalendarClock size={15} className="text-muted" />
        <h2 className="text-sm font-semibold">Upcoming</h2>
      </div>

      {empty ? (
        <div className="mt-6 flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-muted">Nothing scheduled.</p>
          <button
            onClick={onAddToday}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
          >
            <Plus size={14} /> Add to today
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {overdue.length > 0 && (
            <section>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-danger">
                Overdue · {overdue.length}
              </h3>
              <div className="flex flex-col gap-1">
                {overdue.map((entry, i) => (
                  <EntryRow
                    key={entry.kind === "item" ? `i-${entry.path}-${entry.field}` : `e-${entry.event.id}-${i}`}
                    entry={entry}
                    onOpenItem={open}
                    onToggleEvent={toggle}
                    onDeleteEvent={del}
                  />
                ))}
              </div>
            </section>
          )}
          {days.map(({ date, entries }) => (
            <section
              key={date}
              ref={(el) => {
                if (el) sectionRefs.current.set(date, el);
                else sectionRefs.current.delete(date);
              }}
              className={`-mx-1.5 rounded-md px-1.5 py-1 ${
                date === selectedDate ? "bg-accent-soft/50" : ""
              }`}
            >
              <h3
                className={`mb-1.5 text-xs font-semibold uppercase tracking-wide ${
                  date === today ? "text-accent" : "text-muted"
                }`}
              >
                {dayLabel(date, today)}
              </h3>
              <div className="flex flex-col gap-1">
                {entries.map((entry, i) => (
                  <EntryRow
                    key={entry.kind === "item" ? `i-${entry.path}-${entry.field}` : `e-${entry.event.id}-${i}`}
                    entry={entry}
                    onOpenItem={open}
                    onToggleEvent={toggle}
                    onDeleteEvent={del}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function ConfigureModal({
  dateFields,
  selected,
  onClose,
  onSave,
}: {
  dateFields: { key: string; label: string }[];
  selected: string[];
  onClose: () => void;
  onSave: (dateFields: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>(selected);
  const toggle = (key: string) =>
    setPicked((p) =>
      p.includes(key) ? p.filter((k) => k !== key) : [...p, key],
    );

  return (
    <Modal title="Calendar fields" onClose={onClose}>
      {dateFields.length === 0 ? (
        <p className="text-sm text-muted">
          No date fields in the schema yet. Add one in Manage fields to plot
          items on the calendar.
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            Which date fields to plot. None selected shows them all.
          </p>
          <div className="flex flex-col gap-1.5">
            {dateFields.map((f) => (
              <label
                key={f.key}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1 text-sm hover:bg-raised"
              >
                <Checkbox
                  checked={picked.includes(f.key)}
                  onChange={() => toggle(f.key)}
                />
                {f.label || f.key}
              </label>
            ))}
          </div>
        </>
      )}
      <ModalFooter
        onClose={onClose}
        confirmLabel="Save"
        onConfirm={() => onSave(picked)}
      />
    </Modal>
  );
}

function AddModal({
  date,
  canCreateItem,
  onClose,
  onAddEvent,
  onCreateItem,
}: {
  date: string;
  canCreateItem: boolean;
  onClose: () => void;
  onAddEvent: (title: string) => void;
  onCreateItem: (name: string) => void;
}) {
  const [text, setText] = useState("");
  const trimmed = text.trim();

  return (
    <Modal title={`Add to ${date}`} onClose={onClose}>
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Title"
        onKeyDown={(e) => {
          if (e.key === "Enter" && trimmed) onAddEvent(trimmed);
        }}
        className="w-full rounded-md border border-line bg-bg px-2.5 py-1.5 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
      />
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-raised hover:text-fg"
        >
          Cancel
        </button>
        {canCreateItem && (
          <button
            disabled={!trimmed}
            onClick={() => onCreateItem(trimmed)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
          >
            <FileText size={15} /> Create item
          </button>
        )}
        <button
          disabled={!trimmed}
          onClick={() => onAddEvent(trimmed)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          <CalendarPlus size={15} /> Add event
        </button>
      </div>
    </Modal>
  );
}

// ---- Small shared modal shell (matches the dialog look) ----------------

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        className="flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="-mr-1 -mt-0.5 rounded-md p-1.5 text-muted transition-colors hover:bg-raised hover:text-fg"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function ModalFooter({
  onClose,
  onConfirm,
  confirmLabel,
}: {
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
}) {
  return (
    <div className="mt-4 flex justify-end gap-2">
      <button
        onClick={onClose}
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-raised hover:text-fg"
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
      >
        {confirmLabel}
      </button>
    </div>
  );
}
