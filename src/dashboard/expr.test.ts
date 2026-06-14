import { describe, it, expect } from "vitest";
import { compile, exprError } from "./expr";
import type { Schema } from "../schema/schema";

const schema: Schema = {
  fields: [
    { key: "title", label: "Title", type: "text" },
    { key: "status", label: "Status", type: "select" },
    { key: "price", label: "Price", type: "number" },
    { key: "qty", label: "Qty", type: "number" },
    { key: "owner", label: "Owner", type: "text" },
    { key: "team", label: "Team", type: "text" },
    { key: "active", label: "Active", type: "boolean" },
    { key: "tags", label: "Tags", type: "tags" },
  ],
};

const ev = (src: string, fm: Record<string, unknown>) =>
  compile(src).eval(fm, schema);

describe("expr · literals & arithmetic", () => {
  it("evaluates numeric literals and precedence", () => {
    expect(ev("1 + 2 * 3", {})).toBe(7);
    expect(ev("(1 + 2) * 3", {})).toBe(9);
    expect(ev("10 / 4", {})).toBe(2.5);
    expect(ev("10 % 3", {})).toBe(1);
    expect(ev("-5 + 2", {})).toBe(-3);
  });

  it("reads and multiplies fields (coerced from strings)", () => {
    expect(ev("price * qty", { price: 4, qty: 3 })).toBe(12);
    expect(ev("price * qty", { price: "4", qty: "3" })).toBe(12);
  });
});

describe("expr · strings", () => {
  it("concatenates with + when a side is a string", () => {
    expect(ev("owner + team", { owner: "a", team: "b" })).toBe("ab");
    expect(ev('owner + " " + team', { owner: "a", team: "b" })).toBe("a b");
  });

  it("supports string literals with either quote", () => {
    expect(ev("'x'", {})).toBe("x");
    expect(ev('"y"', {})).toBe("y");
  });
});

describe("expr · comparisons & logic", () => {
  it("compares numerically and as strings", () => {
    expect(ev("price > 5", { price: 8 })).toBe(true);
    expect(ev("price > 5", { price: 2 })).toBe(false);
    expect(ev('status == "done"', { status: "done" })).toBe(true);
    expect(ev('status != "done"', { status: "todo" })).toBe(true);
  });

  it("handles && / || / ! with truthiness", () => {
    expect(ev('status == "done" && price > 5', { status: "done", price: 8 })).toBe(true);
    expect(ev('status == "done" || price > 5', { status: "todo", price: 2 })).toBe(false);
    expect(ev("!active", { active: false })).toBe(true);
  });
});

describe("expr · functions", () => {
  it("coalesce returns the first non-empty value", () => {
    expect(ev("coalesce(owner, team)", { owner: "", team: "T" })).toBe("T");
    expect(ev("coalesce(owner, team)", { owner: "O", team: "T" })).toBe("O");
    expect(ev('coalesce(owner, team, "n/a")', {})).toBe("n/a");
  });

  it("concat, if, lower/upper, round, len, contains", () => {
    expect(ev("concat(owner, team)", { owner: "a", team: "b" })).toBe("ab");
    expect(ev('if(price > 5, "hi", "lo")', { price: 8 })).toBe("hi");
    expect(ev("lower(status)", { status: "DONE" })).toBe("done");
    expect(ev("upper(status)", { status: "done" })).toBe("DONE");
    expect(ev("round(10 / 3, 2)", {})).toBe(3.33);
    expect(ev("len(tags)", { tags: ["a", "b"] })).toBe(2);
    expect(ev('contains(tags, "core")', { tags: ["core", "x"] })).toBe(true);
    expect(ev('contains(tags, "z")', { tags: ["core"] })).toBe(false);
  });
});

describe("expr · errors & robustness", () => {
  it("reports syntax errors via compile().error and exprError()", () => {
    expect(compile("1 +").error).toBeTruthy();
    expect(compile("(1 + 2").error).toBeTruthy();
    expect(compile("bogus(1)").error).toMatch(/Unknown function/);
    expect(exprError("price *")).toBeTruthy();
  });

  it("treats empty/blank source as a no-op returning empty string", () => {
    expect(compile("").error).toBeUndefined();
    expect(ev("", {})).toBe("");
    expect(ev("   ", {})).toBe("");
  });

  it("unknown fields resolve to empty without throwing", () => {
    expect(ev("nope", {})).toBe("");
    expect(ev('coalesce(nope, "fallback")', {})).toBe("fallback");
  });

  it("supports [bracketed] field keys", () => {
    expect(ev("[my key] + 1", { "my key": 4 })).toBe(5);
  });
});
