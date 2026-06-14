import { coerceValue, type Schema } from "../schema/schema";
import type { Frontmatter } from "../format/frontmatter";

// A tiny, safe expression language used by dashboard metrics for derived values
// (`price * quantity`, `coalesce(owner, team)`) and filters (`status != "done"`).
//
// It is a hand-written tokenizer → Pratt parser → tree-walking evaluator. There
// is deliberately NO `eval`/`new Function`: the app runs in a secure context and
// must never execute arbitrary strings. Parsing is validated up front (so the
// editor can show errors); evaluation is null-safe and never throws at runtime —
// bad input degrades to an empty value rather than blowing up a metric.

// ---- AST ---------------------------------------------------------------

type Node =
  | { type: "num"; value: number }
  | { type: "str"; value: string }
  | { type: "bool"; value: boolean }
  | { type: "field"; key: string }
  | { type: "unary"; op: string; operand: Node }
  | { type: "binary"; op: string; left: Node; right: Node }
  | { type: "call"; name: string; args: Node[] };

/** Functions the language exposes, with their arity check (min args). */
const FUNCTIONS = new Set([
  "coalesce",
  "concat",
  "if",
  "lower",
  "upper",
  "abs",
  "round",
  "min",
  "max",
  "len",
  "contains",
]);

// ---- Tokenizer ---------------------------------------------------------

interface Token {
  kind: "num" | "str" | "ident" | "op";
  value: string;
}

const OPERATORS = [
  "==",
  "!=",
  "<=",
  ">=",
  "&&",
  "||",
  "<",
  ">",
  "+",
  "-",
  "*",
  "/",
  "%",
  "!",
  "(",
  ")",
  ",",
];

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = src.length;

  while (i < n) {
    const c = src[i];

    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }

    // String literal: "..." or '...'
    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      let str = "";
      while (j < n && src[j] !== quote) {
        if (src[j] === "\\" && j + 1 < n) {
          str += src[j + 1];
          j += 2;
        } else {
          str += src[j];
          j++;
        }
      }
      if (j >= n) throw new ExprError("Unterminated string");
      tokens.push({ kind: "str", value: str });
      i = j + 1;
      continue;
    }

    // Bracketed identifier: [key with spaces]
    if (c === "[") {
      const close = src.indexOf("]", i + 1);
      if (close === -1) throw new ExprError("Unterminated [field]");
      tokens.push({ kind: "ident", value: src.slice(i + 1, close).trim() });
      i = close + 1;
      continue;
    }

    // Number
    if (c >= "0" && c <= "9") {
      let j = i;
      while (j < n && ((src[j] >= "0" && src[j] <= "9") || src[j] === ".")) j++;
      tokens.push({ kind: "num", value: src.slice(i, j) });
      i = j;
      continue;
    }

    // Identifier / keyword
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
      tokens.push({ kind: "ident", value: src.slice(i, j) });
      i = j;
      continue;
    }

    // Operators (longest match first)
    const two = src.slice(i, i + 2);
    if (OPERATORS.includes(two)) {
      tokens.push({ kind: "op", value: two });
      i += 2;
      continue;
    }
    if (OPERATORS.includes(c)) {
      tokens.push({ kind: "op", value: c });
      i++;
      continue;
    }

    throw new ExprError(`Unexpected character "${c}"`);
  }

  return tokens;
}

class ExprError extends Error {}

// ---- Parser (precedence climbing) --------------------------------------

// Lowest binds loosest. Unary and primary are handled separately.
const BINARY_PRECEDENCE: Record<string, number> = {
  "||": 1,
  "&&": 2,
  "==": 3,
  "!=": 3,
  "<": 4,
  "<=": 4,
  ">": 4,
  ">=": 4,
  "+": 5,
  "-": 5,
  "*": 6,
  "/": 6,
  "%": 6,
};

