import { describe, it, expect } from "vitest";
import { applyOrder, type OrderConfig } from "./order";
import type { TreeNode } from "./directory";

// Minimal node factory; `handle` is irrelevant to ordering so we cast a stub.
const stub = {} as TreeNode["handle"];
const file = (name: string, parent = ""): TreeNode => ({
  name,
  path: parent ? `${parent}/${name}` : name,
  kind: "file",
  handle: stub,
});
const dir = (name: string, children: TreeNode[], parent = ""): TreeNode => ({
  name,
  path: parent ? `${parent}/${name}` : name,
  kind: "directory",
  handle: stub,
  children,
});

const names = (nodes: TreeNode[]) => nodes.map((n) => n.name);

describe("applyOrder", () => {
  it("falls back to default order (dirs first, then alphabetical) when empty", () => {
    const nodes = [file("b.md"), dir("z", []), file("a.md"), dir("a", [])];
    expect(names(applyOrder(nodes, {}))).toEqual(["a", "z", "a.md", "b.md"]);
  });

  it("respects a saved custom order at the root", () => {
    const nodes = [file("a.md"), file("b.md"), file("c.md")];
    const order: OrderConfig = { "": ["c.md", "a.md", "b.md"] };
    expect(names(applyOrder(nodes, order))).toEqual(["c.md", "a.md", "b.md"]);
  });

  it("appends unlisted names after listed ones in default order", () => {
    const nodes = [file("a.md"), file("b.md"), file("c.md"), file("d.md")];
    const order: OrderConfig = { "": ["c.md", "a.md"] };
    // c, a are pinned; b, d unlisted → appended alphabetically.
    expect(names(applyOrder(nodes, order))).toEqual([
      "c.md",
      "a.md",
      "b.md",
      "d.md",
    ]);
  });

  it("can interleave folders and files once custom order is set", () => {
    const nodes = [dir("docs", []), file("a.md"), dir("src", [])];
    const order: OrderConfig = { "": ["a.md", "src", "docs"] };
    expect(names(applyOrder(nodes, order))).toEqual(["a.md", "src", "docs"]);
  });

  it("orders children recursively by their parent path", () => {
    const tree = [
      dir("year1", [
        file("calc.md", "year1"),
        file("algebra.md", "year1"),
      ]),
    ];
    const order: OrderConfig = { year1: ["calc.md", "algebra.md"] };
    const result = applyOrder(tree, order);
    expect(names(result[0].children!)).toEqual(["calc.md", "algebra.md"]);
  });

  it("does not mutate the input array or nodes", () => {
    const nodes = [file("b.md"), file("a.md")];
    const snapshot = names(nodes);
    applyOrder(nodes, { "": ["a.md", "b.md"] });
    expect(names(nodes)).toEqual(snapshot);
  });
});
