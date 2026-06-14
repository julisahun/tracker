import {
  readFile,
  createFile,
  createDirectory,
} from "../fs/directory";
import type { Frontmatter } from "../format/frontmatter";
import { coerceValue, type FieldDef, type Schema } from "../schema/schema";
import { compile, exprTruthy, exprToNumber, type CompiledExpr } from "./expr";

// A dashboard is a set of user-defined metrics computed over every item in the
// folder, grouped/aggregated by a schema field. It lives alongside the schema at
// `<root>/.tracker/dashboard.json` and is edited in-app, mirroring the schema flow.
//
// Beyond simple per-field metrics, a metric may transform/merge data:
//   - `value`  an expression evaluated per item instead of reading one field
//              (e.g. `price * quantity`, `coalesce(owner, team)`)
//   - `filter` a boolean expression scoping which items are counted
//   - `bins`   numeric thresholds turning a number into labeled range buckets
//   - `groupBy2` a second dimension for count metrics → a pivot / cross-tab
//   - ratio kind: Σ(numerator) / Σ(denominator) across items, shown as a percentage.
//              Numbers are summed; a boolean numerator sums to 1/0 per item, so it
//              doubles as "% of items matching". Denominator defaults to item count.
// See `expr.ts` for the (eval-free) expression language.

export type MetricKind = "count" | "aggregate" | "boolean" | "ratio";
export type Aggregation = "sum" | "avg" | "min" | "max";
export type ChartStyle = "bar" | "donut";

export interface MetricDef {
  /** Stable id, used as React key and for reordering. */
  id: string;
  title: string;
  /** The `FieldDef.key` this metric reads (the value source when `value` is unset). */
  field: string;
  kind: MetricKind;
  /** Required when `kind === "aggregate"`. */
  agg?: Aggregation;
  /** Display style for count/boolean metrics; defaults to "bar". */
  chart?: ChartStyle;
  /** Expression used as the per-item value, overriding `field` when present. */
  value?: string;
  /** Boolean expression; items that fail it are excluded before computing. */
  filter?: string;
  /** Ascending thresholds; bucket a numeric value into ranges (count kind). */
  bins?: number[];
  /** Second dimension (field key or expression) → pivot/cross-tab (count kind). */
  groupBy2?: string;
  /** Numerator expression, summed across items (booleans sum to 1/0). */
  ratioNumerator?: string;
  /** Denominator expression, summed across items; defaults to the item count. */
  ratioDenominator?: string;
}

export interface Dashboard {
  metrics: MetricDef[];
}

const SCHEMA_DIR = ".tracker";
const DASHBOARD_FILE = "dashboard.json";

const EMPTY_LABEL = "(empty)";

export function emptyDashboard(): Dashboard {
  return { metrics: [] };
}

/** Which metric kinds make sense for a given field type. First entry is the default. */
export function kindsForFieldType(type: FieldDef["type"]): MetricKind[] {
  switch (type) {
    case "number":
      return ["aggregate", "count"];
    case "boolean":
      return ["boolean", "count"];
    default: // text, date, select, tags
      return ["count"];
  }
}

/**
 * Kinds offered in the editor for a metric. `ratio` is always available (it is
 * filter-driven, not field-driven). When a `value` expression is set the value
 * type is unknown statically, so every kind is offered.
 */
export function kindsForMetric(
  fieldType: FieldDef["type"] | undefined,
  hasValueExpr: boolean,
): MetricKind[] {
  const base: MetricKind[] = hasValueExpr
    ? ["count", "aggregate", "boolean"]
    : [...kindsForFieldType(fieldType ?? "text")];
  return [...base, "ratio"];
}

// ---- Aggregation (pure) -------------------------------------------------

export interface PivotResult {
  /** Series keys (second-dimension values), used as stacked bar segments / table columns. */
  series: string[];
  /** One row per primary value; `label` plus a count under each series key. */
  data: Array<Record<string, string | number>>;
}

export interface MetricResult {
  def: MetricDef;
  /** For count + boolean kinds: one bucket per value, sorted desc by count. */
  groups?: { label: string; value: number }[];
  /** For aggregate kind: the computed scalar, or null when no numeric values. */
  scalar?: number | null;
  /** For count kind with a second dimension: a row × series cross-tab. */
  pivot?: PivotResult;
  /** For ratio kind: matching items over the denominator population. */
  ratio?: { numerator: number; denominator: number };
  /** Number of items that contributed to the result. */
  total: number;
  /** Expression compile error to surface on the card, if any. */
  error?: string;
}

function fieldFor(schema: Schema, key: string): FieldDef | undefined {
  return schema.fields.find((f) => f.key === key);
}

