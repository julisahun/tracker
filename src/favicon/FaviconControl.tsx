import { useRef } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { useStore } from "../state/store";
import { confirmDialog } from "../components/dialog";
import { useFaviconImage } from "./useFaviconImage";

/**
 * Compact control for the workspace's custom browser-tab favicon, shown on the
 * root dashboard next to the banner. With no favicon it offers an upload button;
 * with one set it shows a small preview plus Change / Remove. Wired to the
 * single-value favicon config (one icon per workspace).
 */
export function FaviconControl() {
  const filename = useStore((s) => s.favicon.favicon);
  const setFavicon = useStore((s) => s.setFavicon);
  const removeFavicon = useStore((s) => s.removeFavicon);
  const url = useFaviconImage(filename ?? undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = () => inputRef.current?.click();

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (file) void setFavicon(file);
  };

  const remove = async () => {
    if (
      await confirmDialog({
        title: "Remove favicon?",
        message: "The image file will be deleted and the tab icon reset.",
        confirmLabel: "Remove",
        danger: true,
      })
    ) {
      void removeFavicon();
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-bg">
        {url ? (
          <img src={url} alt="" className="h-full w-full object-contain" />
        ) : (
          <ImagePlus size={15} className="text-muted" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Browser tab icon</p>
        <p className="text-xs text-muted">
          {filename
            ? "Shown in the tab while this folder is open."
            : "Use the default, or pick a custom icon for this folder."}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          onClick={pick}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs font-medium text-fg transition-colors hover:border-accent hover:text-accent"
        >
          <ImagePlus size={14} /> {filename ? "Change" : "Add icon"}
        </button>
        {filename && (
          <button
            onClick={() => void remove()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs font-medium text-fg transition-colors hover:border-danger hover:text-danger"
          >
            <Trash2 size={14} /> Remove
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFile}
      />
    </div>
  );
}
