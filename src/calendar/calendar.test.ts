import { describe, it, expect } from "vitest";
import {
  dateFieldsFor,
  groupByDate,
  buildAgenda,
  buildUpcoming,
  dayLabel,
  monthMatrix,
  weekMatrix,
  weekRangeLabel,
  addDays,
  isDateStr,
  itemTitle,
  defaultCalendar,
  type Calendar,
  type Item,
} from "./calendar";
import type { Schema } from "../schema/schema";

const schema: Schema = {
  fields: [
    { key: "title", label: "Title", type: "text" },
    { key: "due", label: "Due", type: "date" },
    { key: "start", label: "Start", type: "date" },
    { key: "status", label: "Status", type: "select", options: ["a", "b"] },
  ],
};

const items: Item[] = [
  { path: "a.md", frontmatter: { title: "Alpha", due: "2026-06-24", start: "2026-06-20" } },
  { path: "sub/b.md", frontmatter: { title: "Beta", due: "2026-06-10" } },
  { path: "c.md", frontmatter: { title: "Gamma", due: "not-a-date" } },
];

describe("isDateStr", () => {
  it("accepts YYYY-MM-DD and rejects everything else", () => {
    expect(isDateStr("2026-06-24")).toBe(true);
    expect(isDateStr("2026-6-24")).toBe(false);
    expect(isDateStr("")).toBe(false);
    expect(isDateStr(20260624)).toBe(false);
    expect(isDateStr(null)).toBe(false);
  });
});

describe("itemTitle", () => {
  it("prefers the title field, falls back to the filename sans .md", () => {
    expect(itemTitle({ path: "x/Alpha.md", frontmatter: { title: "Real" } })).toBe("Real");
    expect(itemTitle({ path: "x/Beta.md", frontmatter: {} })).toBe("Beta");
    expect(itemTitle({ path: "x/Gamma.md", frontmatter: { title: "  " } })).toBe("Gamma");
  });
});

describe("dateFieldsFor", () => {
  it("defaults to every date field when none configured", () => {
    expect(dateFieldsFor(schema, defaultCalendar())).toEqual(["due", "start"]);
  });
  it("honors a configured subset, dropping unknown/non-date keys", () => {
    const cal: Calendar = { dateFields: ["due", "status", "ghost"], events: [] };
    expect(dateFieldsFor(schema, cal)).toEqual(["due"]);
  });
});

describe("groupByDate", () => {
  it("plots each valid date field and merges in events; skips bad dates", () => {
    const cal: Calendar = {
      dateFields: [],
      events: [{ id: "e1", title: "Holiday", date: "2026-06-24" }],
    };
    const byDate = groupByDate(items, cal, dateFieldsFor(schema, cal));

    expect(byDate.get("2026-06-20")?.map((e) => e.kind)).toEqual(["item"]);
    expect(byDate.get("2026-06-10")?.length).toBe(1);
    // Gamma's invalid date never lands anywhere.
    expect([...byDate.values()].flat().some((e) => e.kind === "item" && e.title === "Gamma")).toBe(false);

    // 2026-06-24 has Alpha (item) + Holiday (event), sorted by title.
    const day = byDate.get("2026-06-24")!;
    expect(day.map((e) => (e.kind === "item" ? e.title : e.event.title))).toEqual([
      "Alpha",
      "Holiday",
    ]);
  });
});

describe("buildAgenda", () => {
  const cal: Calendar = {
    dateFields: [],
    events: [
      { id: "e1", title: "Soon", date: "2026-06-27" },
      { id: "e2", title: "Done", date: "2026-06-24", done: true },
      { id: "e3", title: "FarOff", date: "2026-07-30" },
    ],
  };
  const byDate = groupByDate(items, cal, dateFieldsFor(schema, cal));
  const agenda = buildAgenda(byDate, "2026-06-24");

  it("buckets overdue / today / next 7 days", () => {
    // Beta (due 06-10) and Alpha (start 06-20) are both before today, date-ordered.
    expect(agenda.overdue.map((e) => (e.kind === "item" ? e.title : e.event.title))).toEqual([
      "Beta",
      "Alpha",
    ]);
    // Today: Alpha (item, due) — but NOT the done event.
    expect(agenda.today.map((e) => (e.kind === "item" ? e.title : e.event.title))).toEqual([
      "Alpha",
    ]);
    // This week: Soon (within 7) but not FarOff and not the past start date.
    expect(agenda.thisWeek.map((e) => (e.kind === "item" ? e.title : e.event.title))).toEqual([
      "Soon",
    ]);
  });

  it("excludes completed events everywhere", () => {
    const all = [...agenda.overdue, ...agenda.today, ...agenda.thisWeek];
    expect(all.some((e) => e.kind === "event" && e.event.title === "Done")).toBe(false);
  });
});

