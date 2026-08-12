import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SeoHead } from '../seo/SeoHead';

/**
 * Lista pública y versionada de subencargados (subprocesadores). Es la base del
 * DPA y lo primero que audita un comprador serio. Data-driven: al añadir o
 * quitar un proveedor, edita SUBPROCESSORS y sube la versión del encabezado.
 */
type Subprocessor = {
  nombre: string;
  proposito: string;
  datos: string;
  ubicacion: string;
  rol: 'Encargado' | 'Responsable independiente';
};

const SUBPROCESSORS: Subprocessor[] = [
  {
    nombre: 'Supabase Inc.',
    proposito: 'Base de datos, autenticación y almacenamiento (aprovisionado vía Lovable Cloud).',
    datos: 'Todos los datos de cuenta y de negocio en reposo.',
    ubicacion: 'Estados Unidos',
    rol: 'Encargado',
  },
  {
    nombre: 'Lovable',
    proposito: 'Alojamiento de la aplicación y gateway de inteligencia artificial.',
    datos: 'Datos de negocio en tránsito hacia el modelo de IA; despliegue de la app.',
    ubicacion: 'Estados Unidos',
    rol: 'Encargado',
  },
  {
    nombre: 'Google LLC (Gemini)',
    proposito: 'Procesamiento de las funciones de inteligencia artificial (a través del gateway de Lovable).',
    datos: 'Solo el contexto necesario del negocio para cada respuesta. No se usa para entrenar modelos.',
    ubicacion: 'Estados Unidos',
    rol: 'Encargado',
  },
  {
    nombre: 'Paddle',
    proposito: 'Comerciante registrado (Merchant of Record): cobro de la suscripción, facturación, impuestos, reembolsos y disputas.',
    datos: 'Correo y estado de pago. Ferova no almacena datos de tarjetas.',
    ubicacion: 'Reino Unido / Estados Unidos y jurisdicciones donde opere',
    rol: 'Responsable independiente',
  },
  {
    nombre: 'Apollo.io',
    proposito: 'Enriquecimiento de contactos comerciales del CRM (solo cuando la función está habilitada).',
    datos: 'Datos de contacto/dominio del prospecto que decidas enriquecer.',
    ubicacion: 'Estados Unidos',
    rol: 'Encargado',
  },
];

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="space-y-3">
    <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
    <div className="space-y-3 text-sm leading-6 text-slate-700">{children}</div>
  </section>
);

export default function Subencargados() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 sm:px-6">
      <SeoHead title="Subencargados del Tratamiento" description="Lista de subencargados (subprocesadores) que Ferova One utiliza para prestar el servicio." path="/subencargados" />
      <article className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <header className="border-b border-slate-200 pb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Ferova OS</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Subencargados del Tratamiento</h1>
          <p className="mt-3 text-sm text-slate-500">Versión 1.0 · Actualizada el 12 de agosto de 2026</p>
        </header>

        <div className="mt-8 space-y-8">
          <Section title="Qué es esta lista">
            <p>Para prestar el servicio, Ferova se apoya en proveedores tecnológicos que tratan datos por cuenta y bajo instrucciones de Ferova (subencargados), o que actúan como responsables independientes de su propia relación con el titular. Esta es la lista vigente. Publicamos con antelación razonable cualquier alta de un nuevo subencargado.</p>
          </Section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Lista vigente</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-4 font-semibold">Proveedor</th>
                    <th className="py-2 pr-4 font-semibold">Propósito</th>
                    <th className="py-2 pr-4 font-semibold">Datos</th>
                    <th className="py-2 pr-4 font-semibold">Ubicación</th>
                    <th className="py-2 font-semibold">Rol</th>
                  </tr>
                </thead>
                <tbody>
                  {SUBPROCESSORS.map((s) => (
                    <tr key={s.nombre} className="border-b border-slate-100 align-top">
                      <td className="py-3 pr-4 font-semibold text-slate-900">{s.nombre}</td>
                      <td className="py-3 pr-4 text-slate-700">{s.proposito}</td>
                      <td className="py-3 pr-4 text-slate-700">{s.datos}</td>
                      <td className="py-3 pr-4 text-slate-700">{s.ubicacion}</td>
                      <td className="py-3 text-slate-700">{s.rol}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <Section title="Roles y garantías">
            <p>Ferova actúa como Encargado del Tratamiento de los datos que cargas y como Responsable de los datos de tu cuenta. Los subencargados marcados como «Encargado» tratan datos únicamente para prestar el servicio, bajo compromisos de seguridad y confidencialidad. Paddle actúa como comerciante registrado (Merchant of Record) y responsable independiente de la transacción de pago.</p>
            <p>Las transferencias internacionales se detallan en la <Link className="font-semibold text-blue-700 underline" to="/privacidad">Política de Tratamiento de Datos</Link>. Para un Acuerdo de Tratamiento de Datos (DPA) formal, escríbenos a gerencia@seoparaecommerce.co.</p>
          </Section>

          <Section title="Contacto">
            <p>María Fernanda Calderón — Ferova Agency · gerencia@seoparaecommerce.co · Calle 74 #15-80, Bogotá D.C., Colombia.</p>
          </Section>
        </div>
      </article>
    </main>
  );
}
