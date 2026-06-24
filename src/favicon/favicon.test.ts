import { describe, it, expect } from "vitest";
import { defaultFavicon } from "./favicon";

describe("defaultFavicon", () => {
  it("is an empty (null) favicon", () => {
    expect(defaultFavicon()).toEqual({ favicon: null });
  });
});
