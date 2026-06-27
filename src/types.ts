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
