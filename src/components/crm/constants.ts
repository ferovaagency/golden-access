import type { EstadoOportunidad } from '../../lib/crmService';

export const PIPELINE_STAGES: EstadoOportunidad[] = [
  'nuevo',
  'contactado',
  'calificando',
  'propuesta_enviada',
  'negociacion',
  'ganado',
  'perdido',
];
