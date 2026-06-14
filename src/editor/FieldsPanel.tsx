import { useState } from "react";
import { Settings2, X } from "lucide-react";
import type { Frontmatter } from "../format/frontmatter";
import type { FieldDef, Schema } from "../schema/schema";
import { Checkbox } from "../components/Checkbox";
import { Select } from "../components/Select";

interface FieldsPanelProps {
  schema: Schema;
  frontmatter: Frontmatter;
  onChange: (next: Frontmatter) => void;
  onManageFields: () => void;
}

const inputClass =
  "w-full rounded-md border border-line bg-bg px-2.5 py-1 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30";

/** Renders the schema's fields (in order) as an editable, typed form. */
export function FieldsPanel({
  schema,
  frontmatter,
  onChange,
  onManageFields,
}: FieldsPanelProps) {
  const setValue = (key: string, value: unknown) =>
    onChange({ ...frontmatter, [key]: value });

  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">
          Fields
        </span>
        <button
          onClick={onManageFields}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent-soft"
        >
          <Settings2 size={13} /> Manage fields
        </button>
      </div>

      {schema.fields.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted">
          No fields defined yet — use “Manage fields”.
        </p>
      ) : (
        <div className="divide-y divide-line">
          {schema.fields.map((field) => (
            <div key={field.key} className="flex items-center gap-3 px-4 py-2">
              <label className="w-36 shrink-0 truncate text-sm font-medium text-muted">
                {field.label || field.key}
              </label>
              <FieldWidget
                field={field}
                value={frontmatter[field.key]}
                onChange={(v) => setValue(field.key, v)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FieldWidget({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (field.type) {
    case "boolean":
      return <Checkbox checked={value === true} onChange={onChange} />;
    case "number":
      return (
        <input
          type="number"
          value={typeof value === "number" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          className={inputClass}
        />
      );
    case "date":
      return (
        <input
          type="date"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      );
    case "select":
      return (
        <Select
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
          options={field.options ?? []}
          placeholder="—"
          allowEmpty
          className="w-full"
        />
      );
    case "tags":
      return (
        <TagsInput
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange}
        />
      );
    default:
      return (
        <input
          type="text"
          value={value == null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      );
  }
}

function TagsInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const t = draft.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft("");
  };

  return (
    <div className="flex w-full flex-wrap items-center gap-1.5 rounded-md border border-line bg-bg px-2 py-1 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-soft-fg"
        >
          {tag}
          <button
            onClick={() => onChange(value.filter((t) => t !== tag))}
            className="text-accent-soft-fg/70 hover:text-accent-soft-fg"
          >
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && draft === "" && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={add}
        placeholder={value.length ? "" : "Add tag…"}
        className="min-w-16 flex-1 bg-transparent py-0.5 text-sm outline-none"
      />
    </div>
  );
}
