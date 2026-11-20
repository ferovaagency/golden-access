import type React from 'react';

/** Pestaña interna de una entrada del menú: abre un módulo existente por su id de siempre. */
export type NavigationChild = { id: string; label: string; hint?: string; locked?: boolean };

/**
 * Entrada del menú. Con `children`, la entrada reúne varios módulos que antes
 * eran pestañas separadas (p. ej. Movimientos = Ingresos + Pagos + Costos): su
 * `id` es una clave de grupo (g-…) y la pantalla muestra pestañas internas.
 * Los ids de los módulos no cambian, así que el buscador ⌘K, el asistente y
 * los permisos por pestaña siguen funcionando.
 */
export type NavigationItem = { id: string; label: string; hint: string; group?: 'Finanzas' | 'Planner' | 'Ventas'; locked?: boolean; children?: NavigationChild[] };
export type NavigationSection = { id: string; label: string; icon: React.ComponentType<{ className?: string }>; items: NavigationItem[] };

/** ¿Esta entrada corresponde al módulo abierto? */
export function itemContains(item: NavigationItem, tab: string): boolean {
  return item.id === tab || !!item.children?.some((child) => child.id === tab);
}

/** Módulo que abre una entrada: ella misma o su primera pestaña sin candado. */
export function itemTarget(item: NavigationItem): string {
  if (!item.children?.length) return item.id;
  return (item.children.find((child) => !child.locked) ?? item.children[0]).id;
}
