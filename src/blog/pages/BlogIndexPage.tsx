import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Calculator } from 'lucide-react';
import { MarketingHeader } from '../../marketing/components/MarketingHeader';
import { MarketingFooter } from '../../marketing/components/MarketingFooter';
import { SeoHead } from '../../seo/SeoHead';
import { collectionPageSchema } from '../../seo/StructuredData';
import { AnimatedCard } from '../../components/motion/AnimatedCard';
import { getPublishedPosts } from '../lib/posts';
import { CATEGORIES } from '../../content/categories';

const PAGE_SIZE = 9;

export default function BlogIndexPage() {
  const [searchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const posts = getPublishedPosts();
  const [featured, ...rest] = posts;
  const totalPages = Math.max(1, Math.ceil(rest.length / PAGE_SIZE));
  const pageItems = rest.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="min-h-screen bg-[var(--ferova-canvas)] text-[#1f1b16] font-sans">
      <SeoHead
        title="Blog"
        description="Guías prácticas de finanzas, ventas, operación y productividad para pequeñas empresas y freelancers en Colombia."
        path="/blog"
        jsonLd={collectionPageSchema({ name: 'Blog de Ferova One', description: 'Biblioteca de decisiones para small business.', path: '/blog' })}
      />
      <MarketingHeader />

      <section className="border-b border-[var(--ferova-line)] bg-[var(--ferova-soft)]">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
          <span className="text-xs font-semibold uppercase tracking-widest text-[var(--ferova-brand)]">Blog</span>
          <h1 className="mt-2 font-display text-3xl font-bold text-[#1f1b16] sm:text-4xl">Decisiones, no solo noticias</h1>
          <p className="mx-auto mt-3 max-w-xl text-[#57524a]">Guías prácticas para saber si tu negocio es rentable, vender mejor y operar sin depender de diez herramientas sueltas.</p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((category) => (
            <Link
              key={category.slug}
              to={`/blog/categoria/${category.slug}`}
              className="rounded-[var(--ferova-radius-pill)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] px-4 py-2 text-sm font-medium text-[#57524a] hover:border-[var(--ferova-brand)]/40 hover:text-[#1f1b16]"
            >
              {category.name}
            </Link>
          ))}
        </div>

        {featured && (
          <Link to={`/blog/${featured.meta.slug}`} className="mt-8 block">
            <AnimatedCard className="grid gap-6 rounded-[var(--ferova-radius-hero)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] p-6 shadow-[var(--ferova-shadow)] sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest text-[var(--ferova-brand)]">Destacado</span>
                <h2 className="mt-2 font-display text-2xl font-semibold text-[#1f1b16] sm:text-3xl">{featured.meta.title}</h2>
                <p className="mt-2 text-sm text-[#57524a]">{featured.meta.description}</p>
              </div>
              <span className="inline-flex items-center gap-2 whitespace-nowrap font-display text-sm font-semibold text-[var(--ferova-brand)]">
                Leer artículo <ArrowRight className="h-4 w-4" />
              </span>
            </AnimatedCard>
          </Link>
        )}

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pageItems.map((post) => (
            <Link key={post.meta.slug} to={`/blog/${post.meta.slug}`}>
              <AnimatedCard className="h-full rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] p-5">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#a39a8a]">{post.meta.category}</span>
                <h3 className="mt-2 font-display text-base font-semibold text-[#1f1b16]">{post.meta.title}</h3>
                <p className="mt-2 text-sm text-[#57524a]">{post.meta.description}</p>
              </AnimatedCard>
            </Link>
          ))}
        </div>

        {totalPages > 1 && (
          <nav aria-label="Paginación del blog" className="mt-10 flex justify-center gap-2">
            {Array.from({ length: totalPages }).map((_, index) => {
              const pageNumber = index + 1;
              return (
                <Link
                  key={pageNumber}
                  to={pageNumber === 1 ? '/blog' : `/blog?page=${pageNumber}`}
                  className={`grid h-9 w-9 place-items-center rounded-[var(--ferova-radius-control)] text-sm font-medium ${
                    pageNumber === page ? 'bg-[var(--ferova-brand)] text-white' : 'border border-[var(--ferova-line)] text-[#57524a] hover:bg-[var(--ferova-soft)]'
                  }`}
                >
                  {pageNumber}
                </Link>
              );
            })}
          </nav>
        )}

        <AnimatedCard hoverable={false} className="mt-14 flex flex-col items-center gap-3 rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] bg-[var(--ferova-soft)] p-8 text-center">
          <Calculator className="h-6 w-6 text-[var(--ferova-navy)]" />
          <p className="font-display text-lg font-semibold text-[#1f1b16]">Calculadoras y plantillas</p>
          <p className="max-w-md text-sm text-[#57524a]">Punto de equilibrio, costo por hora y margen por cliente — herramientas prácticas dentro de los artículos de Rentabilidad.</p>
          <Link to="/blog/categoria/rentabilidad" className="text-sm font-semibold text-[var(--ferova-brand)] hover:text-[var(--ferova-brand-2)]">Ver artículos de Rentabilidad →</Link>
        </AnimatedCard>

        <div className="mt-10 text-center">
          <Link to="/app" className="inline-flex items-center gap-2 rounded-[var(--ferova-radius-pill)] bg-[var(--ferova-brand)] px-6 py-3 font-medium font-display text-white hover:bg-[var(--ferova-brand-2)]">
            Probar Ferova One <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <MarketingFooter />
    </div>
  );
}
