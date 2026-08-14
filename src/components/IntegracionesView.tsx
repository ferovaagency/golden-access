import { useEffect, useState } from 'react';
import { fetchGoogleConnection, type GoogleConnection } from '../lib/googleConnectionService';
import { Calendar, FileSpreadsheet, Mail, MessageSquare, Sparkles, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';

interface Props {
  hasGoogleToken: boolean;
  connectingGoogle: boolean;
  isTeam: boolean;
  onConnectGoogle: () => void;
  onNavigate: (tab: string) => void;
}

const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
    <path fill="#EA4335" d="M12 5.04c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24.5 12 .5c-4.7 0-8.75 2.69-10.72 6.61l3.99 3.09C6.21 7.15 8.87 5.04 12 5.04z" />
    <path fill="#4285F4" d="M23.25 12c0-.78-.07-1.62-.23-2.39H12v4.52h6.38c-.28 1.47-1.11 2.7-2.35 3.53l3.65 2.83c2.13-1.97 3.57-4.87 3.57-8.49z" />
    <path fill="#FBBC05" d="M5.27 14.3c-.24-.72-.38-1.5-.38-2.3s.14-1.58.38-2.3L1.28 6.61C.46 8.23 0 10.06 0 12s.46 3.77 1.28 5.39l3.99-3.09z" />
    <path fill="#34A853" d="M12 23.5c3.24 0 5.96-1.07 7.94-2.91l-3.65-2.83c-1.04.7-2.38 1.11-4.29 1.11-3.13 0-5.79-2.11-6.74-5.2l-3.99 3.09C3.25 20.81 7.3 23.5 12 23.5z" />
  </svg>
);

function StatusPill({ on, labelOn = 'Conectado', labelOff = 'Sin conectar' }: { on: boolean; labelOn?: string; labelOff?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${on ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-emerald-500' : 'bg-slate-400'}`} /> {on ? labelOn : labelOff}
    </span>
  );
}

export default function IntegracionesView({ hasGoogleToken, connectingGoogle, isTeam, onConnectGoogle, onNavigate }: Props) {
  // La conexión guardada: `hasGoogleToken` sólo es cierto mientras dura el token
  // en memoria, así que al recargar la página la pantalla decía "sin conectar"
  // aunque la persona hubiera conectado hace un minuto.
  const [conexion, setConexion] = useState<GoogleConnection | null>(null);
  useEffect(() => { fetchGoogleConnection().then(setConexion).catch(() => setConexion(null)); }, [hasGoogleToken]);
  const conectadoAlgunaVez = !!conexion?.connected;
  const necesitaReconectar = conectadoAlgunaVez && !hasGoogleToken;

  return (
    <div className="mx-auto max-w-3xl space-y-6 text-slate-900">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Integraciones</h1>
        <p className="text-sm text-slate-500">Conecta tus herramientas para que Ferova trabaje con lo que ya usas. Todo opcional: la app funciona sin conectar nada.</p>
      </header>

      {/* Google Workspace: la integración principal */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 ring-1 ring-slate-200"><GoogleIcon /></div>
            <div>
              <h2 className="text-base font-semibold">Google Workspace</h2>
              <p className="text-xs text-slate-500">Calendar, Sheets, Drive y Gmail — una sola conexión.</p>
            </div>
          </div>
          <StatusPill on={hasGoogleToken || conectadoAlgunaVez} />
        </div>
        {necesitaReconectar && (
          <p className="border-b border-slate-100 bg-amber-50 px-5 py-2.5 text-xs leading-relaxed text-amber-800">
            Conectado como <strong>{conexion?.connected_email || 'tu cuenta de Google'}</strong>. Por seguridad no
            guardamos el token, así que al volver a entrar hay que autorizar de nuevo para hacer operaciones
            (una vez por sesión).
          </p>
        )}

        <div className="grid gap-3 p-5 sm:grid-cols-2">
          <Feature icon={<Calendar className="h-4 w-4 text-blue-600" />} title="Calendar" desc="Agenda diagnósticos y citas; se sincronizan a tu calendario." />
          <Feature icon={<FileSpreadsheet className="h-4 w-4 text-emerald-600" />} title="Sheets / Drive" desc="Respalda tu contabilidad o importa datos desde tu propia hoja." />
          <Feature icon={<Mail className="h-4 w-4 text-rose-600" />} title="Gmail" desc="Detecta reseñas nuevas que te llegan por correo (opcional)." />
          <Feature icon={<CheckCircle2 className="h-4 w-4 text-slate-500" />} title="Privado" desc="No guardamos tus tokens: se usan solo mientras trabajas." />
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 p-5">
          <button
            onClick={onConnectGoogle}
            disabled={connectingGoogle}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
          >
            {connectingGoogle ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
            {hasGoogleToken ? 'Reautorizar Google Workspace' : 'Conectar con Google Workspace'}
          </button>
          {hasGoogleToken && (
            <button onClick={() => onNavigate('ajustes')} className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800">
              Ir a respaldo de Sheets <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </section>

      {/* Apollo: enriquecimiento */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 ring-1 ring-violet-200"><Sparkles className="h-5 w-5 text-violet-600" /></div>
            <div>
              <h2 className="text-base font-semibold">Apollo · Enriquecimiento de contactos</h2>
              <p className="text-xs text-slate-500">Desde el CRM, genera un playbook de contacto (correo, LinkedIn, WhatsApp) para cada prospecto.</p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={() => onNavigate(isTeam ? 'ventas-crm' : 'clientes')} className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800">
            Ir al CRM <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <span className="text-[11px] text-slate-400">Se activa desde el panel; si no aparece, escríbenos para habilitarlo.</span>
        </div>
      </section>

      {/* WhatsApp: para equipos/agencias */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 ring-1 ring-green-200"><MessageSquare className="h-5 w-5 text-green-600" /></div>
            <div>
              <h2 className="text-base font-semibold">WhatsApp · Bot de ventas</h2>
              <p className="text-xs text-slate-500">Un asistente que responde a tus prospectos por WhatsApp con el conocimiento de tu negocio.</p>
            </div>
          </div>
          <StatusPill on={false} labelOff={isTeam ? 'Configurable' : 'Para equipos'} />
        </div>
        {isTeam ? (
          <button onClick={() => onNavigate('crm-bot')} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800">
            Configurar el bot de WhatsApp <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <p className="mt-4 text-[11px] text-slate-400">Disponible para cuentas de equipo/agencia. Escríbenos si te interesa activarlo.</p>
        )}
      </section>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="text-[11px] leading-4 text-slate-500">{desc}</p>
      </div>
    </div>
  );
}
