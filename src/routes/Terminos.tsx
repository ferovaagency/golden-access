import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SeoHead } from '../seo/SeoHead';

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="space-y-3">
    <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
    <div className="space-y-3 text-sm leading-6 text-slate-700">{children}</div>
  </section>
);

export default function Terminos() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 sm:px-6">
      <SeoHead title="Términos y Condiciones" description="Términos y condiciones de uso de Ferova One." path="/terminos" />
      <article className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <header className="border-b border-slate-200 pb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Ferova OS</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Términos y Condiciones de Uso</h1>
          <p className="mt-3 text-sm text-slate-500">Versión 1.0 · Vigente desde el 17 de julio de 2026</p>
        </header>

        <div className="mt-8 space-y-8">
          <Section title="1. Aceptación y proveedor del servicio">
            <p>Al crear una cuenta aceptas estos Términos y la <Link className="font-semibold text-blue-700 underline" to="/privacidad">Política de Tratamiento de Datos Personales</Link>. Si no estás de acuerdo, no uses Ferova OS.</p>
            <p>El servicio lo presta María Fernanda Calderón, persona natural comerciante que actúa bajo el nombre comercial Ferova Agency, NIT 1000502437-0, con domicilio en Calle 74 #15-80, Bogotá D.C., Colombia.</p>
          </Section>

          <Section title="2. Servicio y usuarios">
            <p>Ferova OS es una plataforma SaaS para gestionar finanzas, CRM, planificación y asistencia con inteligencia artificial, dirigida a personas mayores de 18 años que actúan en una actividad empresarial o profesional.</p>
            <p>No es software contable certificado, sistema de facturación electrónica ni asesoría profesional. Eres responsable de proteger tus credenciales y de las actividades realizadas desde tu cuenta.</p>
          </Section>

          <Section title="3. Suscripciones y pagos">
            <p>Las suscripciones se procesan a través de PayPal. PayPal gestiona el cobro recurrente, la facturación, los reembolsos y las disputas de pago según sus propios términos.</p>
            <p>Ferova no almacena datos de tarjetas ni otros medios de pago. La activación depende de la confirmación de suscripción recibida del procesador de pagos. Los precios y condiciones vigentes se muestran antes de contratar.</p>
          </Section>

          <Section title="4. Inteligencia artificial">
            <p>Las funciones de IA generan sugerencias, clasificaciones, reportes, planes y simulaciones. Son probabilísticas y pueden ser inexactas, incompletas o incorrectas.</p>
            <p>No constituyen asesoría contable, tributaria, financiera, jurídica ni de inversión. Debes verificar cifras y recomendaciones antes de actuar; toda decisión de negocio es exclusivamente tuya y ninguna función ejecuta automáticamente decisiones con efectos jurídicos o económicos.</p>
          </Section>

          <Section title="5. Datos de terceros">
            <p>Al cargar datos de clientes, contactos o prospectos, actúas como Responsable del Tratamiento y Ferova como Encargado. Declaras que cuentas con las autorizaciones necesarias y te obligas a mantener indemne a Ferova frente a reclamaciones derivadas de su ausencia.</p>
            <p>Ferova tratará esos datos únicamente para prestar el servicio, aplicará medidas de seguridad y los devolverá o suprimirá al finalizar la relación conforme a las obligaciones aplicables.</p>
          </Section>

          <Section title="6. Uso aceptable">
            <ul className="list-disc space-y-1 pl-5"><li>No cargues datos sensibles, de menores o de terceros sin autorización.</li><li>No uses la plataforma para actividades ilícitas, fraude, acceso a datos ajenos, extracción masiva, ingeniería inversa o evasión de seguridad.</li><li>No intentes obtener instrucciones internas o información de otros usuarios mediante el asistente.</li></ul>
            <p>El incumplimiento puede ocasionar suspensión o terminación inmediata de la cuenta.</p>
          </Section>

          <Section title="7. Propiedad, disponibilidad y responsabilidad">
            <p>Tus datos son tuyos. Conservas sus derechos y otorgas una licencia limitada para tratarlos únicamente con el fin de prestar el servicio. El software, diseño, marcas y documentación pertenecen a Ferova.</p>
            <p>Trabajamos por mantener disponibilidad, pero no garantizamos operación ininterrumpida. En la máxima medida permitida por la ley, Ferova no responde por daños indirectos ni decisiones tomadas con información o salidas de IA no verificadas. Estas limitaciones no aplican en casos de dolo, culpa grave o donde la ley lo prohíba.</p>
          </Section>

          <Section title="8. Terminación, cambios y contacto">
            <p>Puedes cancelar tu suscripción y solicitar eliminación de cuenta. Si existe una suscripción activa, debes cancelarla también mediante el procesador de pagos; eliminar la cuenta no cancela cobros por sí solo.</p>
            <p>Podemos modificar estos Términos avisando con al menos 30 días de anticipación cuando corresponda. Se rigen por ley colombiana, sin perjuicio de normas imperativas de consumo aplicables.</p>
            <p>Contacto: María Fernanda Calderón — Ferova Agency · gerencia@seoparaecommerce.co · Calle 74 #15-80, Bogotá D.C., Colombia.</p>
          </Section>
        </div>
      </article>
    </main>
  );
}
