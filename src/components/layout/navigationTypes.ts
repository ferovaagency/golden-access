import type React from 'react';

export type NavigationItem = { id: string; label: string; hint: string; group?: 'Finanzas' | 'Planner' | 'Ventas' };
export type NavigationSection = { id: string; label: string; icon: React.ComponentType<{ className?: string }>; items: NavigationItem[] };
