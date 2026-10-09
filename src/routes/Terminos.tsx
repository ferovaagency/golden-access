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
          <p className="mt-3 text-sm text-slate-500">Versión 1.1 · Vigente desde el 17 de julio de 2026 · Última actualización: 9 de octubre de 2026</p>
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
            <p>Las suscripciones se procesan a través de Paddle, que actúa como comerciante registrado (Merchant of Record) de la transacción: Paddle es el vendedor frente al cliente y gestiona el cobro recurrente, la facturación, los impuestos aplicables, los reembolsos y las disputas de pago según sus propios términos.</p>
            <p>Ferova no almacena datos de tarjetas ni otros medios de pago. La activación depende de la confirmación de suscripción recibida de Paddle. Los precios y condiciones vigentes se muestran antes de contratar.</p>
            <p><strong>Prueba gratis.</strong> Todo plan empieza con 7 días gratis sin tarjeta. Durante la prueba puedes bajar de plan sin costo; subir de plan abre el pago en Paddle y la suscripción empieza en ese momento. Si al terminar la prueba no has agregado un método de pago, el acceso se suspende y tus datos se conservan según la Política de Tratamiento de Datos.</p>
            <p><strong>Cambios de precio.</strong> Podemos ajustar el precio de la suscripción avisando con al menos 30 días de anticipación por correo; el nuevo precio aplica desde el siguiente período de facturación.</p>
          </Section>

          <Section title="4. Inteligencia artificial">
            <p><strong>Naturaleza de las funciones de IA.</strong> Las funciones de IA generan sugerencias, clasificaciones, reportes, planes y simulaciones mediante modelos probabilísticos. Pueden producir resultados inexactos, incompletos, sesgados o inventados ("alucinaciones"). No garantizamos la veracidad, exhaustividad ni idoneidad de ninguna salida.</p>
            <p><strong>Verificación humana.</strong> Las salidas no constituyen asesoría contable, tributaria, financiera, jurídica ni de inversión. Te corresponde revisar y validar cifras, recomendaciones y textos antes de usarlos en decisiones o frente a terceros; toda decisión de negocio es exclusivamente tuya. Ninguna función ejecuta automáticamente decisiones con efectos jurídicos o económicos: las acciones hacia terceros requieren tu confirmación y las de pago, borrado o permisos solo las ejecutas tú.</p>
            <p><strong>Acciones delegadas al asistente.</strong> Cuando confirmas una acción propuesta por el asistente (por ejemplo, enviar un mensaje o agendar una cita), la acción es tuya. Ferova responde por el funcionamiento del software conforme a la sección 7, no por el contenido que decidas enviar ni por las consecuencias de instrucciones ambiguas o de contenido malicioso introducido en tus datos por terceros.</p>
            <p><strong>Disponibilidad de la IA.</strong> Las funciones de IA dependen de proveedores externos de modelos (a través del gateway de Lovable). Su latencia, límites de uso y disponibilidad quedan fuera de cualquier compromiso de disponibilidad de la Plataforma; una interrupción de esos proveedores no constituye incumplimiento de Ferova.</p>
            <p><strong>Tus entradas y salidas.</strong> Conservas los derechos sobre lo que cargas y sobre lo que la IA genera a partir de tus datos. Nos otorgas una licencia limitada solo para prestarte el servicio. No usamos tus datos ni tus conversaciones para entrenar modelos propios ni de terceros.</p>
            <p><strong>Uso justo del asistente.</strong> El uso del asistente de IA está sujeto a un uso razonable, acorde a la operación normal de un negocio. Nos reservamos el derecho de contactar y acordar condiciones con las cuentas cuyo consumo se desvíe de forma extraordinaria de ese uso razonable.</p>
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
