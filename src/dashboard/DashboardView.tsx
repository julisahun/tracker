import { useEffect, useState } from "react";
import { BarChart3, Settings2, Plus } from "lucide-react";
import { useStore } from "../state/store";
import { collectFrontmatters } from "../schema/schema";
import type { Frontmatter } from "../format/frontmatter";
import { computeMetric } from "./dashboard";
import { MetricCard } from "./MetricCard";
import { DashboardEditor } from "./DashboardEditor";

export function Dashboard() {
  const tree = useStore((s) => s.tree);
  const schema = useStore((s) => s.schema);
  const dashboard = useStore((s) => s.dashboard);
  const rootName = useStore((s) => s.rootName);
  const updateDashboard = useStore((s) => s.updateDashboard);

  const [frontmatters, setFrontmatters] = useState<Frontmatter[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void collectFrontmatters(tree).then((fms) => {
      if (!cancelled) {
        setFrontmatters(fms);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tree]);

  const metrics = dashboard.metrics;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <header className="flex items-center justify-between gap-3 border-b border-line px-7 py-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent-soft text-accent-soft-fg">
            <BarChart3 size={17} />
          </span>
          <div>
            <h1 className="text-base font-semibold leading-tight">{rootName}</h1>
            <p className="text-xs text-muted">
              {loading
                ? "Loading items…"
                : `${frontmatters.length} item${frontmatters.length === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
        >
          <Settings2 size={15} /> Configure
        </button>
      </header>

      <div className="flex-1 p-7">
        {metrics.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-2xl border border-line bg-surface text-muted">
              <BarChart3 size={28} />
            </span>
            <p className="max-w-xs text-sm text-muted">
              No metrics yet. Add one to start tracking totals and distributions
              across your items.
            </p>
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
            >
              <Plus size={16} /> Add metric
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {metrics.map((def) => (
              <MetricCard
                key={def.id}
                result={computeMetric(def, schema, frontmatters)}
              />
            ))}
          </div>
        )}
      </div>

      {editing && (
        <DashboardEditor
          dashboard={dashboard}
          schema={schema}
          onClose={() => setEditing(false)}
          onSave={(next) => void updateDashboard(next)}
        />
      )}
    </div>
  );
}
