import { useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, X } from "lucide-react";
import type { Schema } from "../schema/schema";
import { Select } from "../components/Select";
import { exprError } from "./expr";
import {
  kindsForMetric,
  type Aggregation,
  type ChartStyle,
  type Dashboard,
  type MetricDef,
  type MetricKind,
} from "./dashboard";

interface DashboardEditorProps {
  dashboard: Dashboard;
  schema: Schema;
  onClose: () => void;
  onSave: (next: Dashboard) => void;
}

const ctrl =
  "rounded-md border border-line bg-bg px-2 py-1 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

const KIND_LABELS: Record<MetricKind, string> = {
  count: "Count / distribution",
  aggregate: "Aggregate",
  boolean: "True / false split",
  ratio: "Ratio / percentage",
};
const AGGS: Aggregation[] = ["sum", "avg", "min", "max"];
const CHARTS: { value: ChartStyle; label: string }[] = [
  { value: "bar", label: "Bar" },
  { value: "donut", label: "Donut" },
];

let counter = 0;
const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `m${Date.now()}-${counter++}`;

function parseBins(text: string): number[] {
  return text
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);
}

/** A small expression text input with inline parse-error feedback. */
function ExprInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const error = exprError(value);
  return (
    <div className="flex-1">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        className={`${ctrl} w-full font-mono text-xs ${error ? "border-danger" : ""}`}
      />
      {error && <p className="mt-0.5 text-[11px] text-danger">{error}</p>}
    </div>
  );
}

