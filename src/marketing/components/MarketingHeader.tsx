import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

/** Header compartido de la capa publica (Manual_Landing_Blog_SEO, sec. 4 y 8.1). Sticky, translucido. */
export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--ferova-line)] bg-[var(--ferova-canvas)]/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-display font-semibold tracking-tight">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--ferova-brand)] text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <span>Ferova One</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-[#57524a] md:flex">
          <Link to="/funciones" className="hover:text-[#1f1b16]">Producto</Link>
          <Link to="/precios" className="hover:text-[#1f1b16]">Precios</Link>
          <Link to="/blog" className="hover:text-[#1f1b16]">Blog</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link to="/app" className="hidden text-sm font-medium text-[#57524a] hover:text-[#1f1b16] sm:inline">Iniciar sesión</Link>
          <Link
            to="/app"
            className="rounded-[var(--ferova-radius-pill)] bg-[var(--ferova-brand)] px-4 py-2 text-sm font-medium font-display text-white hover:bg-[var(--ferova-brand-2)]"
          >
            Crear mi cuenta
          </Link>
        </div>
      </div>
    </header>
  );
}
