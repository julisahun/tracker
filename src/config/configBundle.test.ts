import { describe, it, expect } from "vitest";
import {
  makeBundle,
  parseBundle,
  BUNDLE_MARKER,
  BUNDLE_VERSION,
  type ConfigBundle,
} from "./configBundle";
import type { Schema } from "../schema/schema";
import type { Dashboard } from "../dashboard/dashboard";
import type { Phrases } from "../phrases/phrases";

const schema: Schema = {
  fields: [{ key: "title", type: "text", label: "Title" }],
};
const dashboard: Dashboard = { metrics: [] };
const phrases: Phrases = { phrases: ["hi"] };

describe("makeBundle", () => {
  it("stamps the marker, version, and timestamp", () => {
    const b = makeBundle({ schema, exportedAt: "2026-06-14T00:00:00Z" });
    expect(b.tracker).toBe(BUNDLE_MARKER);
    expect(b.version).toBe(BUNDLE_VERSION);
    expect(b.exportedAt).toBe("2026-06-14T00:00:00Z");
  });

  it("includes only the parts that are present", () => {
    const b = makeBundle({ schema, phrases, exportedAt: "t" });
    expect(b.schema).toEqual(schema);
    expect(b.phrases).toEqual(phrases);
    expect(b.dashboard).toBeUndefined();
    expect(b.images).toBeUndefined();
  });

  it("omits an empty image list", () => {
    const b = makeBundle({ schema, images: [], exportedAt: "t" });
    expect(b.images).toBeUndefined();
  });

  it("keeps a non-empty image list", () => {
    const images = [{ name: "a.jpg", type: "image/jpeg", data: "AAAA" }];
    const b = makeBundle({ schema, images, exportedAt: "t" });
    expect(b.images).toEqual(images);
  });
});

describe("parseBundle", () => {
  const roundtrip = (b: ConfigBundle) => parseBundle(JSON.stringify(b));

  it("accepts a bundle it produced", () => {
    const b = makeBundle({ schema, dashboard, phrases, exportedAt: "t" });
    const result = roundtrip(b);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.bundle).toEqual(b);
  });

  it("accepts a partial bundle (schema only)", () => {
    const result = roundtrip(makeBundle({ schema, exportedAt: "t" }));
    expect(result.ok).toBe(true);
  });

  it("rejects invalid JSON", () => {
    expect(parseBundle("{not json")).toMatchObject({ ok: false });
  });

  it("rejects a non-object", () => {
    expect(parseBundle("42")).toMatchObject({ ok: false });
  });

  it("rejects a foreign JSON file (wrong marker)", () => {
    expect(parseBundle(JSON.stringify({ hello: "world" }))).toMatchObject({
      ok: false,
    });
  });

  it("rejects a newer-version bundle", () => {
    const future = { ...makeBundle({ schema, exportedAt: "t" }), version: 99 };
    expect(parseBundle(JSON.stringify(future))).toMatchObject({ ok: false });
  });

  it("rejects a bundle with no config parts", () => {
    const empty = makeBundle({ exportedAt: "t" });
    const result = parseBundle(JSON.stringify(empty));
    expect(result.ok).toBe(false);
  });

  it("rejects a malformed schema", () => {
    const bad = { tracker: BUNDLE_MARKER, version: 1, schema: { fields: "no" } };
    expect(parseBundle(JSON.stringify(bad))).toMatchObject({ ok: false });
  });

  it("rejects malformed images", () => {
    const bad = {
      tracker: BUNDLE_MARKER,
      version: 1,
      phrases,
      images: [{ name: "a.jpg" }],
    };
    expect(parseBundle(JSON.stringify(bad))).toMatchObject({ ok: false });
  });
});
