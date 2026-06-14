import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { useStore } from "../state/store";
import { confirmDialog } from "../components/dialog";
import { parseBundle } from "./configBundle";

/**
 * Export / import the folder's `.tracker` config as a single JSON bundle.
 * Export downloads a file; import reads one, validates it, confirms the
 * (destructive) replace, and applies it. Lives in the sidebar footer.
 */
export function ConfigIO() {
  const rootName = useStore((s) => s.rootName);
  const exportConfig = useStore((s) => s.exportConfig);
  const importConfig = useStore((s) => s.importConfig);
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onExport = async () => {
    setBusy(true);
    try {
      const bundle = await exportConfig();
      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const slug = (rootName || "tracker").replace(/[^\w.-]+/g, "-");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}-config.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same file later
    if (!file) return;

    const result = parseBundle(await file.text());
    if (!result.ok) {
      await confirmDialog({
        title: "Couldn't import config",
        message: result.error,
        confirmLabel: "OK",
        cancelLabel: "Close",
      });
      return;
    }

    const parts = [
      result.bundle.schema && "fields",
      result.bundle.dashboard && "dashboard",
      result.bundle.phrases && "phrases",
    ].filter(Boolean) as string[];

    const ok = await confirmDialog({
      title: "Import config?",
      message: `This replaces the current ${parts.join(", ")} in “${rootName}”. Your tracked items are not affected.`,
      confirmLabel: "Import",
      danger: true,
    });
    if (!ok) return;

    setBusy(true);
    try {
      await importConfig(result.bundle);
    } finally {
      setBusy(false);
    }
  };

  const btn =
    "flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line px-2 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-raised hover:text-fg disabled:opacity-40";

  return (
    <div className="mx-3 mb-3 mt-1">
      <div className="mb-1 px-0.5 text-[11px] font-medium uppercase tracking-wide text-muted">
        Config
      </div>
      <div className="flex gap-1.5">
        <button className={btn} onClick={() => void onExport()} disabled={busy}>
          <Download size={13} /> Export
        </button>
        <button
          className={btn}
          onClick={() => fileInput.current?.click()}
          disabled={busy}
        >
          <Upload size={13} /> Import
        </button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => void onFile(e)}
      />
    </div>
  );
}
