import { describe, it, expect } from "vitest";
import {
  computeMetric,
  kindsForFieldType,
  kindsForMetric,
  type MetricDef,
} from "./dashboard";
import type { Schema } from "../schema/schema";

const schema: Schema = {
  fields: [
    { key: "title", label: "Title", type: "text" },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: ["todo", "in_progress", "done"],
    },
    { key: "credits", label: "Credits", type: "number" },
    { key: "professor", label: "Professor", type: "boolean" },
    { key: "tags", label: "Tags", type: "tags" },
  ],
};

const items = [
  { title: "A", status: "done", credits: 6, professor: true, tags: ["core", "hard"] },
  { title: "B", status: "done", credits: 4, professor: false, tags: ["core"] },
  { title: "C", status: "todo", credits: "8", professor: true, tags: [] },
  { title: "D", status: "", credits: "abc", professor: "no", tags: ["elective"] },
];

const metric = (over: Partial<MetricDef>): MetricDef => ({
  id: "m1",
  title: "M",
  field: "status",
  kind: "count",
  ...over,
});

describe("kindsForFieldType", () => {
  it("maps field types to sensible metric kinds", () => {
    expect(kindsForFieldType("number")[0]).toBe("aggregate");
    expect(kindsForFieldType("boolean")[0]).toBe("boolean");
    expect(kindsForFieldType("select")).toEqual(["count"]);
    expect(kindsForFieldType("tags")).toEqual(["count"]);
  });
});

describe("computeMetric · count", () => {
  it("groups by value, sorted desc, with an empty bucket", () => {
    const r = computeMetric(metric({ field: "status", kind: "count" }), schema, items);
    expect(r.total).toBe(4);
    expect(r.groups).toEqual([
      { label: "done", value: 2 },
      { label: "(empty)", value: 1 },
      { label: "todo", value: 1 },
    ]);
  });

  it("counts each tag separately and buckets items with no tags", () => {
    const r = computeMetric(metric({ field: "tags", kind: "count" }), schema, items);
    expect(r.groups).toEqual([
      { label: "core", value: 2 },
      { label: "(empty)", value: 1 },
      { label: "elective", value: 1 },
      { label: "hard", value: 1 },
    ]);
  });
});

describe("computeMetric · boolean", () => {
  it("splits true vs false (coercing strings)", () => {
    const r = computeMetric(metric({ field: "professor", kind: "boolean" }), schema, items);
    expect(r.groups).toEqual([
      { label: "Yes", value: 2 },
      { label: "No", value: 2 },
    ]);
    expect(r.total).toBe(4);
  });
});

describe("computeMetric · aggregate", () => {
  it("sums numeric values, skipping non-numeric", () => {
    const r = computeMetric(metric({ field: "credits", kind: "aggregate", agg: "sum" }), schema, items);
    expect(r.scalar).toBe(18); // 6 + 4 + 8, "abc" skipped
    expect(r.total).toBe(3);
  });
  it("averages contributors", () => {
    const r = computeMetric(metric({ field: "credits", kind: "aggregate", agg: "avg" }), schema, items);
    expect(r.scalar).toBe(6);
  });
  it("min and max", () => {
    expect(
      computeMetric(metric({ field: "credits", kind: "aggregate", agg: "min" }), schema, items).scalar,
    ).toBe(4);
    expect(
      computeMetric(metric({ field: "credits", kind: "aggregate", agg: "max" }), schema, items).scalar,
    ).toBe(8);
  });
  it("returns null scalar when nothing is numeric", () => {
    const r = computeMetric(metric({ field: "credits", kind: "aggregate", agg: "sum" }), schema, [
      { credits: "abc" },
      { credits: "" },
    ]);
    expect(r.scalar).toBeNull();
    expect(r.total).toBe(0);
  });
});

describe("computeMetric · unknown field", () => {
  it("returns an empty result rather than throwing", () => {
    const r = computeMetric(metric({ field: "nope" }), schema, items);
    expect(r.total).toBe(0);
    expect(r.groups).toEqual([]);
  });
});

describe("kindsForMetric", () => {
  it("always offers ratio, and all kinds when a value expression is set", () => {
    expect(kindsForMetric("select", false)).toEqual(["count", "ratio"]);
    expect(kindsForMetric("number", false)).toEqual(["aggregate", "count", "ratio"]);
    expect(kindsForMetric("select", true)).toEqual([
      "count",
      "aggregate",
      "boolean",
      "ratio",
    ]);
  });
});

