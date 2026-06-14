import { describe, it, expect } from "vitest";
import {
  defaultValueFor,
  coerceValue,
  inferSchema,
  normalizeFrontmatter,
  templateFrontmatter,
  type Schema,
} from "./schema";

describe("defaultValueFor", () => {
  it("gives sensible empties per type", () => {
    expect(defaultValueFor("boolean")).toBe(false);
    expect(defaultValueFor("tags")).toEqual([]);
    expect(defaultValueFor("number")).toBe("");
    expect(defaultValueFor("text")).toBe("");
  });
});

describe("coerceValue", () => {
  it("coerces booleans", () => {
    const f = { key: "x", label: "X", type: "boolean" as const };
    expect(coerceValue(f, "true")).toBe(true);
    expect(coerceValue(f, true)).toBe(true);
    expect(coerceValue(f, "")).toBe(false);
    expect(coerceValue(f, "no")).toBe(false);
  });
  it("coerces numbers", () => {
    const f = { key: "x", label: "X", type: "number" as const };
    expect(coerceValue(f, "42")).toBe(42);
    expect(coerceValue(f, 7)).toBe(7);
    expect(coerceValue(f, "")).toBe("");
    expect(coerceValue(f, "abc")).toBe("");
  });
  it("coerces tags from array or comma string", () => {
    const f = { key: "x", label: "X", type: "tags" as const };
    expect(coerceValue(f, ["a", "b"])).toEqual(["a", "b"]);
    expect(coerceValue(f, "a, b ,c")).toEqual(["a", "b", "c"]);
    expect(coerceValue(f, "")).toEqual([]);
  });
});

describe("inferSchema", () => {
  it("unions keys and guesses types", () => {
    const schema = inferSchema([
      { title: "A", credits: 6, done: true },
      { title: "B", due: "2026-06-20", tags: ["x"] },
    ]);
    const byKey = Object.fromEntries(schema.fields.map((f) => [f.key, f.type]));
    expect(byKey).toEqual({
      title: "text",
      credits: "number",
      done: "boolean",
      due: "date",
      tags: "tags",
    });
  });

  it("falls back to a default schema when empty", () => {
    expect(inferSchema([]).fields.map((f) => f.key)).toEqual([
      "title",
      "status",
      "tags",
    ]);
  });
});

describe("normalizeFrontmatter", () => {
  const schema: Schema = {
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "status", label: "Status", type: "select", default: "todo" },
      { key: "credits", label: "Credits", type: "number" },
    ],
  };

  it("applies schema order, types, and defaults", () => {
    const out = normalizeFrontmatter(schema, { credits: "6", title: "Calc" });
    expect(Object.keys(out)).toEqual(["title", "status", "credits"]);
    expect(out).toEqual({ title: "Calc", status: "todo", credits: 6 });
  });

  it("preserves non-schema keys after the schema fields", () => {
    const out = normalizeFrontmatter(schema, { title: "Calc", professor: "Vega" });
    expect(Object.keys(out)).toEqual(["title", "status", "credits", "professor"]);
    expect(out.professor).toBe("Vega");
  });
});

describe("templateFrontmatter", () => {
  it("seeds defaults and sets the title", () => {
    const out = templateFrontmatter(inferSchema([]), "New Item");
    expect(out.title).toBe("New Item");
    expect(out.status).toBe("todo");
    expect(out.tags).toEqual([]);
  });
});