/** Per-item value source: the `value` expression if set, else the raw field value. */
function selectValue(
  def: MetricDef,
  valueExpr: CompiledExpr,
  schema: Schema,
  fm: Frontmatter,
): unknown {
  if (def.value && def.value.trim()) return valueExpr.eval(fm, schema);
  const field = fieldFor(schema, def.field);
  return field ? coerceValue(field, fm[def.field]) : fm[def.field];
}

/** Label a numeric value against ascending bin thresholds (e.g. "50–100", "500+"). */
function binLabel(value: number, bins: number[]): string {
  if (value < bins[0]) return `< ${bins[0]}`;
  for (let i = 0; i < bins.length - 1; i++) {
    if (value < bins[i + 1]) return `${bins[i]}–${bins[i + 1]}`;
  }
  return `${bins[bins.length - 1]}+`;
}

/** Turn one item's source value into the label(s) it contributes to a count. */
function countLabels(value: unknown, def: MetricDef): string[] {
  if (Array.isArray(value)) {
    return value.length === 0 ? [EMPTY_LABEL] : value.map((v) => String(v));
  }
  if (def.bins && def.bins.length > 0 && typeof value === "number" && !Number.isNaN(value)) {
    return [binLabel(value, def.bins)];
  }
  return [value === "" || value == null ? EMPTY_LABEL : String(value)];
}