describe("computeMetric · filter", () => {
  it("scopes items before computing", () => {
    const r = computeMetric(
      metric({ field: "status", kind: "count", filter: 'status == "done"' }),
      schema,
      items,
    );
    expect(r.total).toBe(2);
    expect(r.groups).toEqual([{ label: "done", value: 2 }]);
  });

  it("filters an aggregate's population", () => {
    const r = computeMetric(
      metric({ field: "credits", kind: "aggregate", agg: "sum", filter: "credits > 5" }),
      schema,
      items,
    );
    expect(r.scalar).toBe(14); // 6 + 8 (4 excluded, "abc" non-numeric)
  });
});

describe("computeMetric · derived value", () => {
  it("aggregates a per-item expression instead of a field", () => {
    const data = [
      { price: 4, qty: 3 },
      { price: 10, qty: 2 },
    ];
    const r = computeMetric(
      metric({ value: "price * qty", kind: "aggregate", agg: "sum", field: "" }),
      { fields: [{ key: "price", label: "P", type: "number" }, { key: "qty", label: "Q", type: "number" }] },
      data,
    );
    expect(r.scalar).toBe(32); // 12 + 20
  });

  it("counts a coalesced category", () => {
    const data = [{ owner: "", team: "X" }, { owner: "A", team: "X" }];
    const r = computeMetric(
      metric({ value: "coalesce(owner, team)", kind: "count", field: "" }),
      { fields: [{ key: "owner", label: "O", type: "text" }, { key: "team", label: "T", type: "text" }] },
      data,
    );
    expect(r.groups).toEqual([
      { label: "A", value: 1 },
      { label: "X", value: 1 },
    ]);
  });
});

describe("computeMetric · bins", () => {
  it("buckets numeric values into labeled ranges", () => {
    const data = [{ credits: 2 }, { credits: 6 }, { credits: 8 }, { credits: 20 }];
    const r = computeMetric(
      metric({ field: "credits", kind: "count", bins: [0, 5, 10] }),
      schema,
      data,
    );
    expect(r.groups).toEqual([
      { label: "5–10", value: 2 }, // 6, 8
      { label: "0–5", value: 1 }, // 2
      { label: "10+", value: 1 }, // 20
    ]);
  });
});

describe("computeMetric · pivot", () => {
  it("cross-tabulates one field against another", () => {
    const r = computeMetric(
      metric({ field: "status", kind: "count", groupBy2: "professor" }),
      schema,
      items,
    );
    expect(r.pivot).toBeDefined();
    // professor (boolean) coerces to "true"/"false" string labels, sorted
    expect(r.pivot!.series).toEqual(["false", "true"]);
    const done = r.pivot!.data.find((d) => d.label === "done");
    expect(done).toEqual({ label: "done", false: 1, true: 1 }); // A=true, B=false
  });
});

describe("computeMetric · ratio", () => {
  it("sums a boolean numerator (count) over the item count by default", () => {
    const r = computeMetric(
      metric({ kind: "ratio", ratioNumerator: 'status == "done"' }),
      schema,
      items,
    );
    expect(r.ratio).toEqual({ numerator: 2, denominator: 4 });
  });

  it("divides Σ(numerator) by Σ(denominator) for two numeric fields", () => {
    const data = [
      { answered: 3, questions: 4 },
      { answered: 5, questions: 6 },
    ];
    const r = computeMetric(
      metric({
        kind: "ratio",
        ratioNumerator: "answered",
        ratioDenominator: "questions",
      }),
      {
        fields: [
          { key: "answered", label: "A", type: "number" },
          { key: "questions", label: "Q", type: "number" },
        ],
      },
      data,
    );
    // Σ answered = 8, Σ questions = 10  → 80%
    expect(r.ratio).toEqual({ numerator: 8, denominator: 10 });
  });

  it("scopes the population with a metric-level filter", () => {
    const r = computeMetric(
      metric({
        kind: "ratio",
        ratioNumerator: "professor",
        filter: 'status == "done"',
      }),
      schema,
      items,
    );
    // of the 2 done items, professor sums to 1 (A=true, B=false); denominator = 2 items
    expect(r.ratio).toEqual({ numerator: 1, denominator: 2 });
  });
});

describe("computeMetric · expression errors", () => {
  it("surfaces a compile error instead of throwing", () => {
    const r = computeMetric(
      metric({ field: "status", kind: "count", filter: "status ==" }),
      schema,
      items,
    );
    expect(r.error).toBeTruthy();
  });
});
