import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Check } from 'lucide-react';
import { getPlanCatalog, TRIAL_DAYS, type Periodo } from '../../lib/planService';
import { trackEvent } from '../../lib/analytics';

// Tabla de los 3 planes con interruptor mensual/anual (−30 %). Todos empiezan
// con 7 días de prueba sin tarjeta (cardless trial de Paddle). La usan la
// landing y /precios; el modal de upgrade dentro de la app tiene la suya.
// Intermedio va destacado: es el plan que queremos que la mayoría elija.

export function PlanPricingTable({ ctaPath = '/app', source = '/' }: { ctaPath?: string; source?: string }) {
  const [periodo, setPeriodo] = useState<Periodo>('mensual');
  const planes = getPlanCatalog();
  const ahorro = Math.max(...planes.map((p) => p.ahorroAnualPct));
  return (
    <div>
      <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-semibold">
        <button type="button" onClick={() => setPeriodo('mensual')} className={`rounded-full px-4 py-1.5 transition ${periodo === 'mensual' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}>Mensual</button>
        <button type="button" onClick={() => setPeriodo('anual')} className={`rounded-full px-4 py-1.5 transition ${periodo === 'anual' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}>Anual <span className={periodo === 'anual' ? 'text-amber-300' : 'text-emerald-600'}>−{ahorro} %</span></button>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {planes.map((plan, index) => {
          const precio = periodo === 'anual' ? plan.precioAnualMes : plan.precioMensual;
          return (
            <motion.div
              key={plan.id}
              className={`relative flex flex-col rounded-3xl border p-6 text-left ${plan.destacado ? 'border-amber-400 bg-white shadow-[0_22px_55px_rgba(245,158,11,.18)] md:-translate-y-2' : 'border-slate-200 bg-slate-50'}`}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: plan.destacado ? -8 : 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.35, delay: index * 0.07, ease: 'easeOut' }}
            >
              {plan.destacado && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-1 text-[11px] font-semibold text-white shadow">Más elegido</span>}
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{plan.etiqueta}</p>
              <h3 className="mt-1 font-serif text-2xl text-slate-900">{plan.nombre}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-serif text-4xl text-slate-900">USD {precio}</span>
                <span className="text-sm text-slate-500">/ mes</span>
              </div>
              <p className="mt-1 min-h-[2.5rem] text-xs text-slate-500">
                {periodo === 'anual' ? `USD ${plan.precioAnualTotal} facturados una vez al año (ahorras ${plan.ahorroAnualPct} %).` : 'Facturado cada mes.'} Los primeros {TRIAL_DAYS} días son gratis y sin tarjeta.
              </p>
              <p className="mt-3 text-sm text-slate-700">{plan.para}</p>
              <ul className="mt-4 flex-1 space-y-2">
                {plan.incluye.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-700"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {f}</li>
                ))}
              </ul>
              <Link
                to={ctaPath}
                onClick={() => trackEvent('pricing_cta', { path: source, plan: plan.id, periodo })}
                className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium ${plan.destacado ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
              >
                Probar {plan.nombre} {TRIAL_DAYS} días gratis <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="mt-2 text-center text-[11px] text-slate-400">Sin tarjeta. Si no agregas una, se apaga solo al terminar.</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
