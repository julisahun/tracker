import { describe, it, expect } from "vitest";
import { defaultBanners, sanitizeKey, extForType } from "./banners";

describe("sanitizeKey", () => {
  it("maps the root key to 'root'", () => {
    expect(sanitizeKey("")).toBe("root");
  });

  it("flattens path separators and unsafe chars", () => {
    expect(sanitizeKey("math/calc")).toBe("math__calc");
    expect(sanitizeKey("a/b/c")).toBe("a__b__c");
    expect(sanitizeKey("My Folder!")).toBe("My__Folder__");
  });

  it("keeps simple names intact", () => {
    expect(sanitizeKey("Calculus")).toBe("Calculus");
  });

  it("gives distinct stems to distinct nested folders", () => {
    expect(sanitizeKey("a/b")).not.toBe(sanitizeKey("a/c"));
  });
});

describe("extForType", () => {
  it("maps known image MIME types", () => {
    expect(extForType("image/png")).toBe("png");
    expect(extForType("image/jpeg")).toBe("jpg");
    expect(extForType("image/webp")).toBe("webp");
    expect(extForType("image/gif")).toBe("gif");
    expect(extForType("image/svg+xml")).toBe("svg");
  });

  it("defaults unknown types to png", () => {
    expect(extForType("")).toBe("png");
    expect(extForType("application/octet-stream")).toBe("png");
  });
});

describe("defaultBanners", () => {
  it("is an empty map", () => {
    expect(defaultBanners()).toEqual({ banners: {} });
  });
});
