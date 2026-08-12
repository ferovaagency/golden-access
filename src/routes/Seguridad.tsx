import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SeoHead } from '../seo/SeoHead';

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="space-y-3">
    <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
    <div className="space-y-3 text-sm leading-6 text-slate-700">{children}</div>
  </section>
);

export default function Seguridad() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 sm:px-6">
      <SeoHead title="Seguridad" description="Cómo Ferova One protege tus datos: aislamiento por cuenta, cifrado, respaldos y proveedores." path="/seguridad" />
      <article className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <header className="border-b border-slate-200 pb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Ferova OS</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Seguridad</h1>
          <p className="mt-3 text-sm text-slate-500">Cómo protegemos tus datos. Última actualización: 12 de agosto de 2026.</p>
        </header>

        <div className="mt-8 space-y-8">
          <Section title="Resumen">
            <p>Ferova One guarda información financiera y comercial de tu negocio. Tratamos su protección como el requisito número uno del producto: cada cuenta ve únicamente sus propios datos, la información viaja cifrada y minimizamos lo que almacenamos.</p>
          </Section>

          <Section title="Aislamiento entre clientes">
            <p>Cada dato pertenece a una cuenta y está marcado con su identificador de usuario. El acceso está restringido en la propia base de datos mediante políticas de seguridad a nivel de fila (Row Level Security de PostgreSQL): una cuenta no puede leer ni escribir los datos de otra, aunque intente forzar la consulta.</p>
            <p>Los procesos internos que necesitan permisos elevados derivan siempre tu identidad del token de sesión verificado, nunca de un dato enviado por el navegador, de modo que no es posible pedir información «a nombre» de otra cuenta.</p>
          </Section>

          <Section title="Cifrado">
            <p>Todo el tráfico entre tu navegador y Ferova viaja sobre HTTPS/TLS. Los datos en reposo residen en la infraestructura gestionada de nuestro proveedor de base de datos, con cifrado en disco.</p>
          </Section>

          <Section title="Accesos de terceros (Google, WhatsApp)">
            <p>Cuando conectas Google, Ferova <strong>no almacena</strong> tus tokens de acceso: se usan de forma efímera durante la sesión y solo con los permisos que autorizas. No conservamos credenciales de terceros en reposo, de modo que un eventual volcado de la base de datos no expone acceso a tu correo, tu Drive o tu calendario.</p>
          </Section>

          <Section title="Inteligencia artificial">
            <p>El asistente usa solo el contexto necesario de tu negocio para responder y sus resultados no se utilizan para entrenar modelos. Ninguna acción con efecto material (registrar un gasto, crear una tarea) ocurre sin tu confirmación. Cada respuesta lleva un aviso de que es generada por IA y debe verificarse.</p>
          </Section>

          <Section title="Respaldos">
            <p>La base de datos cuenta con respaldos automáticos gestionados por nuestro proveedor de infraestructura. Puedes además exportar tus propios datos en cualquier momento desde la aplicación, en formatos abiertos, para conservar tu propia copia.</p>
          </Section>

          <Section title="Proveedores">
            <p>Prestamos el servicio apoyándonos en un conjunto acotado de proveedores tecnológicos. Puedes ver la lista completa y actualizada en <Link className="font-semibold text-blue-700 underline" to="/subencargados">Subencargados</Link>, y el detalle de tratamiento en la <Link className="font-semibold text-blue-700 underline" to="/privacidad">Política de Tratamiento de Datos</Link>.</p>
          </Section>

          <Section title="Tus controles">
            <ul className="list-disc space-y-1 pl-5">
              <li>Exportación de tus datos en formatos abiertos, cuando quieras.</li>
              <li>Eliminación de tu cuenta y de los datos derivados desde la aplicación.</li>
              <li>Portabilidad: tu información es tuya y puedes llevártela.</li>
            </ul>
          </Section>

          <Section title="Alcance y honestidad">
            <p>Ferova es operada por un equipo pequeño. No tenemos, a la fecha, certificaciones formales como SOC 2 o ISO 27001; cuando un requisito de negocio concreto lo justifique, lo abordaremos. Preferimos decirte con claridad qué hacemos hoy antes que prometer sellos que aún no tenemos.</p>
          </Section>

          <Section title="Reportar un problema de seguridad">
            <p>Si encuentras una posible vulnerabilidad, escríbenos a <strong>gerencia@seoparaecommerce.co</strong> con el asunto «Seguridad». Respondemos con prioridad y agradecemos el reporte responsable. Por favor no divulgues públicamente el hallazgo hasta que lo hayamos resuelto.</p>
          </Section>
        </div>
      </article>
    </main>
  );
}