function parse(tokens: Token[]): Node {
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseExpr(minPrec: number): Node {
    let left = parseUnary();
    while (true) {
      const tok = peek();
      if (!tok || tok.kind !== "op") break;
      const prec = BINARY_PRECEDENCE[tok.value];
      if (prec === undefined || prec < minPrec) break;
      next();
      const right = parseExpr(prec + 1);
      left = { type: "binary", op: tok.value, left, right };
    }
    return left;
  }

  function parseUnary(): Node {
    const tok = peek();
    if (tok && tok.kind === "op" && (tok.value === "-" || tok.value === "!")) {
      next();
      return { type: "unary", op: tok.value, operand: parseUnary() };
    }
    return parsePrimary();
  }

  function parsePrimary(): Node {
    const tok = next();
    if (!tok) throw new ExprError("Unexpected end of expression");

    if (tok.kind === "num") {
      const value = Number(tok.value);
      if (Number.isNaN(value)) throw new ExprError(`Invalid number "${tok.value}"`);
      return { type: "num", value };
    }
    if (tok.kind === "str") return { type: "str", value: tok.value };

    if (tok.kind === "ident") {
      if (tok.value === "true") return { type: "bool", value: true };
      if (tok.value === "false") return { type: "bool", value: false };
      // Function call?
      if (peek() && peek().kind === "op" && peek().value === "(") {
        next(); // consume "("
        const args: Node[] = [];
        if (!(peek() && peek().kind === "op" && peek().value === ")")) {
          args.push(parseExpr(1));
          while (peek() && peek().kind === "op" && peek().value === ",") {
            next();
            args.push(parseExpr(1));
          }
        }
        const close = next();
        if (!close || close.value !== ")") throw new ExprError("Expected )");
        if (!FUNCTIONS.has(tok.value))
          throw new ExprError(`Unknown function "${tok.value}"`);
        return { type: "call", name: tok.value, args };
      }
      return { type: "field", key: tok.value };
    }

    if (tok.kind === "op" && tok.value === "(") {
      const inner = parseExpr(1);
      const close = next();
      if (!close || close.value !== ")") throw new ExprError("Expected )");
      return inner;
    }

    throw new ExprError(`Unexpected token "${tok.value}"`);
  }

  const node = parseExpr(1);
  if (pos < tokens.length)
    throw new ExprError(`Unexpected token "${tokens[pos].value}"`);
  return node;
}

// ---- Value helpers -----------------------------------------------------

function isEmpty(v: unknown): boolean {
  return (
    v == null ||
    v === "" ||
    (Array.isArray(v) && v.length === 0) ||
    (typeof v === "number" && Number.isNaN(v))
  );
}

function truthy(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0 && !Number.isNaN(v);
  return !isEmpty(v);
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string" && v.trim() !== "") return Number(v);
  return NaN;
}

