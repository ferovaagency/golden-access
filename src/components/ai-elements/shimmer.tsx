import React from 'react';

export function Shimmer({ children = 'Pensando...' }: React.PropsWithChildren) {
  return <span className="animate-pulse text-sm text-slate-500">{children}</span>;
}