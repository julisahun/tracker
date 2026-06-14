import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import type { FieldDef, FieldType } from "./schema";
import { Checkbox } from "../components/Checkbox";
import { Select } from "../components/Select";

const TYPES: FieldType[] = ["text", "number", "boolean", "date", "select", "tags"];

const ctrl =
  "rounded-md border border-line bg-bg px-2 py-1 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

/** Drop blank/duplicate keys and tidy each field for persistence. */
export function cleanFields(fields: FieldDef[]): FieldDef[] {
  const seen = new Set<string>();
  const cleaned: FieldDef[] = [];
  for (const f of fields) {
    const key = f.key.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    cleaned.push({
      key,
      label: f.label.trim() || key,
      type: f.type,
      ...(f.type === "select" ? { options: f.options ?? [] } : {}),
      ...(f.default !== undefined && f.default !== "" ? { default: f.default } : {}),
    });
  }
  return cleaned;
}

/** Controlled editor for a list of schema fields. Shared by the modal and the
 *  full-page Manage fields view; owns no draft state of its own. */
export function SchemaFieldsEditor({
  fields,
  onChange,
}: {
  fields: FieldDef[];
  onChange: (next: FieldDef[]) => void;
}) {
  const patch = (i: number, p: Partial<FieldDef>) =>
    onChange(fields.map((f, idx) => (idx === i ? { ...f, ...p } : f)));
  const remove = (i: number) => onChange(fields.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () => onChange([...fields, { key: "", label: "", type: "text" }]);

  return (
    <div className="space-y-2">
      {fields.length === 0 && (
        <p className="py-6 text-center text-sm text-muted">No fields yet.</p>
      )}
      {fields.map((f, i) => (
        <div key={i} className="rounded-xl border border-line bg-bg/40 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={f.key}
              onChange={(e) => patch(i, { key: e.target.value })}
              placeholder="key"
              className={`${ctrl} w-32 font-mono`}
            />
            <input
              value={f.label}
              onChange={(e) => patch(i, { label: e.target.value })}
              placeholder="Label"
              className={`${ctrl} flex-1`}
            />
            <Select
              value={f.type}
              onChange={(v) => patch(i, { type: v as FieldType })}
              options={TYPES}
              className="w-32"
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
                title="Remove field"
                className="rounded p-1 text-muted hover:bg-danger-soft hover:text-danger"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {f.type !== "tags" && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {f.type === "select" && (
                <label className="flex items-center gap-1.5 text-muted">
                  Options
                  <input
                    value={(f.options ?? []).join(", ")}
                    onChange={(e) =>
                      patch(i, {
                        options: e.target.value
                          .split(",")
                          .map((o) => o.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="todo, doing, done"
                    className={`${ctrl} w-64`}
                  />
                </label>
              )}
              <label className="flex items-center gap-1.5 text-muted">
                Default
                {f.type === "boolean" ? (
                  <Checkbox
                    checked={f.default === true}
                    onChange={(v) => patch(i, { default: v })}
                  />
                ) : (
                  <input
                    value={f.default == null ? "" : String(f.default)}
                    onChange={(e) => patch(i, { default: e.target.value })}
                    className={`${ctrl} w-40`}
                  />
                )}
              </label>
            </div>
          )}
        </div>
      ))}

      <button
        onClick={add}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
      >
        <Plus size={15} /> Add field
      </button>
    </div>
  );
}
