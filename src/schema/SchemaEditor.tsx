import { useState } from "react";
import { X } from "lucide-react";
import type { FieldDef, Schema } from "./schema";
import { SchemaFieldsEditor, cleanFields } from "./SchemaFieldsEditor";

interface SchemaEditorProps {
  schema: Schema;
  onClose: () => void;
  onSave: (next: Schema) => void;
}

export function SchemaEditor({ schema, onClose, onSave }: SchemaEditorProps) {
  const [fields, setFields] = useState<FieldDef[]>(() =>
    schema.fields.map((f) => ({ ...f })),
  );

  const save = () => {
    onSave({ fields: cleanFields(fields) });
    onClose();
  };

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
            <h2 className="text-sm font-semibold">Manage fields</h2>
            <p className="text-xs text-muted">
              Shared by every item in this folder.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted transition-colors hover:bg-raised hover:text-fg"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <SchemaFieldsEditor fields={fields} onChange={setFields} />
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
            Save schema
          </button>
        </div>
      </div>
    </div>
  );
}
