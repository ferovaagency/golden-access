import { Wrench } from 'lucide-react';

// Rendered when VITE_MAINTENANCE_MODE=true. Keeps the app reachable but blocks
// mutations while the team ships a risky migration.
export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-3xl border border-amber-100 bg-white p-8 shadow-xl text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-600">
          <Wrench className="h-6 w-6" />
        </div>
        <h1 className="font-display text-2xl font-semibold text-slate-900 mb-2">
          Estamos mejorando Ferova One
        </h1>
        <p className="text-sm text-slate-600">
          Volvemos en unos minutos. Tus datos están seguros y no se pierde nada.
        </p>
      </div>
    </div>
  );
}
