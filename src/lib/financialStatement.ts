import type { AppData } from '../types';
import { calcularMétricasFinancieras, type FiscalContext } from './calculations';

export interface FinancialStatementRow {
  section: 'Resultados' | 'Caja';
  concept: string;
  amount: number;
  total?: boolean;
}

export interface FinancialStatement {
  period: string;
  generatedAt: string;
  rows: FinancialStatementRow[];
  fiscalNotice: string | null;
}

export function buildFinancialStatement(data: AppData, period: string, fiscal?: FiscalContext): FinancialStatement {
  const metrics = calcularMétricasFinancieras(data, period, fiscal);
  const rows: FinancialStatementRow[] = [
    { section: 'Resultados', concept: 'Ingresos por ventas', amount: metrics.totalVentas },
    { section: 'Resultados', concept: 'Costos directos de los servicios', amount: -metrics.costosVariables },
    { section: 'Resultados', concept: 'Utilidad bruta', amount: metrics.utilidadBruta, total: true },
    { section: 'Resultados', concept: 'Gastos operativos recurrentes', amount: -metrics.gastosOperativos },
    { section: 'Resultados', concept: 'Utilidad operacional', amount: metrics.utilidadOperacional, total: true },
    { section: 'Resultados', concept: 'Remuneración propuesta de gerencia', amount: -metrics.salarioPropuesto },
    { section: 'Resultados', concept: 'Utilidad antes de impuestos', amount: metrics.utilidadAntesImpuestos, total: true },
    { section: 'Resultados', concept: 'Impuesto de renta estimado', amount: -metrics.impuestoRentaEstimado },
    { section: 'Resultados', concept: 'Resultado neto estimado', amount: metrics.utilidadNeta, total: true },
    { section: 'Caja', concept: 'Pagos y egresos realmente registrados', amount: -metrics.totalEgresosReales },
    { section: 'Caja', concept: 'Salarios realmente pagados (incluidos arriba)', amount: -metrics.salariosRealesPagados },
  ];

  return {
    period,
    generatedAt: new Date().toISOString(),
    rows,
    fiscalNotice: metrics.fiscalNotice,
  };
}

export function financialStatementCsv(statement: FinancialStatement): string {
  const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  return [
    ['Periodo', statement.period, ''],
    ['Sección', 'Concepto', 'Valor COP'],
    ...statement.rows.map((row) => [row.section, row.concept, row.amount]),
    ...(statement.fiscalNotice ? [['Nota fiscal', statement.fiscalNotice, '']] : []),
  ].map((row) => row.map(escape).join(',')).join('\r\n');
}
