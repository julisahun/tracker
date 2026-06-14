import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useStore } from "../state/store";
import { searchItems } from "./searchIndex";

export function SearchBox() {
  const [query, setQuery] = useState("");
  const searchIndex = useStore((s) => s.searchIndex);
  const selectFile = useStore((s) => s.selectFile);

  const results = useMemo(() => searchItems(searchIndex, query), [searchIndex, query]);

  return (
    <div className="relative">
      <Search
        size={15}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
      />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search items…"
        className="w-full rounded-lg border border-line bg-bg py-1.5 pl-8 pr-2 text-sm outline-none transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/30"
      />
      {query && (
        <ul className="absolute z-20 mt-1.5 max-h-72 w-full overflow-auto rounded-lg border border-line bg-surface p-1 shadow-lg">
          {results.length === 0 && (
            <li className="px-2 py-2 text-sm text-muted">No matches</li>
          )}
          {results.map((r) => (
            <li key={r.path}>
              <button
                onClick={() => {
                  selectFile(r.path);
                  setQuery("");
                }}
                className="block w-full truncate rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-raised"
                title={r.path}
              >
                <span className="text-fg">{r.name.replace(/\.md$/, "")}</span>
                <span className="ml-2 text-xs text-muted">{r.path}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