describe("buildUpcoming", () => {
  const cal: Calendar = {
    dateFields: [],
    events: [
      { id: "e1", title: "Soon", date: "2026-06-27" },
      { id: "e2", title: "Done", date: "2026-06-24", done: true },
      { id: "e3", title: "FarOff", date: "2026-07-30" },
    ],
  };
  const byDate = groupByDate(items, cal, dateFieldsFor(schema, cal));
  const { overdue, days } = buildUpcoming(byDate, "2026-06-24");

  it("collects open entries before today into overdue, date-ordered", () => {
    expect(overdue.map((e) => (e.kind === "item" ? e.title : e.event.title))).toEqual([
      "Beta", // 06-10
      "Alpha", // 06-20 (start)
    ]);
  });

  it("lists only dates from today onward that have open entries", () => {
    expect(days.map((d) => d.date)).toEqual(["2026-06-24", "2026-06-27", "2026-07-30"]);
  });

  it("excludes completed events and skips empty days", () => {
    // Today (06-24) keeps Alpha (item) but drops the done event.
    const today = days.find((d) => d.date === "2026-06-24")!;
    expect(today.entries.map((e) => (e.kind === "item" ? e.title : e.event.title))).toEqual([
      "Alpha",
    ]);
    expect([...overdue, ...days.flatMap((d) => d.entries)].some(
      (e) => e.kind === "event" && e.event.title === "Done",
    )).toBe(false);
  });
});

describe("dayLabel", () => {
  it("labels today and tomorrow specially, else a short date", () => {
    expect(dayLabel("2026-06-24", "2026-06-24")).toBe("Today");
    expect(dayLabel("2026-06-25", "2026-06-24")).toBe("Tomorrow");
    expect(dayLabel("2026-06-26", "2026-06-24")).toBe("Fri Jun 26");
    expect(dayLabel("2026-07-01", "2026-06-24")).toBe("Wed Jul 1");
  });
});

describe("addDays", () => {
  it("does calendar math across month boundaries", () => {
    expect(addDays("2026-06-24", 7)).toBe("2026-07-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29"); // leap year
  });
});

describe("monthMatrix", () => {
  it("returns 42 Monday-first cells covering the month", () => {
    const cells = monthMatrix(2026, 5); // June 2026
    expect(cells).toHaveLength(42);
    // June 1, 2026 is a Monday, so the grid starts exactly on it.
    expect(cells[0]).toBe("2026-06-01");
    expect(cells).toContain("2026-06-30");
    // Cells are contiguous days.
    expect(addDays(cells[0], 1)).toBe(cells[1]);
    expect(addDays(cells[0], 41)).toBe(cells[41]);
  });

  it("pads leading days of the previous month when the 1st isn't a Monday", () => {
    const cells = monthMatrix(2026, 0); // Jan 2026 — Jan 1 is a Thursday
    expect(cells[0]).toBe("2025-12-29"); // Monday before
    expect(cells).toContain("2026-01-01");
  });
});

describe("weekMatrix", () => {
  it("returns 7 Monday-first contiguous days", () => {
    const cells = weekMatrix("2026-06-24"); // Wednesday
    expect(cells).toHaveLength(7);
    expect(cells[0]).toBe("2026-06-22"); // Monday
    expect(cells[6]).toBe("2026-06-28"); // Sunday
    expect(addDays(cells[0], 6)).toBe(cells[6]);
  });

  it("returns the same week for any day within it", () => {
    const week = weekMatrix("2026-06-22"); // Monday
    for (const day of week) {
      expect(weekMatrix(day)).toEqual(week);
    }
  });

  it("handles weeks spanning a month/year boundary", () => {
    const cells = weekMatrix("2026-01-01"); // Thursday
    expect(cells[0]).toBe("2025-12-29");
    expect(cells[6]).toBe("2026-01-04");
  });
});

describe("weekRangeLabel", () => {
  it("collapses a same-month week to one month label", () => {
    expect(weekRangeLabel(weekMatrix("2026-06-24"))).toBe("Jun 22 – 28, 2026");
  });
  it("expands the month on both sides when the week spans months", () => {
    // Jan 29, 2026 is a Thursday → Mon Jan 26 .. Sun Feb 1, both in 2026.
    expect(weekRangeLabel(weekMatrix("2026-01-29"))).toBe(
      "Jan 26 – Feb 1, 2026",
    );
  });
  it("expands the year on both sides when the week spans years", () => {
    expect(weekRangeLabel(weekMatrix("2025-12-31"))).toBe(
      "Dec 29, 2025 – Jan 4, 2026",
    );
  });
});
