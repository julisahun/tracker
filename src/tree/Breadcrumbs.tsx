import { ChevronRight } from "lucide-react";

interface BreadcrumbsProps {
  rootName: string;
  path: string;
}

/** Shows the location of the open item: root / folder / … / file. */
export function Breadcrumbs({ rootName, path }: BreadcrumbsProps) {
  const segments = path.split("/");
  return (
    <nav className="flex flex-wrap items-center gap-0.5 text-xs text-muted">
      <span className="font-medium text-fg/70">{rootName}</span>
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-0.5">
          <ChevronRight size={13} className="text-muted/60" />
          <span className={i === segments.length - 1 ? "font-medium text-fg" : ""}>
            {seg.replace(/\.md$/, "")}
          </span>
        </span>
      ))}
    </nav>
  );
}
