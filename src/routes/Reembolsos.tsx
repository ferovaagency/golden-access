import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SeoHead } from '../seo/SeoHead';

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="space-y-3">
    <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
    <div className="space-y-3 text-sm leading-6 text-slate-700">{children}</div>
  </section>
);

export default function Reembolsos() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 sm:px-6">
      <SeoHead title="Política de Reembolsos" description="Política de reembolsos y cancelaciones de Ferova One." path="/reembolsos" />
      <article className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <header className="border-b border-slate-200 pb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Ferova OS</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Política de Reembolsos</h1>
          <p className="mt-3 text-sm text-slate-500">Versión 1.0 · Vigente desde el 12 de agosto de 2026</p>
        </header>

        <div className="mt-8 space-y-8">
          <Section title="1. Suscripción y facturación">
            <p>Ferova OS se ofrece como suscripción de pago recurrente. El cobro lo procesa <strong>Paddle</strong>, que actúa como comerciante registrado (Merchant of Record) de la transacción. No exige permanencia: puedes cancelar en cualquier momento y conservarás el acceso hasta el final del período ya pagado.</p>
            <p>Cancelar la suscripción evita cobros futuros pero no genera, por sí solo, un reembolso del período en curso, salvo en los casos descritos abajo.</p>
          </Section>

          <Section title="2. Derecho de retracto (Colombia)">
            <p>Conforme al artículo 47 de la Ley 1480 de 2011, en las ventas a distancia tienes derecho de retracto dentro de los <strong>cinco (5) días hábiles</strong> siguientes a la contratación, siempre que no hayas hecho un uso sustancial del servicio. Si ejerces el retracto en ese plazo, se reintegra el valor pagado del período contratado.</p>
            <p>Para ejercerlo, escríbenos a gerencia@seoparaecommerce.co indicando el correo de tu cuenta y la fecha de contratación.</p>
          </Section>

          <Section title="3. Garantía de satisfacción del primer pago">
            <p>Como cortesía, sobre el <strong>primer</strong> pago de una cuenta nueva ofrecemos una garantía de satisfacción de <strong>catorce (14) días naturales</strong>: si dentro de ese plazo no estás conforme, solicitas el reembolso al mismo correo y te devolvemos ese primer pago. Esta garantía aplica una sola vez por cliente y no cubre renovaciones posteriores.</p>
          </Section>

          <Section title="4. Renovaciones">
            <p>Los pagos de renovación no son reembolsables una vez iniciado el nuevo período, salvo obligación legal o falla del servicio atribuible a Ferova que impida su uso de forma continuada. Recomendamos cancelar antes de la fecha de renovación si no deseas continuar.</p>
          </Section>

          <Section title="5. Cómo solicitar un reembolso">
            <p>Envía tu solicitud a <strong>gerencia@seoparaecommerce.co</strong> con el correo de tu cuenta y el motivo. Respondemos en un plazo de 1 día hábil. Los reembolsos aprobados se procesan a través de Paddle al mismo medio de pago; el tiempo de acreditación depende de Paddle y de tu banco.</p>
            <p>Como comerciante registrado, Paddle también gestiona la facturación, los impuestos y las disputas de pago conforme a sus políticas.</p>
          </Section>

          <Section title="6. Contacto">
            <p>María Fernanda Calderón — Ferova Agency · gerencia@seoparaecommerce.co · Calle 74 #15-80, Bogotá D.C., Colombia.</p>
            <p>Consulta también los <Link className="font-semibold text-blue-700 underline" to="/terminos">Términos y Condiciones</Link> y la <Link className="font-semibold text-blue-700 underline" to="/privacidad">Política de Tratamiento de Datos</Link>.</p>
          </Section>
        </div>
      </article>
    </main>
  );
}
