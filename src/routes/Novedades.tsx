import { SeoHead } from '../seo/SeoHead';

/**
 * Changelog público. Es la prueba más barata de que el producto está vivo.
 * Para publicar una novedad, añade una entrada al principio de CHANGELOG.
 * tipo: 'nuevo' (funcionalidad), 'mejora', 'arreglo'.
 */
type ChangeType = 'nuevo' | 'mejora' | 'arreglo';
type ChangelogEntry = {
  fecha: string; // YYYY-MM-DD
  titulo: string;
  detalle: string;
  cambios: { tipo: ChangeType; texto: string }[];
};

const CHANGELOG: ChangelogEntry[] = [
  {
    fecha: '2026-08-13',
    titulo: 'Prueba gratis de 14 días',
    detalle: 'Ahora puedes probar Ferova One completo por 14 días antes de tu primer pago.',
    cambios: [
      { tipo: 'nuevo', texto: 'Prueba de 14 días con acceso total; cancela antes y no pagas nada.' },
      { tipo: 'mejora', texto: 'Suscripciones y MRR ahora visibles en el panel de administración.' },
    ],
  },
  {
    fecha: '2026-08-12',
    titulo: 'Transparencia, control de tus datos y más confianza',
    detalle: 'Un paquete grande de cara al lanzamiento: páginas públicas de confianza, control total sobre tus datos y un asistente más rápido.',
    cambios: [
      { tipo: 'nuevo', texto: 'Exporta TODOS tus datos en un clic (JSON abierto) desde Configuración.' },
      { tipo: 'nuevo', texto: 'Elimina tu cuenta desde la app, con período de gracia para arrepentirte.' },
      { tipo: 'nuevo', texto: 'Páginas públicas de Seguridad, Subencargados, Reembolsos y esta de Novedades.' },
      { tipo: 'mejora', texto: 'Las reseñas detectadas de correo ahora se confirman antes de usarse (más seguridad).' },
      { tipo: 'mejora', texto: 'Asistente IA más rápido y económico gracias a mejor uso de caché.' },
    ],
  },
];

const TYPE_STYLES: Record<ChangeType, string> = {
  nuevo: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  mejora: 'bg-blue-50 text-blue-700 ring-blue-200',
  arreglo: 'bg-amber-50 text-amber-700 ring-amber-200',
};

const TYPE_LABEL: Record<ChangeType, string> = {
  nuevo: 'Nuevo',
  mejora: 'Mejora',
  arreglo: 'Arreglo',
};

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function Novedades() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 sm:px-6">
      <SeoHead title="Novedades" description="Registro de cambios y mejoras de Ferova One, con fecha." path="/novedades" />
      <article className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <header className="border-b border-slate-200 pb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Ferova OS</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Novedades</h1>
          <p className="mt-3 text-sm text-slate-500">Cada mejora, con fecha. Lo que cambia en Ferova One.</p>
        </header>

        <div className="mt-8 space-y-10">
          {CHANGELOG.map((entry) => (
            <section key={entry.fecha} className="relative border-l-2 border-slate-100 pl-6">
              <div className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-blue-600" />
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{formatDate(entry.fecha)}</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">{entry.titulo}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">{entry.detalle}</p>
              <ul className="mt-4 space-y-2">
                {entry.cambios.map((c, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                    <span className={`mt-0.5 inline-flex flex-none items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${TYPE_STYLES[c.tipo]}`}>
                      {TYPE_LABEL[c.tipo]}
                    </span>
                    <span>{c.texto}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
