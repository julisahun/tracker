import { useRef } from "react";
import { ImagePlus, Image as ImageIcon, Trash2 } from "lucide-react";
import { useStore } from "../state/store";
import { confirmDialog } from "../components/dialog";
import { useBannerImage } from "./useBannerImage";

interface BannerProps {
  /** Scope key: `""` for the root/general banner, else a folder path. */
  scopeKey: string;
  /** When true, show upload/change/remove controls (dashboard only). */
  editable?: boolean;
}

/**
 * Image banner for a scope. In display mode it renders the image (or nothing).
 * In editable mode it also offers upload/change/remove; with no image it shows a
 * dashed "Add banner" drop-zone button.
 */
export function Banner({ scopeKey, editable = false }: BannerProps) {
  const filename = useStore((s) => s.banners.banners[scopeKey]);
  const setBanner = useStore((s) => s.setBanner);
  const removeBanner = useStore((s) => s.removeBanner);
  const url = useBannerImage(filename);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = () => inputRef.current?.click();

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (file) void setBanner(scopeKey, file);
  };

  const remove = async () => {
    if (
      await confirmDialog({
        title: "Remove banner?",
        message: "The image file will be deleted from this folder.",
        confirmLabel: "Remove",
        danger: true,
      })
    ) {
      void removeBanner(scopeKey);
    }
  };

  // Editable + no image: a dashed drop-zone prompting an upload.
  if (editable && !filename) {
    return (
      <>
        <button
          onClick={pick}
          className="group flex h-28 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-surface text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
        >
          <ImagePlus size={16} />
          Add banner
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFile}
        />
      </>
    );
  }

  // No image and not editable (e.g. item editor): render nothing.
  if (!filename) return null;

  return (
    <div className="group relative h-40 w-full overflow-hidden rounded-2xl border border-line bg-surface">
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center text-muted">
          <ImageIcon size={22} className="opacity-60" />
        </div>
      )}

      {editable && (
        <div className="absolute right-3 top-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={pick}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-bg/90 px-2.5 py-1.5 text-xs font-medium text-fg shadow-sm backdrop-blur transition-colors hover:border-accent hover:text-accent"
          >
            <ImagePlus size={14} /> Change
          </button>
          <button
            onClick={() => void remove()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-bg/90 px-2.5 py-1.5 text-xs font-medium text-fg shadow-sm backdrop-blur transition-colors hover:border-danger hover:text-danger"
          >
            <Trash2 size={14} /> Remove
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFile}
          />
        </div>
      )}
    </div>
  );
}
