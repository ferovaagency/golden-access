import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import NotFound from './components/NotFound';
import MaintenancePage from './components/MaintenancePage';

// Lazy-loaded route entrypoints. `/app` hosts the full tab-based shell
// (App.tsx: login screen when logged out, dashboard when logged in) — turn 5
// will split it into per-module routes. `/` is the public landing page.
const App = lazy(() => import('./App'));
const AdminCRMRoute = lazy(() => import('./routes/AdminRoute'));
const Privacidad = lazy(() => import('./routes/Privacidad'));
const Terminos = lazy(() => import('./routes/Terminos'));
const Landing = lazy(() => import('./routes/Landing'));

function RouteFallback() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
        <p className="text-xs font-semibold font-mono tracking-widest text-slate-500">
          CARGANDO MÓDULO...
        </p>
      </div>
    </div>
  );
}

export default function Router() {
  if (import.meta.env.VITE_MAINTENANCE_MODE === 'true') {
    return <MaintenancePage />;
  }

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/landing" element={<Landing />} />
            <Route path="/privacidad" element={<Privacidad />} />
            <Route path="/terminos" element={<Terminos />} />
            <Route path="/admin/*" element={<AdminCRMRoute />} />
            <Route path="/maintenance" element={<MaintenancePage />} />
            <Route path="/app" element={<App />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
