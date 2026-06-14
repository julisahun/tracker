import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { AlertTriangle, Table2, BarChart3 } from "lucide-react";
import type { MetricResult, PivotResult } from "./dashboard";
import { useThemeColors } from "./useThemeColors";

const AGG_LABEL: Record<string, string> = {
  sum: "Sum",
  avg: "Average",
  min: "Minimum",
  max: "Maximum",
};

function formatScalar(n: number): string {
  // Trim noisy floats (e.g. averages) without forcing decimals on integers.
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function MetricCard({ result }: { result: MetricResult }) {
  const { def, groups, scalar, pivot, ratio, total, error } = result;
  const colors = useThemeColors();

  const headerNote =
    def.kind === "aggregate"
      ? AGG_LABEL[def.agg ?? "sum"]
      : def.kind === "ratio"
        ? "Ratio"
        : `${total} item${total === 1 ? "" : "s"}`;

  return (
    <div className="flex flex-col rounded-2xl border border-line bg-surface p-4">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h3 className="truncate text-sm font-semibold" title={def.title}>
          {def.title}
        </h3>
        <span className="shrink-0 text-xs text-muted">{headerNote}</span>
      </div>

      {error ? (
        <ExprErrorNote message={error} />
      ) : def.kind === "ratio" ? (
        <Ratio ratio={ratio} />
      ) : def.kind === "aggregate" ? (
        groups ? ( // grouped aggregate → one bar per category
          groups.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No data yet.</p>
          ) : (
            <Bars groups={groups} colors={colors} />
          )
        ) : (
          <div className="flex flex-1 flex-col justify-center py-4">
            <span className="text-4xl font-semibold tracking-tight text-accent">
              {scalar == null ? "—" : formatScalar(scalar)}
            </span>
            <span className="mt-1 text-xs text-muted">
              {scalar == null
                ? "No numeric values"
                : `across ${total} item${total === 1 ? "" : "s"}`}
            </span>
          </div>
        )
      ) : pivot ? (
        <Pivot pivot={pivot} colors={colors} />
      ) : !groups || groups.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">No data yet.</p>
      ) : def.chart === "donut" ? (
        <Donut groups={groups} colors={colors} />
      ) : (
        <Bars groups={groups} colors={colors} />
      )}
    </div>
  );
}

function ExprErrorNote({ message }: { message: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-6 text-center">
      <AlertTriangle size={18} className="text-danger" />
      <p className="text-xs text-danger">Expression error</p>
      <p className="text-xs text-muted">{message}</p>
    </div>
  );
}

function Ratio({ ratio }: { ratio?: { numerator: number; denominator: number } }) {
  const pct =
    ratio && ratio.denominator > 0
      ? (ratio.numerator / ratio.denominator) * 100
      : null;
  return (
    <div className="flex flex-1 flex-col justify-center py-4">
      <span className="text-4xl font-semibold tracking-tight text-accent">
        {pct == null ? "—" : `${formatScalar(pct)}%`}
      </span>
      <span className="mt-1 text-xs text-muted">
        {ratio == null || ratio.denominator === 0
          ? "Nothing to measure"
          : `${formatScalar(ratio.numerator)} of ${formatScalar(ratio.denominator)}`}
      </span>
    </div>
  );
}

function chartTooltipStyle(colors: ReturnType<typeof useThemeColors>) {
  return {
    contentStyle: {
      background: colors.surface,
      border: `1px solid ${colors.line}`,
      borderRadius: 8,
      fontSize: 12,
      color: colors.fg,
    },
    labelStyle: { color: colors.fg },
    itemStyle: { color: colors.fg },
    cursor: { fill: colors.line, opacity: 0.4 },
  };
}

function Bars({
  groups,
  colors,
}: {
  groups: { label: string; value: number }[];
  colors: ReturnType<typeof useThemeColors>;
}) {
  const tip = chartTooltipStyle(colors);
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, groups.length * 34)}>
      <BarChart
        data={groups}
        layout="vertical"
        margin={{ top: 4, right: 12, bottom: 4, left: 4 }}
      >
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={90}
          tick={{ fill: colors.muted, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip {...tip} />
        <Bar dataKey="value" fill={colors.accent} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Donut({
  groups,
  colors,
}: {
  groups: { label: string; value: number }[];
  colors: ReturnType<typeof useThemeColors>;
}) {
  const tip = chartTooltipStyle(colors);
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={groups}
          dataKey="value"
          nameKey="label"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
          stroke={colors.surface}
        >
          {groups.map((g, i) => (
            <Cell key={g.label} fill={colors.series[i % colors.series.length]} />
          ))}
        </Pie>
        <Tooltip {...tip} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** A 2-field cross-tab: stacked bar by default, with a toggle to a raw table. */
function Pivot({
  pivot,
  colors,
}: {
  pivot: PivotResult;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  if (pivot.data.length === 0)
    return <p className="py-8 text-center text-sm text-muted">No data yet.</p>;

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-1 flex justify-end">
        <button
          onClick={() => setView(view === "chart" ? "table" : "chart")}
          title={view === "chart" ? "Show table" : "Show chart"}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted transition-colors hover:bg-raised hover:text-fg"
        >
          {view === "chart" ? <Table2 size={13} /> : <BarChart3 size={13} />}
          {view === "chart" ? "Table" : "Chart"}
        </button>
      </div>
      {view === "chart" ? (
        <PivotChart pivot={pivot} colors={colors} />
      ) : (
        <PivotTable pivot={pivot} />
      )}
    </div>
  );
}

function PivotChart({
  pivot,
  colors,
}: {
  pivot: PivotResult;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const tip = chartTooltipStyle(colors);
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, pivot.data.length * 38)}>
      <BarChart
        data={pivot.data}
        layout="vertical"
        margin={{ top: 4, right: 12, bottom: 4, left: 4 }}
      >
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={90}
          tick={{ fill: colors.muted, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip {...tip} />
        <Legend wrapperStyle={{ fontSize: 11, color: colors.muted }} />
        {pivot.series.map((s, i) => (
          <Bar
            key={s}
            dataKey={s}
            stackId="a"
            fill={colors.series[i % colors.series.length]}
            radius={i === pivot.series.length - 1 ? [0, 4, 4, 0] : 0}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function PivotTable({ pivot }: { pivot: PivotResult }) {
  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="text-muted">
            <th className="border-b border-line px-2 py-1 text-left font-medium"></th>
            {pivot.series.map((s) => (
              <th key={s} className="border-b border-line px-2 py-1 text-right font-medium">
                {s}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pivot.data.map((row) => (
            <tr key={String(row.label)}>
              <td className="border-b border-line px-2 py-1 text-left text-fg">
                {String(row.label)}
              </td>
              {pivot.series.map((s) => (
                <td key={s} className="border-b border-line px-2 py-1 text-right text-muted">
                  {row[s] as number}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
