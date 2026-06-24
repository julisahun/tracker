import { useEffect, useState } from "react";
import { useStore } from "../state/store";
import { collectItemFrontmatters } from "../schema/schema";
import {
  dateFieldsFor,
  groupByDate,
  type CalEntry,
  type Item,
} from "./calendar";

/** Collect dated items + events into a `date → entries` map. Shared by the
 *  calendar grid and the agenda banner so the file walk happens once per mount,
 *  mirroring the dashboard's `collectFrontmatters` load pattern. */
export function useCalendarEntries(): {
  byDate: Map<string, CalEntry[]>;
  fields: string[];
  loading: boolean;
} {
  const tree = useStore((s) => s.tree);
  const schema = useStore((s) => s.schema);
  const calendar = useStore((s) => s.calendar);

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void collectItemFrontmatters(tree).then((collected) => {
      if (!cancelled) {
        setItems(collected);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tree]);

  const fields = dateFieldsFor(schema, calendar);
  const byDate = groupByDate(items, calendar, fields);
  return { byDate, fields, loading };
}
