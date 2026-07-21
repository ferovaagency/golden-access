// Clusteres iniciales (Manual_Landing_Blog_SEO_Ferova_One, sec. 5.3).
export interface Category {
  slug: string;
  name: string;
  pillarTitle: string;
  description: string;
}

export const CATEGORIES: Category[] = [
  {
    slug: 'rentabilidad',
    name: 'Rentabilidad',
    pillarTitle: 'Cómo saber si tu negocio es rentable',
    description: 'Costo por hora, margen, punto de equilibrio y flujo de caja para saber qué parte de tu negocio realmente gana dinero.',
  },
  {
    slug: 'operacion',
    name: 'Operación',
    pillarTitle: 'Sistema operativo para pequeñas empresas',
    description: 'Centralizar proyectos, indicadores y automatización para operar sin depender de la memoria ni de diez herramientas sueltas.',
  },
  {
    slug: 'ventas',
    name: 'Ventas',
    pillarTitle: 'CRM para pequeñas empresas',
    description: 'Pipeline, seguimiento, propuestas y costo de adquisición para que ninguna oportunidad se enfríe por falta de sistema.',
  },
  {
    slug: 'productividad',
    name: 'Productividad',
    pillarTitle: 'Planificación empresarial con IA',
    description: 'Brain dump, energía, trabajo profundo y bloques protegidos para planear el día según cómo realmente rendís.',
  },
  {
    slug: 'ia-empresarial',
    name: 'IA empresarial',
    pillarTitle: 'IA con datos reales del negocio',
    description: 'Qué significa que un asistente use el contexto real de tu negocio, sus límites y cómo se diferencia de un chatbot genérico.',
  },
  {
    slug: 'finanzas-colombia',
    name: 'Finanzas Colombia',
    pillarTitle: 'Control financiero para small business',
    description: 'IVA, egresos, reservas y alertas tributarias para pequeñas empresas colombianas. Contenido conceptual -- confirma cifras con tu contador.',
  },
];

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find((category) => category.slug === slug);
}
