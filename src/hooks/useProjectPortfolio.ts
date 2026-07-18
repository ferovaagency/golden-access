import { useMemo } from 'react';
import type { AppData } from '../types';
import { buildProjectPortfolio } from '../domains/projects/projectService';

/** Provides the project-centric relationship graph without changing persistence. */
export function useProjectPortfolio(data: Pick<AppData, 'clientes' | 'servicios' | 'ventas' | 'horas'>) {
  return useMemo(() => buildProjectPortfolio(data), [data]);
}
