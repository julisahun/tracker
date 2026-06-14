import yaml from "js-yaml";

// A tracked item on disk is a Markdown file with optional YAML frontmatter:
//
//   ---
//   status: in_progress
//   credits: 6
//   ---
//   freeform body...
//
// This module owns only the envelope (splitting / re-joining the frontmatter
// block); the Markdown body itself is round-tripped by the editor.

export type Frontmatter = Record<string, unknown>;

export interface ParsedDocument {
  frontmatter: Frontmatter;
  body: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseFrontmatter(raw: string): ParsedDocument {
  const normalized = raw.replace(/^﻿/, ""); // strip BOM
  const match = normalized.match(FRONTMATTER_RE);
  if (!match) {
    return { frontmatter: {}, body: normalized.replace(/\r\n/g, "\n") };
  }
  let frontmatter: Frontmatter = {};
  try {
    // JSON schema keeps values as plain string/number/boolean/null — no YAML
    // date objects or yes/no coercion — which matches the field editors and
    // round-trips cleanly.
    const loaded = yaml.load(match[1], { schema: yaml.JSON_SCHEMA });
    if (loaded && typeof loaded === "object" && !Array.isArray(loaded)) {
      frontmatter = loaded as Frontmatter;
    }
  } catch {
    // Malformed YAML: treat the whole file as body so nothing is lost.
    return { frontmatter: {}, body: normalized.replace(/\r\n/g, "\n") };
  }
  const body = normalized.slice(match[0].length).replace(/\r\n/g, "\n");
  return { frontmatter, body };
}

export function stringifyFrontmatter(
  frontmatter: Frontmatter,
  body: string,
): string {
  const keys = Object.keys(frontmatter);
  const trimmedBody = body.replace(/^\n+/, "");
  if (keys.length === 0) {
    return trimmedBody.endsWith("\n") || trimmedBody === ""
      ? trimmedBody
      : `${trimmedBody}\n`;
  }
  const yamlBlock = yaml.dump(frontmatter, { lineWidth: -1, sortKeys: false }).trimEnd();
  return `---\n${yamlBlock}\n---\n\n${trimmedBody}`.replace(/\n*$/, "\n");
}
