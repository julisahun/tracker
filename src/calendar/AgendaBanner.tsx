import { CalendarClock, X } from "lucide-react";
import { useStore } from "../state/store";
import { useCalendarEntries } from "./useCalendarEntries";
import { buildAgenda, todayStr, entryTitle, type CalEntry } from "./calendar";

/** Global "Today you have:" bar. Surfaces items/events that are due today or
 *  overdue across every screen. Dismissable for the day. Renders nothing when
 *  there's nothing pending (or it was already dismissed today). */
export function AgendaBanner() {
  const dismissedAgendaDate = useStore((s) => s.dismissedAgendaDate);
  const dismissAgenda = useStore((s) => s.dismissAgenda);
  const selectFile = useStore((s) => s.selectFile);
  const showHome = useStore((s) => s.showHome);

  const { byDate, loading } = useCalendarEntries();
  const today = todayStr();
  const { overdue, today: dueToday } = buildAgenda(byDate, today);

  if (loading || dismissedAgendaDate === today) return null;
  if (overdue.length === 0 && dueToday.length === 0) return null;

  const open = (entry: CalEntry) => {
    if (entry.kind === "item") selectFile(entry.path);
    else showHome("calendar");
  };

  const Chip = ({ entry, danger }: { entry: CalEntry; danger?: boolean }) => (
    <button
      onClick={() => open(entry)}
      className={`truncate rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
        danger
          ? "bg-danger-soft text-danger hover:bg-danger hover:text-white"
          : "bg-accent-soft text-accent-soft-fg hover:bg-accent hover:text-accent-fg"
      }`}
    >
      {entryTitle(entry)}
    </button>
  );

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-line bg-surface px-7 py-2.5">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-soft-fg">
        <CalendarClock size={15} />
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        <span className="mr-1 text-sm font-medium">Today you have:</span>
        {overdue.length > 0 && (
          <span className="mr-1 text-xs font-medium text-danger">
            {overdue.length} overdue
          </span>
        )}
        {overdue.map((e, i) => (
          <Chip key={`o-${i}`} entry={e} danger />
        ))}
        {dueToday.map((e, i) => (
          <Chip key={`t-${i}`} entry={e} />
        ))}
        {dueToday.length === 0 && overdue.length === 0 && (
          <span className="text-xs text-muted">nothing due</span>
        )}
      </div>
      <button
        onClick={() => dismissAgenda(today)}
        aria-label="Dismiss"
        className="shrink-0 rounded-md p-1 text-muted transition-colors hover:bg-raised hover:text-fg"
      >
        <X size={15} />
      </button>
    </div>
  );
}