function toStr(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

function looseEquals(a: unknown, b: unknown): boolean {
  const na = toNumber(a);
  const nb = toNumber(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na === nb;
  return toStr(a) === toStr(b);
}

function compare(a: unknown, b: unknown): number {
  const na = toNumber(a);
  const nb = toNumber(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return toStr(a).localeCompare(toStr(b));
}

// ---- Evaluator ---------------------------------------------------------

function resolveField(key: string, fm: Frontmatter, schema: Schema): unknown {
  const field = schema.fields.find((f) => f.key === key);
  if (field) return coerceValue(field, fm[key]);
  // Non-schema keys are preserved in frontmatter; surface them raw.
  return key in fm ? fm[key] : "";
}

function evalNode(node: Node, fm: Frontmatter, schema: Schema): unknown {
  switch (node.type) {
    case "num":
      return node.value;
    case "str":
      return node.value;
    case "bool":
      return node.value;
    case "field":
      return resolveField(node.key, fm, schema);
    case "unary": {
      const v = evalNode(node.operand, fm, schema);
      return node.op === "!" ? !truthy(v) : -toNumber(v);
    }
    case "binary":
      return evalBinary(node, fm, schema);
    case "call":
      return evalCall(node, fm, schema);
  }
}

function evalBinary(
  node: Extract<Node, { type: "binary" }>,
  fm: Frontmatter,
  schema: Schema,
): unknown {
  const { op } = node;
  // Short-circuit logical operators.
  if (op === "&&") {
    return truthy(evalNode(node.left, fm, schema)) &&
      truthy(evalNode(node.right, fm, schema));
  }
  if (op === "||") {
    return truthy(evalNode(node.left, fm, schema)) ||
      truthy(evalNode(node.right, fm, schema));
  }

  const l = evalNode(node.left, fm, schema);
  const r = evalNode(node.right, fm, schema);

  switch (op) {
    case "+":
      // String concat when either side is a (non-numeric) string.
      if (typeof l === "string" || typeof r === "string") return toStr(l) + toStr(r);
      return toNumber(l) + toNumber(r);
    case "-":
      return toNumber(l) - toNumber(r);
    case "*":
      return toNumber(l) * toNumber(r);
    case "/":
      return toNumber(l) / toNumber(r);
    case "%":
      return toNumber(l) % toNumber(r);
    case "==":
      return looseEquals(l, r);
    case "!=":
      return !looseEquals(l, r);
    case "<":
      return compare(l, r) < 0;
    case "<=":
      return compare(l, r) <= 0;
    case ">":
      return compare(l, r) > 0;
    case ">=":
      return compare(l, r) >= 0;
    default:
      return "";
  }
}

function evalCall(
  node: Extract<Node, { type: "call" }>,
  fm: Frontmatter,
  schema: Schema,
): unknown {
  const args = node.args.map((a) => evalNode(a, fm, schema));
  switch (node.name) {
    case "coalesce":
      return args.find((a) => !isEmpty(a)) ?? "";
    case "concat":
      return args.map(toStr).join("");
    case "if":
      return truthy(args[0]) ? args[1] ?? "" : args[2] ?? "";
    case "lower":
      return toStr(args[0]).toLowerCase();
    case "upper":
      return toStr(args[0]).toUpperCase();
    case "abs":
      return Math.abs(toNumber(args[0]));
    case "round": {
      const d = args.length > 1 ? Math.trunc(toNumber(args[1])) : 0;
      const f = Math.pow(10, Number.isNaN(d) ? 0 : d);
      return Math.round(toNumber(args[0]) * f) / f;
    }
    case "min":
      return Math.min(...args.map(toNumber).filter((n) => !Number.isNaN(n)));
    case "max":
      return Math.max(...args.map(toNumber).filter((n) => !Number.isNaN(n)));
    case "len": {
      const v = args[0];
      if (Array.isArray(v)) return v.length;
      return toStr(v).length;
    }
    case "contains": {
      const list = args[0];
      const needle = args[1];
      if (Array.isArray(list)) return list.some((x) => looseEquals(x, needle));
      return toStr(list).includes(toStr(needle));
    }
    default:
      return "";
  }
}

// ---- Public API --------------------------------------------------------

export interface CompiledExpr {
  /** Evaluate against one item's frontmatter. Never throws. */
  eval: (fm: Frontmatter, schema: Schema) => unknown;
  /** Parse error message, if the source was invalid. */
  error?: string;
}

const EMPTY: CompiledExpr = { eval: () => "" };

/**
 * Parse `src` once into a reusable evaluator. Empty/blank source compiles to a
 * no-op (returns ""). Syntax errors are returned on `.error` and `.eval`
 * degrades to "" so callers can still render the metric.
 */
export function compile(src: string | undefined | null): CompiledExpr {
  if (!src || !src.trim()) return EMPTY;
  let ast: Node;
  try {
    ast = parse(tokenize(src));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid expression";
    return { eval: () => "", error: msg };
  }
  return {
    eval: (fm, schema) => {
      try {
        return evalNode(ast, fm, schema);
      } catch {
        return "";
      }
    },
  };
}

/** Convenience: is this a syntactically valid (or empty) expression? */
export function exprError(src: string | undefined | null): string | undefined {
  return compile(src).error;
}

// Re-exported helpers used by the metric layer for consistent coercion.
export { isEmpty as isExprEmpty, truthy as exprTruthy, toNumber as exprToNumber };
