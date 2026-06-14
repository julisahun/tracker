import { Quote } from "lucide-react";
import { useStore } from "../state/store";
import { phraseItemForDay } from "./phrases";
import { usePhraseImage } from "./usePhraseImage";

/** Accent callout on the dashboard showing the phrase of the day. */
export function PhraseBanner() {
  const phrases = useStore((s) => s.phrases);
  const item = phraseItemForDay(phrases.phrases, new Date());
  const imageUrl = usePhraseImage(item?.image);

  if (!item || (!item.text && !item.image)) return null;

  return (
    <div className="mb-6 flex items-center gap-3 rounded-2xl border border-line bg-accent-soft px-5 py-4 text-accent-soft-fg">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={item.text ?? ""}
          className="h-12 w-12 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <Quote size={18} className="shrink-0 opacity-70" />
      )}
      {item.text && (
        <p className="text-sm font-medium leading-snug">{item.text}</p>
      )}
    </div>
  );
}
