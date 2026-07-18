import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-xl text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-600">
          <Compass className="h-6 w-6" />
        </div>
        <h1 className="font-display text-2xl font-semibold text-slate-900 mb-2">404</h1>
        <p className="text-sm text-slate-600 mb-6">
          Esta ruta no existe en Ferova OS. Puede que hayas seguido un link viejo o mal escrito.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