export function DashboardEditor({
  dashboard,
  schema,
  onClose,
  onSave,
}: DashboardEditorProps) {
  const [metrics, setMetrics] = useState<MetricDef[]>(() =>
    dashboard.metrics.map((m) => ({ ...m })),
  );
  // Bins are edited as free text (so partial input like "0, 50," isn't clobbered).
  const [binsText, setBinsText] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      dashboard.metrics.map((m) => [m.id, (m.bins ?? []).join(", ")]),
    ),
  );

  const fieldOptions = schema.fields.map((f) => ({ value: f.key, label: f.label }));
  const group2Options = [{ value: "", label: "None" }, ...fieldOptions];
  const fieldType = (key: string) =>
    schema.fields.find((f) => f.key === key)?.type;

  const patch = (i: number, p: Partial<MetricDef>) =>
    setMetrics((ms) => ms.map((m, idx) => (idx === i ? { ...m, ...p } : m)));

  /** Switching field resets kind to the field's default and drops stale options. */
  const changeField = (i: number, field: string) => {
    const kinds = kindsForMetric(fieldType(field), !!metrics[i].value?.trim());
    const kind = kinds[0];
    patch(i, {
      field,
      kind,
      agg: kind === "aggregate" ? "sum" : undefined,
      chart: kind === "count" ? "bar" : undefined,
    });
  };

  const changeKind = (i: number, kind: MetricKind) =>
    patch(i, {
      kind,
      agg: kind === "aggregate" ? metrics[i].agg ?? "sum" : undefined,
      chart: kind === "count" ? metrics[i].chart ?? "bar" : undefined,
    });

  const remove = (i: number) =>
    setMetrics((ms) => ms.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) =>
    setMetrics((ms) => {
      const j = i + dir;
      if (j < 0 || j >= ms.length) return ms;
      const next = [...ms];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const add = () => {
    const first = schema.fields[0];
    const field = first?.key ?? "";
    const kind = kindsForMetric(first?.type, false)[0];
    setMetrics((ms) => [
      ...ms,
      {
        id: newId(),
        title: first?.label ?? "Metric",
        field,
        kind,
        agg: kind === "aggregate" ? "sum" : undefined,
        chart: kind === "count" ? "bar" : undefined,
      },
    ]);
  };

  const clean = (s: string | undefined) => {
    const t = s?.trim();
    return t ? t : undefined;
  };

  const save = () => {
    const cleaned: MetricDef[] = metrics
      .filter((m) => m.field || m.value?.trim() || m.kind === "ratio")
      .map((m) => {
        const isRatio = m.kind === "ratio";
        const isCount = m.kind === "count";
        const isAggregate = m.kind === "aggregate";
        const bins = parseBins(binsText[m.id] ?? "");
        return {
          id: m.id || newId(),
          title: m.title.trim() || m.field || "Metric",
          field: m.field,
          kind: m.kind,
          ...(m.kind === "aggregate" ? { agg: m.agg ?? "sum" } : {}),
          ...(isCount && !m.groupBy2?.trim() ? { chart: m.chart ?? "bar" } : {}),
          ...(!isRatio && clean(m.value) ? { value: clean(m.value) } : {}),
          ...(clean(m.filter) ? { filter: clean(m.filter) } : {}),
          ...(isCount && bins.length ? { bins } : {}),
          ...((isCount || isAggregate) && clean(m.groupBy2)
            ? { groupBy2: clean(m.groupBy2) }
            : {}),
          ...(isRatio && clean(m.ratioNumerator)
            ? { ratioNumerator: clean(m.ratioNumerator) }
            : {}),
          ...(isRatio && clean(m.ratioDenominator)
            ? { ratioDenominator: clean(m.ratioDenominator) }
            : {}),
        };
      });
    onSave({ metrics: cleaned });
    onClose();
  };

  const noFields = schema.fields.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold">Configure dashboard</h2>
            <p className="text-xs text-muted">
              Metrics computed across every item in this folder.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted transition-colors hover:bg-raised hover:text-fg"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-auto p-4">
          {noFields && (
            <p className="py-6 text-center text-sm text-muted">
              Add fields to the schema first (Manage fields).
            </p>
          )}
          {!noFields && metrics.length === 0 && (
            <p className="py-6 text-center text-sm text-muted">No metrics yet.</p>
          )}

          {metrics.map((m, i) => {
            const type = fieldType(m.field);
            const hasValueExpr = !!m.value?.trim();
            const kinds = kindsForMetric(type, hasValueExpr);
            const isRatio = m.kind === "ratio";
            const isCount = m.kind === "count";
            const isAggregate = m.kind === "aggregate";
            return (
              <div key={m.id} className="rounded-xl border border-line bg-bg/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={m.title}
                    onChange={(e) => patch(i, { title: e.target.value })}
                    placeholder="Metric title"
                    className={`${ctrl} flex-1`}
                  />
                  <div className="ml-auto flex items-center">
                    <button
                      onClick={() => move(i, -1)}
                      title="Move up"
                      className="rounded p-1 text-muted hover:bg-raised hover:text-fg"
                    >
                      <ChevronUp size={15} />
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      title="Move down"
                      className="rounded p-1 text-muted hover:bg-raised hover:text-fg"
                    >
                      <ChevronDown size={15} />
                    </button>
                    <button
                      onClick={() => remove(i)}
                      title="Remove metric"
                      className="rounded p-1 text-muted hover:bg-danger-soft hover:text-danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                  {!isRatio && (
                    <label className="flex items-center gap-1.5">
                      Field
                      <Select
                        value={m.field}
                        onChange={(v) => changeField(i, v)}
                        options={fieldOptions}
                        className="w-40"
                      />
                    </label>
                  )}

                  {kinds.length > 1 && (
                    <label className="flex items-center gap-1.5">
                      Show
                      <Select
                        value={m.kind}
                        onChange={(v) => changeKind(i, v as MetricKind)}
                        options={kinds.map((k) => ({ value: k, label: KIND_LABELS[k] }))}
                        className="w-44"
                      />
                    </label>
                  )}

                  {m.kind === "aggregate" && (
                    <label className="flex items-center gap-1.5">
                      Aggregation
                      <Select
                        value={m.agg ?? "sum"}
                        onChange={(v) => patch(i, { agg: v as Aggregation })}
                        options={AGGS}
                        className="w-28"
                      />
                    </label>
                  )}

                  {isCount && !m.groupBy2?.trim() && (
                    <label className="flex items-center gap-1.5">
                      Chart
                      <Select
                        value={m.chart ?? "bar"}
                        onChange={(v) => patch(i, { chart: v as ChartStyle })}
                        options={CHARTS}
                        className="w-28"
                      />
                    </label>
                  )}

                  {(isCount || isAggregate) && (
                    <label className="flex items-center gap-1.5">
                      Group by
                      <Select
                        value={m.groupBy2 ?? ""}
                        onChange={(v) => patch(i, { groupBy2: v || undefined })}
                        options={group2Options}
                        className="w-40"
                      />
                    </label>
                  )}
                </div>

                {/* Transforms / merges */}
                <div className="mt-2 space-y-1.5">
                  {!isRatio && (
                    <label className="flex items-center gap-2 text-xs text-muted">
                      <span className="w-14 shrink-0">Value</span>
                      <ExprInput
                        value={m.value ?? ""}
                        onChange={(v) => patch(i, { value: v })}
                        placeholder='expression, e.g. price * quantity — overrides Field'
                      />
                    </label>
                  )}

                  {isCount && (
                    <label className="flex items-center gap-2 text-xs text-muted">
                      <span className="w-14 shrink-0">Bins</span>
                      <input
                        value={binsText[m.id] ?? ""}
                        onChange={(e) =>
                          setBinsText((b) => ({ ...b, [m.id]: e.target.value }))
                        }
                        placeholder="numeric thresholds, e.g. 0, 50, 100, 500"
                        spellCheck={false}
                        className={`${ctrl} flex-1 font-mono text-xs`}
                      />
                    </label>
                  )}

                  {isRatio && (
                    <>
                      <label className="flex items-center gap-2 text-xs text-muted">
                        <span className="w-24 shrink-0">Numerator</span>
                        <ExprInput
                          value={m.ratioNumerator ?? ""}
                          onChange={(v) => patch(i, { ratioNumerator: v })}
                          placeholder='summed, e.g. answeredQuestions  (or status == "done")'
                        />
                      </label>
                      <label className="flex items-center gap-2 text-xs text-muted">
                        <span className="w-24 shrink-0">Denominator</span>
                        <ExprInput
                          value={m.ratioDenominator ?? ""}
                          onChange={(v) => patch(i, { ratioDenominator: v })}
                          placeholder="summed, e.g. nQuestions  — defaults to item count"
                        />
                      </label>
                    </>
                  )}

                  <label className="flex items-center gap-2 text-xs text-muted">
                    <span className={`shrink-0 ${isRatio ? "w-24" : "w-14"}`}>Filter</span>
                    <ExprInput
                      value={m.filter ?? ""}
                      onChange={(v) => patch(i, { filter: v })}
                      placeholder='scope items (optional), e.g. status != "archived"'
                    />
                  </label>
                </div>
              </div>
            );
          })}

          {!noFields && (
            <button
              onClick={add}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
            >
              <Plus size={15} /> Add metric
            </button>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-raised hover:text-fg"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
          >
            Save dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
