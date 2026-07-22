/**
 * Glosario contextual (Manual maestro, sección 3.3 "Mejora de prioridad
 * crítica #1": todo KPI visible debe abrir su explicación -- definición
 * simple, fórmula, qué incluye/excluye y por qué importa). Versión en
 * código, consumible por un componente <MetricTooltip>, del mismo catálogo
 * que ya existía en docs/METRICS_CATALOG.md como markdown.
 *
 * Solo se documentan aquí las métricas que YA se muestran en pantalla --
 * añadir una entrada nunca cambia ningún cálculo, solo lo explica.
 */
export interface MetricDefinition {
  code: string;
  public_name: string;
  simple_definition: string;
  formal_formula: string;
  status: 'confirmado' | 'estimado' | 'proyectado';
  why_it_matters: string;
}

export const METRICS_GLOSSARY: Record<string, MetricDefinition> = {
  VENTAS_TOTALES: {
    code: 'VENTAS_TOTALES',
    public_name: 'Ventas Totales',
    simple_definition: 'Todo lo que facturaste en el periodo, sin restar nada todavía.',
    formal_formula: 'Suma de precio_venta_unitario × cantidad de cada venta contratada en el periodo.',
    status: 'confirmado',
    why_it_matters: 'Es el punto de partida de la escalera financiera (Nivel 0). No es lo mismo que caja: puede incluir ventas aún no cobradas.',
  },
  UTILIDAD_BRUTA: {
    code: 'UTILIDAD_BRUTA',
    public_name: 'Utilidad Bruta',
    simple_definition: 'Lo que queda de tus ventas después de pagar el costo directo de entregarlas.',
    formal_formula: 'Ventas Totales − Costos Directos (tiempo, terceros, herramientas atribuibles, comisiones).',
    status: 'confirmado',
    why_it_matters: 'Muestra si tus servicios son rentables ANTES de contar los gastos fijos del negocio (nómina, software general, etc.).',
  },
  UTILIDAD_OPERACIONAL: {
    code: 'UTILIDAD_OPERACIONAL',
    public_name: 'Utilidad Operacional',
    simple_definition: 'Utilidad bruta menos los gastos fijos de operar el negocio, tengas o no clientes.',
    formal_formula: 'Utilidad Bruta − Gastos Operativos (software general, administración, marketing, oficina).',
    status: 'confirmado',
    why_it_matters: 'Es la rentabilidad real del negocio como operación, antes de tu sueldo y de impuestos.',
  },
  UTILIDAD_ANTES_IMPUESTOS: {
    code: 'UTILIDAD_ANTES_IMPUESTOS',
    public_name: 'Utilidad Antes de Impuestos',
    simple_definition: 'Lo que queda después de pagarte tu sueldo deseado.',
    formal_formula: 'Utilidad Operacional − Sueldo Base Deseado (configurado en Ajustes).',
    status: 'estimado',
    why_it_matters: 'Si este número es negativo, el negocio hoy no alcanza a cubrir el sueldo que te propusiste.',
  },
  UTILIDAD_NETA: {
    code: 'UTILIDAD_NETA',
    public_name: 'Utilidad Neta Real',
    simple_definition: 'Lo que realmente queda libre, después de una provisión estimada de renta.',
    formal_formula: 'Utilidad Antes de Impuestos − Provisión de Renta Estimada (DIAN).',
    status: 'estimado',
    why_it_matters: 'Es una PROVISIÓN, no una declaración de renta real -- Ferova One no reemplaza a tu contador. Ver "Reglas tributarias vigentes" en Ajustes para la tasa exacta usada.',
  },
  HORA_MINIMA_OBJETIVO: {
    code: 'HORA_MINIMA_OBJETIVO',
    public_name: 'Hora Mínima Objetivo',
    simple_definition: 'Cuánto necesitas cobrar por hora, como mínimo, para cubrir tu sueldo deseado.',
    formal_formula: 'Sueldo Base Deseado ÷ Horas Facturables Objetivo del mes.',
    status: 'estimado',
    why_it_matters: 'No incluye gastos del negocio ni reserva de impuestos -- es un piso, no una tarifa recomendada (para eso, ver "Precio Ideal" en Equilibrio por Servicio).',
  },
};

export function getMetricDefinition(code: string): MetricDefinition | null {
  return METRICS_GLOSSARY[code] || null;
}
