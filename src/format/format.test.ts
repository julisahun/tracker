import { describe, it, expect } from "vitest";
import { parseFrontmatter, stringifyFrontmatter } from "./frontmatter";

describe("frontmatter", () => {
  it("parses frontmatter + body", () => {
    const raw = "---\nstatus: done\ncredits: 6\n---\n\nHello body\n";
    const { frontmatter, body } = parseFrontmatter(raw);
    expect(frontmatter).toEqual({ status: "done", credits: 6 });
    expect(body.trim()).toBe("Hello body");
  });

  it("handles files with no frontmatter", () => {
    const { frontmatter, body } = parseFrontmatter("just text\n");
    expect(frontmatter).toEqual({});
    expect(body).toBe("just text\n");
  });

  it("treats malformed YAML as body (lossless)", () => {
    const raw = "---\n: : bad\n---\nbody";
    const { frontmatter, body } = parseFrontmatter(raw);
    expect(frontmatter).toEqual({});
    expect(body).toContain("bad");
  });

  it("round-trips frontmatter + body", () => {
    const raw = "---\nstatus: done\ncredits: 6\n---\n\nHello body\n";
    const parsed = parseFrontmatter(raw);
    const out = stringifyFrontmatter(parsed.frontmatter, parsed.body);
    expect(parseFrontmatter(out)).toEqual(parsed);
  });

  it("omits the frontmatter block when there are no keys", () => {
    expect(stringifyFrontmatter({}, "body")).toBe("body\n");
  });
});
