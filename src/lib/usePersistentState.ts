import { useEffect, useRef, useState } from 'react';

/**
 * useState que sobrevive al desmontaje del componente dentro de la misma
 * sesión del navegador. App.tsx renderiza cada sección con `activeTab === x &&
 * <Componente/>`, así que cambiar de pestaña desmonta el formulario y borra su
 * estado local. Guardamos el borrador en sessionStorage para que al volver el
 * usuario encuentre lo que estaba escribiendo (N1: "no perder datos del
 * formulario al cambiar de pestaña").
 *
 * - sessionStorage (no localStorage): el borrador dura mientras la pestaña del
 *   navegador siga abierta y se limpia al cerrarla, sin ensuciar entre sesiones.
 * - `clearPersisted()` borra la copia guardada; llámalo tras guardar/enviar el
 *   formulario para no re-poblar con datos ya persistidos en la base.
 */
type Updater<T> = T | ((prev: T) => T);

export function usePersistentState<T>(key: string, initial: T): [T, (value: Updater<T>) => void, () => void] {
  const storageKey = `ferova.draft.${key}`;

  const [state, setState] = useState<T>(() => {
    try {
      const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(storageKey) : null;
      if (raw != null) return JSON.parse(raw) as T;
    } catch { /* storage no disponible o JSON inválido: usar inicial */ }
    return initial;
  });

  // Evita reescribir en el primer render (ya leímos el valor inicial arriba).
  const hydrated = useRef(false);
  useEffect(() => {
    if (!hydrated.current) { hydrated.current = true; return; }
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch { /* cuota llena o modo privado: seguimos sin persistir */ }
  }, [storageKey, state]);

  const clearPersisted = () => {
    try { sessionStorage.removeItem(storageKey); } catch { /* noop */ }
  };

  return [state, setState, clearPersisted];
}

/**
 * Borra de una vez todos los borradores de un formulario (todas las claves que
 * empiezan por `ferova.draft.<prefix>`). Útil cuando un formulario tiene muchos
 * campos persistidos por separado y hay que limpiarlos al guardar/enviar o al
 * cancelar la edición.
 */
export function clearDraftNamespace(prefix: string): void {
  try {
    const full = `ferova.draft.${prefix}`;
    const toRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(full)) toRemove.push(k);
    }
    toRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch { /* storage no disponible */ }
}
