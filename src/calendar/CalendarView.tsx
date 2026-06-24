import { useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Settings2,
  Plus,
  X,
  FileText,
  CalendarPlus,
} from "lucide-react";
import { useStore } from "../state/store";
import { templateFrontmatter } from "../schema/schema";
import { Checkbox } from "../components/Checkbox";
import { useCalendarEntries } from "./useCalendarEntries";
import { monthMatrix, todayStr, WEEKDAYS, type CalEntry } from "./calendar";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad2 = (n: number) => String(n).padStart(2, "0");

export function CalendarView() {
  const schema = useStore((s) => s.schema);
  const calendar = useStore((s) => s.calendar);
  const updateCalendar = useStore((s) => s.updateCalendar);
  const selectFile = useStore((s) => s.selectFile);
  const setDraft = useStore((s) => s.setDraft);
  const newFile = useStore((s) => s.newFile);

  const { byDate, fields, loading } = useCalendarEntries();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [configuring, setConfiguring] = useState(false);
  const [addFor, setAddFor] = useState<string | null>(null);

  const today = todayStr();
  const monthKey = `${year}-${pad2(month + 1)}`;
  const cells = monthMatrix(year, month);

  const prev = () => {
    if (month === 0) { setYear(year - 1); setMonth(11); }
    else setMonth(month - 1);
  };
  const next = () => {
    if (month === 11) { setYear(year + 1); setMonth(0); }
    else setMonth(month + 1);
  };
  const goToday = () => { setYear(now.getFullYear()); setMonth(now.getMonth()); };

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
            <h1 className="text-base font-semibold leading-tight">
              {MONTHS[month]} {year}
            </h1>
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
          <button
            onClick={goToday}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
          >
            Today
          </button>
          <div className="flex items-center rounded-lg border border-line">
            <button
              onClick={prev}
              aria-label="Previous month"
              className="rounded-l-lg px-2 py-1.5 text-muted transition-colors hover:bg-raised hover:text-fg"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={next}
              aria-label="Next month"
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

      <div className="flex min-h-0 flex-1 flex-col p-7">
        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b border-line">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-1.5 text-xs font-medium text-muted">
              {d}
            </div>
          ))}
        </div>
        {/* Day grid */}
        <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 overflow-auto">
          {cells.map((date) => (
            <DayCell
              key={date}
              date={date}
              inMonth={date.startsWith(monthKey)}
              isToday={date === today}
              entries={byDate.get(date) ?? []}
              onAdd={() => setAddFor(date)}
              onOpenItem={selectFile}
              onToggleEvent={toggleEvent}
              onDeleteEvent={deleteEvent}
            />
          ))}
        </div>
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
    </div>
  );
}

function DayCell({
  date,
  inMonth,
  isToday,
  entries,
  onAdd,
  onOpenItem,
  onToggleEvent,
  onDeleteEvent,
}: {
  date: string;
  inMonth: boolean;
  isToday: boolean;
  entries: CalEntry[];
  onAdd: () => void;
  onOpenItem: (path: string) => void;
  onToggleEvent: (id: string) => void;
  onDeleteEvent: (id: string) => void;
}) {
  const dayNum = Number(date.slice(8, 10));
  return (
    <div
      className={`group flex min-h-24 flex-col gap-1 border-b border-r border-line p-1.5 ${
        inMonth ? "" : "bg-raised/30 text-muted"
      }`}
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
        <button
          onClick={onAdd}
          aria-label={`Add to ${date}`}
          className="rounded p-0.5 text-muted opacity-0 transition-opacity hover:bg-raised hover:text-fg group-hover:opacity-100"
        >
          <Plus size={14} />
        </button>
      </div>
      <div className="flex flex-col gap-0.5">
        {entries.map((entry, i) =>
          entry.kind === "item" ? (
            <button
              key={`i-${entry.path}-${entry.field}`}
              onClick={() => onOpenItem(entry.path)}
              title={`${entry.title} (${entry.field})`}
              className="truncate rounded bg-accent-soft px-1.5 py-0.5 text-left text-xs text-accent-soft-fg transition-colors hover:bg-accent hover:text-accent-fg"
            >
              {entry.title}
            </button>
          ) : (
            <div
              key={`e-${entry.event.id}-${i}`}
              className="group/ev flex items-center gap-1 rounded bg-raised px-1.5 py-0.5 text-xs"
            >
              <button
                onClick={() => onToggleEvent(entry.event.id)}
                title="Toggle done"
                className={`min-w-0 flex-1 truncate text-left ${
                  entry.event.done ? "text-muted line-through" : "text-fg"
                }`}
              >
                {entry.event.title}
              </button>
              <button
                onClick={() => onDeleteEvent(entry.event.id)}
                aria-label="Delete event"
                className="shrink-0 rounded p-0.5 text-muted opacity-0 transition-opacity hover:text-danger group-hover/ev:opacity-100"
              >
                <X size={12} />
              </button>
            </div>
          ),
        )}
      </div>
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
