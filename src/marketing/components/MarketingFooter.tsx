import { Link } from 'react-router-dom';
import { CATEGORIES } from '../../content/categories';

/** Footer compartido: producto, soluciones, recursos, legal y contacto (Manual_Landing_Blog_SEO, sec. 4 fila 15). */
export function MarketingFooter() {
  return (
    <footer className="border-t border-[var(--ferova-line)] bg-[var(--ferova-canvas)]">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="font-display font-semibold text-[#1f1b16]">Ferova One</div>
          <p className="mt-2 max-w-xs text-sm text-[#8a8377]">Sistema operativo empresarial para finanzas, ventas, proyectos y planificación con IA contextual.</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#a39a8a]">Producto</p>
          <ul className="mt-3 space-y-2 text-sm text-[#57524a]">
            <li><Link to="/funciones/finanzas" className="hover:text-[#1f1b16]">Finanzas</Link></li>
            <li><Link to="/funciones/crm" className="hover:text-[#1f1b16]">CRM</Link></li>
            <li><Link to="/funciones/planner" className="hover:text-[#1f1b16]">Planner</Link></li>
            <li><Link to="/funciones/asistente-ia" className="hover:text-[#1f1b16]">Asistente IA</Link></li>
            <li><Link to="/precios" className="hover:text-[#1f1b16]">Precios</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#a39a8a]">Recursos</p>
          <ul className="mt-3 space-y-2 text-sm text-[#57524a]">
            <li><Link to="/blog" className="hover:text-[#1f1b16]">Blog</Link></li>
            {CATEGORIES.slice(0, 4).map((category) => (
              <li key={category.slug}><Link to={`/blog/categoria/${category.slug}`} className="hover:text-[#1f1b16]">{category.name}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#a39a8a]">Legal</p>
          <ul className="mt-3 space-y-2 text-sm text-[#57524a]">
            <li><Link to="/terminos" className="hover:text-[#1f1b16]">Términos</Link></li>
            <li><Link to="/privacidad" className="hover:text-[#1f1b16]">Privacidad</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[var(--ferova-line)] py-6 text-center text-xs text-[#a39a8a]">
        © {new Date().getFullYear()} Ferova One. Todos los derechos reservados.
      </div>
    </footer>
  );
}
