import { describe, it, expect } from 'vitest';
import { todayLocal } from '../src/lib/localDate';

describe('todayLocal', () => {
  it('a las 9 p.m. de Bogotá (02:00 UTC del día siguiente) sigue siendo el mismo día', () => {
    expect(todayLocal('America/Bogota', new Date('2026-10-09T02:07:00Z'))).toBe('2026-10-08');
  });
  it('fin de mes: 31 oct 11 p.m. Bogotá no salta a noviembre', () => {
    expect(todayLocal('America/Bogota', new Date('2026-11-01T04:00:00Z'))).toBe('2026-10-31');
  });
});
