import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export interface Crumb { label: string; path?: string }

/** Enlaces HTML reales (no botones con onClick) -- requisito explicito del manual para breadcrumbs de blog. */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-[#8a8377]">
      {items.map((item, index) => (
        <span key={item.label} className="flex items-center gap-1.5">
          {index > 0 && <ChevronRight className="h-3 w-3" />}
          {item.path ? (
            <Link to={item.path} className="hover:text-[var(--ferova-brand)]">{item.label}</Link>
          ) : (
            <span className="text-[#57524a]" aria-current="page">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
