import { useState } from "react";
import { SlidersHorizontal, Save, Check } from "lucide-react";
import { useStore } from "../state/store";
import type { FieldDef } from "./schema";
import { SchemaFieldsEditor, cleanFields } from "./SchemaFieldsEditor";

export function SchemaView() {
  const schema = useStore((s) => s.schema);
  const updateSchema = useStore((s) => s.updateSchema);

  const [fields, setFields] = useState<FieldDef[]>(() =>
    schema.fields.map((f) => ({ ...f })),
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const change = (next: FieldDef[]) => {
    setFields(next);
    setDirty(true);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const cleaned = cleanFields(fields);
      await updateSchema({ fields: cleaned });
      setFields(cleaned.map((f) => ({ ...f })));
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <header className="flex items-center justify-between gap-3 border-b border-line px-7 py-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent-soft text-accent-soft-fg">
            <SlidersHorizontal size={17} />
          </span>
          <div>
            <h1 className="text-base font-semibold leading-tight">Manage fields</h1>
            <p className="text-xs text-muted">
              Shared by every item in this folder.
            </p>
          </div>
        </div>
        <button
          onClick={() => void save()}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          {saving ? <Check size={15} /> : <Save size={15} />}
          {saving ? "Saving…" : "Save schema"}
        </button>
      </header>

      <div className="flex-1 p-7">
        <div className="mx-auto max-w-2xl">
          <SchemaFieldsEditor fields={fields} onChange={change} />
        </div>
      </div>
    </div>
  );
}
