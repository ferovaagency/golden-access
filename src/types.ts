export interface Config {
  trm: number;
  uvt: number;
  smmlv: number;
  tope_no_declarante_uvt: number;
  tope_no_paga_renta_uvt: number;
  tope_responsable_iva_uvt: number;
  retencion_servicio_min_uvt: number;
  tarifa_ret_declarante: number;
  tarifa_ret_no_declarante: number;
  tarifa_salud: number;
  tarifa_pension: number;
  ibc_porcentaje: number;
  tarifa_iva: number;
  salario_propuesto: number;
  horas_objetivo_mes: number;
  meta_ventas_mensual: number;
  /** Margen mínimo por defecto (0 a 1) para servicios sin margen_objetivo propio. */
  margen_minimo: number;
  /** Fracción (0 a 1) de la hora mínima objetivo bajo la cual un cliente se clasifica como "PÉRDIDA" en HorasAdmin. Default 0.75. */
  umbral_perdida_horas: number;
}

export interface Cliente {
  id: string;
  nombre: string;
  tipo: 'Nacional' | 'Internacional';
  declarante: boolean;
  activo: boolean;
  fecha_creacion: string;
  notas?: string;
  marca_info?: string;
  objetivos?: string; // Serialized list or notes
  kpis?: string; // Serialized KPIs or notes
  entregables?: string; // Service deliverables checklist
  progreso?: number; // 0 to 100
  responsable?: string; // Person on charge
}

export interface Servicio {
  id: string;
  nombre: string;
  costo_unitario: number;
  descripcion?: string;
  /** Costo total estimado para entregar una unidad del servicio (mano de obra + insumos). */
  costo_entrega_estimado?: number | null;
  /** Margen objetivo entre 0 y 1 (ej: 0.35 = 35%). */
  margen_objetivo?: number | null;
  /** Precio de referencia de venta actual (lo que cobrás hoy por esta línea). */
  precio_habitual?: number | null;
  /** Moneda de precio_habitual. Default COP. */
  precio_habitual_moneda?: 'COP' | 'USD' | null;
  /** Precio publicado actual; solo lectura desde el motor de "precio ideal". */
  precio_ofrecido?: number | null;
}

export interface Herramienta {
  id: string;
  nombre: string;
  monto: number;
  moneda: 'COP' | 'USD';
  tipo_cobro: 'global' | 'porCliente';
  servicios_ids: string; // IDs separados por comas
  notas?: string;
}

export interface OtroGasto {
  id: string;
  nombre: string;
  monto: number;
  moneda: 'COP' | 'USD';
  categoria: 'Operativo' | 'Administrativo' | 'Otros';
  comprobante_url?: string;
  comprobante_nombre?: string;
}

export interface PagoEgreso {
  id: string;
  fecha: string;
  concepto: string; // e.g. "Licencia SEMrush Mayo", "Salario Carolina", etc.
  categoria: 'Herramientas' | 'Salarios' | 'Contratistas' | 'Administrativo' | 'Otros';
  monto: number;
  moneda: 'COP' | 'USD';
  metodo_pago: string; // e.g. "Bancolombia", "Tarjeta de Crédito", "Efectivo"
  notas?: string;
  comprobante_url?: string;
  comprobante_nombre?: string;
}

export interface AbonoLog {
  fecha: string;
  monto: number;
  tipo_pago?: string; // e.g. "Transferencia", "Efectivo", etc.
  notas?: string;
}

export interface Venta {
  id: string;
  fecha: string;
  cliente_id: string;
  cliente_nombre: string;
  servicio_id: string;
  servicio_nombre: string;
  cantidad: number;
  precio_venta_unitario: number;
  costo_unitario: number;
  moneda: 'COP' | 'USD';
  tipo: 'Nacional' | 'Internacional';
  adelanto: number;
  estado_pago: 'Pendiente' | 'Adelanto' | 'Pagado';
  notas?: string;
  abonos?: AbonoLog[];
  /** Nombre libre: PayPal, Paddle, transferencia, efectivo, etc. */
  pasarela_pago?: string;
  /** Porcentaje cobrado por la pasarela, expresado como 5 para 5 %. */
  comision_pasarela_porcentaje?: number;
  /** Cargo fijo cobrado en la moneda original de la venta. */
  comision_pasarela_fija?: number;
  /** Costo de retirar o transferir el dinero, en la moneda original. */
  comision_retiro?: number;
  /** Tasa realmente aplicada al convertir una venta USD a COP. */
  trm_conversion?: number;
}

export interface Hora {
  id: string;
  fecha: string;
  cliente_id: string;
  cliente_nombre: string;
  servicio_id: string;
  servicio_nombre: string;
  horas: number;
  descripcion: string;
}

export interface Respaldo {
  fecha: string;
  usuario: string;
  snapshot_drive_id: string;
}

export interface AppData {
  config: Config;
  clientes: Cliente[];
  servicios: Servicio[];
  herramientas: Herramienta[];
  otrosGastos: OtroGasto[];
  ventas: Venta[];
  horas: Hora[];
  respaldos: Respaldo[];
  pagosEgresos: PagoEgreso[];
}
