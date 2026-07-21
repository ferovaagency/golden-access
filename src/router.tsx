import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
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
const LandingV2 = lazy(() => import('./routes/LandingV2'));

// Capa publica indexable (Manual_Landing_Blog_SEO_Ferova_One, sec. 3 y 8).
const FeaturesPage = lazy(() => import('./marketing/pages/FeaturesPage'));
const FeatureFinancePage = lazy(() => import('./marketing/pages/FeatureFinancePage'));
const FeatureCRMPage = lazy(() => import('./marketing/pages/FeatureCRMPage'));
const FeaturePlannerPage = lazy(() => import('./marketing/pages/FeaturePlannerPage'));
const FeatureAIPage = lazy(() => import('./marketing/pages/FeatureAIPage'));
const PricingPage = lazy(() => import('./marketing/pages/PricingPage'));
const BlogIndexPage = lazy(() => import('./blog/pages/BlogIndexPage'));
const BlogCategoryPage = lazy(() => import('./blog/pages/BlogCategoryPage'));
const BlogPostPage = lazy(() => import('./blog/pages/BlogPostPage'));
const AuthorPage = lazy(() => import('./blog/pages/AuthorPage'));

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
            {/* /landing -> / : el manual pide una sola URL canonica para la landing (sec. 6.4). */}
            <Route path="/landing" element={<Navigate to="/" replace />} />
            <Route path="/landing-v2" element={<LandingV2 />} />
            <Route path="/funciones" element={<FeaturesPage />} />
            <Route path="/funciones/finanzas" element={<FeatureFinancePage />} />
            <Route path="/funciones/crm" element={<FeatureCRMPage />} />
            <Route path="/funciones/planner" element={<FeaturePlannerPage />} />
            <Route path="/funciones/asistente-ia" element={<FeatureAIPage />} />
            <Route path="/precios" element={<PricingPage />} />
            <Route path="/blog" element={<BlogIndexPage />} />
            <Route path="/blog/categoria/:slug" element={<BlogCategoryPage />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />
            <Route path="/autores/:slug" element={<AuthorPage />} />
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
