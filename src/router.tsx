import { lazy, Suspense } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import type { RouteRecord } from 'vite-react-ssg';
import { Loader2 } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import NotFound from './components/NotFound';
import MaintenancePage from './components/MaintenancePage';
import { usePageView } from './lib/usePageView';
import { ToastProvider } from './components/ui/toast';

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

/** Dispara page_view en cada navegacion -- debe vivir dentro del router para usar useLocation. */
function PageViewTracker() {
  usePageView();
  return null;
}

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

// Layout raiz sin path propio (pathless): envuelve TODAS las rutas hijas
// (que conservan sus paths absolutos tal cual) con los providers/boundary
// que antes vivian directo en <BrowserRouter>. vite-react-ssg arma el router
// a partir de `routes`, asi que ya no hay un componente <Router/> que
// controle esto imperativamente -- ver src/main.tsx.
function RootLayout() {
  if (import.meta.env.VITE_MAINTENANCE_MODE === 'true') {
    return <MaintenancePage />;
  }
  return (
    <ToastProvider>
      <PageViewTracker />
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </ErrorBoundary>
    </ToastProvider>
  );
}

export const routes: RouteRecord[] = [
  {
    Component: RootLayout,
    children: [
      { path: '/', element: <Landing /> },
      // /landing -> / : el manual pide una sola URL canonica para la landing (sec. 6.4).
      { path: '/landing', element: <Navigate to="/" replace /> },
      { path: '/landing-v2', element: <LandingV2 /> },
      { path: '/funciones', element: <FeaturesPage /> },
      { path: '/funciones/finanzas', element: <FeatureFinancePage /> },
      { path: '/funciones/crm', element: <FeatureCRMPage /> },
      { path: '/funciones/planner', element: <FeaturePlannerPage /> },
      { path: '/funciones/asistente-ia', element: <FeatureAIPage /> },
      { path: '/precios', element: <PricingPage /> },
      { path: '/blog', element: <BlogIndexPage /> },
      { path: '/blog/categoria/:slug', element: <BlogCategoryPage /> },
      { path: '/blog/:slug', element: <BlogPostPage /> },
      { path: '/autores/:slug', element: <AuthorPage /> },
      { path: '/privacidad', element: <Privacidad /> },
      { path: '/terminos', element: <Terminos /> },
      // No indexables -- excluidas explicitamente del prerender via
      // ssgOptions.includedRoutes en vite.config.ts, nunca se renderizan en Node.
      { path: '/admin/*', element: <AdminCRMRoute /> },
      { path: '/maintenance', element: <MaintenancePage /> },
      { path: '/app', element: <App /> },
      { path: '*', element: <NotFound /> },
    ],
  },
];
