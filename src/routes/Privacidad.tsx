import type { ReactNode } from 'react';
import { SeoHead } from '../seo/SeoHead';

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="space-y-3">
    <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
    <div className="space-y-3 text-sm leading-6 text-slate-700">{children}</div>
  </section>
);

export default function Privacidad() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 sm:px-6">
      <SeoHead title="Política de Tratamiento de Datos" description="Política de tratamiento de datos personales de Ferova One." path="/privacidad" />
      <article className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <header className="border-b border-slate-200 pb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Ferova OS</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Política de Tratamiento de Datos Personales</h1>
          <p className="mt-3 text-sm text-slate-500">Versión 1.0 · Vigente desde el 17 de julio de 2026 · Última actualización: 17 de julio de 2026</p>
        </header>

        <div className="mt-8 space-y-8">
          <Section title="1. Quién es el responsable">
            <p><strong>María Fernanda Calderón</strong>, persona natural comerciante que actúa bajo el nombre comercial <strong>Ferova Agency</strong>, NIT 1000502437-0, con domicilio en Calle 74 #15-80, Bogotá D.C., Colombia, es la Responsable del Tratamiento de los datos personales recolectados mediante Ferova OS.</p>
            <p>Contacto: gerencia@seoparaecommerce.co · WhatsApp +1 786 578 7671 · Calle 74 #15-80, Bogotá D.C., Colombia.</p>
            <p>Esta política se expide conforme a la Ley 1581 de 2012, el Decreto 1074 de 2015 y las normas colombianas aplicables.</p>
          </Section>

          <Section title="2. Qué datos tratamos">
            <ul className="list-disc space-y-1 pl-5">
              <li>Identificación y contacto: nombre, correo y teléfono.</li>
              <li>Información de negocio: nombre comercial, industria, tamaño del equipo, ciudad, ventas, gastos, pagos, horas, servicios, precios, márgenes y comprobantes cargados.</li>
              <li>Datos de clientes y contactos comerciales que registres en el CRM.</li>
              <li>Conversaciones con el asistente y onboarding, contenido y archivos cargados.</li>
              <li>Registros de acceso, acciones, resultados de IA y estado de suscripción.</li>
            </ul>
            <p>Si conectas Google, accedemos únicamente a los permisos autorizados. De PayPal recibimos solo los datos mínimos para confirmar la suscripción, como correo y estado del pago.</p>
            <p><strong>No tratamos datos de pago.</strong> PayPal actúa como procesador independiente de la transacción. No solicitamos datos sensibles ni de menores de edad; no los cargues en la plataforma.</p>
          </Section>

          <Section title="3. Finalidades">
            <ol className="list-decimal space-y-1 pl-5">
              <li>Crear y administrar tu cuenta.</li><li>Prestar el servicio y calcular indicadores de operación y rentabilidad.</li><li>Generar clasificaciones, reportes, insights y simulaciones con IA a partir de tu información.</li><li>Enviar avisos operativos y administrar planes.</li><li>Atender solicitudes, seguridad, mejora de producto y obligaciones legales.</li>
            </ol>
            <p>No vendemos datos, no los cedemos para publicidad y no los usamos para entrenar modelos de inteligencia artificial.</p>
          </Section>

          <Section title="4. Inteligencia artificial">
            <p>Las funciones de IA usan únicamente el contexto necesario de tu negocio para responder. El procesamiento se realiza mediante Google LLC (Gemini), a través del gateway de IA de Lovable, con infraestructura en Estados Unidos.</p>
            <p>La IA es probabilística y puede producir resultados inexactos. Sus respuestas son asistencia y sugerencia; no sustituyen asesoría contable, tributaria, financiera ni legal. Ninguna acción material se realiza sin tu confirmación.</p>
          </Section>

          <Section title="5. Transferencias internacionales">
            <p>Para prestar el servicio, los datos pueden ser tratados por Google LLC, Lovable y Supabase en Estados Unidos, como encargados que prestan servicios tecnológicos. PayPal puede tratar los datos de compra como responsable independiente de la transacción, desde Estados Unidos u otras jurisdicciones donde opere.</p>
            <p>Al aceptar esta política autorizas de manera expresa estas transmisiones necesarias para operar Ferova OS. Si no las autorizas, no podremos prestarte el servicio.</p>
          </Section>

          <Section title="6. Datos de terceros">
            <p>Cuando cargas datos de clientes, contactos o prospectos, tú actúas como Responsable y Ferova como Encargado, limitado a tus instrucciones y a la prestación del servicio. Declaras que cuentas con autorización de los titulares y que les informaste las finalidades y transferencias aplicables.</p>
            <p>Ferova aplica medidas de seguridad, trata los datos solo para el servicio, los devuelve o suprime al terminar la relación y comunicará incidentes de seguridad según corresponda.</p>
          </Section>

          <Section title="7. Tus derechos">
            <p>Puedes conocer, actualizar, rectificar, solicitar prueba de autorización, ser informado sobre el uso, revocar autorización, pedir supresión y acceder gratuitamente a tus datos. También puedes presentar quejas ante la Superintendencia de Industria y Comercio.</p>
            <p>Para ejercerlos, escribe a gerencia@seoparaecommerce.co con tu nombre, derecho solicitado y hechos. Las consultas se atienden en hasta 10 días hábiles prorrogables por 5; los reclamos, en hasta 15 días hábiles prorrogables por 8.</p>
          </Section>

          <Section title="8. Conservación, seguridad y cambios">
            <p>Conservamos datos de cuenta mientras esté activa. Las conversaciones de asistente y onboarding se conservan hasta 12 meses; al eliminar la cuenta se suprimen los datos salvo obligaciones legales aplicables.</p>
            <p>Aplicamos cifrado en tránsito, controles de acceso y gestión de credenciales. Ninguna medida es infalible. Los cambios sustanciales a esta política se comunicarán y requerirán nueva autorización cuando aplique.</p>
          </Section>
        </div>

        <footer className="mt-10 border-t border-slate-200 pt-5 text-xs text-slate-500">Vigencia de la política y las bases de datos: mientras Ferova OS preste el servicio y sea necesario para estas finalidades.</footer>
      </article>
    </main>
  );
}
