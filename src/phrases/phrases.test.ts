import { describe, it, expect } from "vitest";
import {
  defaultPhrases,
  normalizePhrase,
  phraseForDay,
  phraseItemForDay,
} from "./phrases";

describe("phraseForDay", () => {
  const list = ["a", "b", "c"];

  it("returns the same phrase for the same date", () => {
    const d1 = new Date(2026, 5, 14, 9, 0);
    const d2 = new Date(2026, 5, 14, 23, 30);
    expect(phraseForDay(list, d1)).toBe(phraseForDay(list, d2));
  });

  it("advances on consecutive days", () => {
    const day = new Date(2026, 5, 14);
    const next = new Date(2026, 5, 15);
    expect(phraseForDay(list, day)).not.toBe(phraseForDay(list, next));
  });

  it("wraps around the list", () => {
    const start = new Date(2026, 5, 14);
    const after = new Date(2026, 5, 17); // 3 days later, list length 3
    expect(phraseForDay(list, after)).toBe(phraseForDay(list, start));
  });

  it("is safe for an empty list", () => {
    expect(phraseForDay([], new Date(2026, 5, 14))).toBe("");
  });

  it("always returns a phrase from the default list", () => {
    const list = defaultPhrases().phrases;
    const phrase = phraseForDay(list, new Date(2026, 5, 14));
    expect(list).toContain(phrase);
  });
});

describe("normalizePhrase", () => {
  it("wraps a bare string as text", () => {
    expect(normalizePhrase("hello")).toEqual({ text: "hello" });
  });

  it("preserves text and image on an object entry", () => {
    expect(normalizePhrase({ text: "hi", image: "a.jpg" })).toEqual({
      text: "hi",
      image: "a.jpg",
    });
  });

  it("allows an image-only entry (text undefined)", () => {
    expect(normalizePhrase({ image: "a.jpg" })).toEqual({
      text: undefined,
      image: "a.jpg",
    });
  });
});

describe("phraseItemForDay", () => {
  it("normalizes a string entry to an item", () => {
    const item = phraseItemForDay(["a", "b", "c"], new Date(2026, 5, 14));
    expect(item).toEqual({ text: expect.any(String) });
  });

  it("returns the image for the selected object entry", () => {
    // Single-entry list → always index 0 regardless of date.
    const item = phraseItemForDay(
      [{ text: "hi", image: "a.jpg" }],
      new Date(2026, 5, 14),
    );
    expect(item).toEqual({ text: "hi", image: "a.jpg" });
  });

  it("returns null for an empty list", () => {
    expect(phraseItemForDay([], new Date(2026, 5, 14))).toBeNull();
  });
});
