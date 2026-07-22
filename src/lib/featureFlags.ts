// Feature flag para el rediseño Ferova One v2 (Manual_Implementacion_Diseno_Ferova_One).
// Migracion incremental: mientras el flag este apagado, el shell/UI actual
// sigue siendo la unica ruta -- ningun componente v2 se monta por defecto.
export function isFerovaUiV2Enabled(): boolean {
  return import.meta.env.VITE_FEROVA_UI_V2?.trim() !== 'false';
}