function sortGroups(counts: Map<string, number>): { label: string; value: number }[] {
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function computeCount(
  def: MetricDef,
  valueExpr: CompiledExpr,
  schema: Schema,
  frontmatters: Frontmatter[],
): { groups: { label: string; value: number }[]; total: number } {
  const counts = new Map<string, number>();
  const bump = (label: string) =>
    counts.set(label, (counts.get(label) ?? 0) + 1);

  for (const fm of frontmatters) {
    for (const label of countLabels(selectValue(def, valueExpr, schema, fm), def)) {
      bump(label);
    }
  }
  return { groups: sortGroups(counts), total: frontmatters.length };
}

function computePivot(
  def: MetricDef,
  valueExpr: CompiledExpr,
  group2Expr: CompiledExpr,
  schema: Schema,
  frontmatters: Frontmatter[],
): { pivot: PivotResult; total: number } {
  const group2Field = fieldFor(schema, def.groupBy2 ?? "");
  const colValue = (fm: Frontmatter): unknown =>
    def.groupBy2 && !group2Field
      ? group2Expr.eval(fm, schema)
      : group2Field
        ? coerceValue(group2Field, fm[def.groupBy2 ?? ""])
        : "";

  const rowTotals = new Map<string, number>();
  const cell = new Map<string, Map<string, number>>();
  const seriesSet = new Set<string>();

  for (const fm of frontmatters) {
    const rowLabels = countLabels(selectValue(def, valueExpr, schema, fm), def);
    const colLabels = countLabels(colValue(fm), { ...def, bins: undefined });
    for (const row of rowLabels) {
      rowTotals.set(row, (rowTotals.get(row) ?? 0) + 1);
      let m = cell.get(row);
      if (!m) cell.set(row, (m = new Map()));
      for (const col of colLabels) {
        m.set(col, (m.get(col) ?? 0) + 1);
        seriesSet.add(col);
      }
    }
  }

  const series = [...seriesSet].sort((a, b) => a.localeCompare(b));
  const rows = [...rowTotals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([row]) => row);

  const data = rows.map((row) => {
    const m = cell.get(row);
    const entry: Record<string, string | number> = { label: row };
    for (const s of series) entry[s] = m?.get(s) ?? 0;
    return entry;
  });

  return { pivot: { series, data }, total: frontmatters.length };
}

function computeBoolean(
  def: MetricDef,
  valueExpr: CompiledExpr,
  schema: Schema,
  frontmatters: Frontmatter[],
): { groups: { label: string; value: number }[]; total: number } {
  let yes = 0;
  let no = 0;
  for (const fm of frontmatters) {
    if (exprTruthy(selectValue(def, valueExpr, schema, fm))) yes++;
    else no++;
  }
  return {
    groups: [
      { label: "Yes", value: yes },
      { label: "No", value: no },
    ],
    total: frontmatters.length,
  };
}

function computeAggregate(
  def: MetricDef,
  valueExpr: CompiledExpr,
  schema: Schema,
  frontmatters: Frontmatter[],
): { scalar: number | null; total: number } {
  const nums: number[] = [];
  for (const fm of frontmatters) {
    const n = exprToNumber(selectValue(def, valueExpr, schema, fm));
    if (!Number.isNaN(n)) nums.push(n);
  }
  if (nums.length === 0) return { scalar: null, total: 0 };

  const agg = def.agg ?? "sum";
  let scalar: number;
  switch (agg) {
    case "avg":
      scalar = nums.reduce((a, b) => a + b, 0) / nums.length;
      break;
    case "min":
      scalar = Math.min(...nums);
      break;
    case "max":
      scalar = Math.max(...nums);
      break;
    default: // sum
      scalar = nums.reduce((a, b) => a + b, 0);
  }
  return { scalar, total: nums.length };
}

function computeRatio(
  numExpr: CompiledExpr,
  denExpr: CompiledExpr,
  hasDenominator: boolean,
  schema: Schema,
  frontmatters: Frontmatter[],
): { ratio: { numerator: number; denominator: number }; total: number } {
  // Σ(numerator) / Σ(denominator). Numbers add; booleans add 1/0. Non-numeric
  // (empty/NaN) values contribute 0. Without a denominator expression each item
  // counts as 1, so a boolean numerator yields "matching / total items".
  let numerator = 0;
  let denominator = 0;
  for (const fm of frontmatters) {
    const n = exprToNumber(numExpr.eval(fm, schema));
    if (!Number.isNaN(n)) numerator += n;
    if (hasDenominator) {
      const d = exprToNumber(denExpr.eval(fm, schema));
      if (!Number.isNaN(d)) denominator += d;
    } else {
      denominator += 1;
    }
  }
  return { ratio: { numerator, denominator }, total: frontmatters.length };
}

/** First non-empty compile error among a metric's expressions, for the card. */
function firstError(...compiled: CompiledExpr[]): string | undefined {
  return compiled.find((c) => c.error)?.error;
}

/** Compute a single metric over all items' frontmatter. Pure + DOM-free. */
export function computeMetric(
  def: MetricDef,
  schema: Schema,
  frontmatters: Frontmatter[],
): MetricResult {
  const valueExpr = compile(def.value);
  const filterExpr = compile(def.filter);

  // Ratio is filter-driven and ignores field/value entirely.
  if (def.kind === "ratio") {
    const numExpr = compile(def.ratioNumerator);
    const denExpr = compile(def.ratioDenominator);
    const error = firstError(filterExpr, numExpr, denExpr);
    const scoped = def.filter
      ? frontmatters.filter((fm) => exprTruthy(filterExpr.eval(fm, schema)))
      : frontmatters;
    const hasDen = !!(def.ratioDenominator && def.ratioDenominator.trim());
    return { def, error, ...computeRatio(numExpr, denExpr, hasDen, schema, scoped) };
  }

  // Non-ratio kinds need a value source: either a `value` expr or a known field.
  const hasValueExpr = !!(def.value && def.value.trim());
  if (!hasValueExpr && !fieldFor(schema, def.field)) {
    return { def, total: 0, groups: [], error: firstError(valueExpr, filterExpr) };
  }

  const scoped = def.filter
    ? frontmatters.filter((fm) => exprTruthy(filterExpr.eval(fm, schema)))
    : frontmatters;

  switch (def.kind) {
    case "boolean":
      return {
        def,
        error: firstError(valueExpr, filterExpr),
        ...computeBoolean(def, valueExpr, schema, scoped),
      };
    case "aggregate":
      return {
        def,
        error: firstError(valueExpr, filterExpr),
        ...computeAggregate(def, valueExpr, schema, scoped),
      };
    default: {
      // count — pivot when a second dimension is configured
      if (def.groupBy2 && def.groupBy2.trim()) {
        const group2Expr = compile(def.groupBy2);
        return {
          def,
          error: firstError(valueExpr, filterExpr, group2Expr),
          ...computePivot(def, valueExpr, group2Expr, schema, scoped),
        };
      }
      return {
        def,
        error: firstError(valueExpr, filterExpr),
        ...computeCount(def, valueExpr, schema, scoped),
      };
    }
  }
}

// ---- Config IO over the root directory handle --------------------------

async function readDashboardFile(
  root: FileSystemDirectoryHandle,
): Promise<string | null> {
  try {
    const dir = await root.getDirectoryHandle(SCHEMA_DIR);
    const file = await dir.getFileHandle(DASHBOARD_FILE);
    return await readFile(file);
  } catch {
    return null;
  }
}

export async function loadDashboard(
  root: FileSystemDirectoryHandle,
): Promise<Dashboard | null> {
  const raw = await readDashboardFile(root);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.metrics)) return parsed as Dashboard;
  } catch {
    /* fall through */
  }
  return null;
}

export async function saveDashboard(
  root: FileSystemDirectoryHandle,
  dashboard: Dashboard,
): Promise<void> {
  const dir = await createDirectory(root, SCHEMA_DIR);
  await createFile(dir, DASHBOARD_FILE, JSON.stringify(dashboard, null, 2) + "\n");
}

/** Return the saved dashboard, or an empty one (metrics are added in-app). */
export async function ensureDashboard(
  root: FileSystemDirectoryHandle,
): Promise<Dashboard> {
  return (await loadDashboard(root)) ?? emptyDashboard();
}
