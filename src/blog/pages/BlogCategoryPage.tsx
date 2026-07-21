import { Link, Navigate, useParams } from 'react-router-dom';
import { MarketingHeader } from '../../marketing/components/MarketingHeader';
import { MarketingFooter } from '../../marketing/components/MarketingFooter';
import { SeoHead } from '../../seo/SeoHead';
import { collectionPageSchema, breadcrumbSchema } from '../../seo/StructuredData';
import { Breadcrumb } from '../components/Breadcrumb';
import { AnimatedCard } from '../../components/motion/AnimatedCard';
import { getPostsByCategory } from '../lib/posts';
import { getCategory } from '../../content/categories';

export default function BlogCategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const category = slug ? getCategory(slug) : undefined;
  if (!category) return <Navigate to="/blog" replace />;

  const posts = getPostsByCategory(category.slug);

  return (
    <div className="min-h-screen bg-[var(--ferova-canvas)] text-[#1f1b16] font-sans">
      <SeoHead
        title={category.name}
        description={category.description}
        path={`/blog/categoria/${category.slug}`}
        jsonLd={[
          collectionPageSchema({ name: category.name, description: category.description, path: `/blog/categoria/${category.slug}` }),
          breadcrumbSchema([{ name: 'Inicio', path: '/' }, { name: 'Blog', path: '/blog' }, { name: category.name, path: `/blog/categoria/${category.slug}` }]),
        ]}
      />
      <MarketingHeader />

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <Breadcrumb items={[{ label: 'Inicio', path: '/' }, { label: 'Blog', path: '/blog' }, { label: category.name }]} />
        <span className="mt-4 block text-xs font-semibold uppercase tracking-widest text-[var(--ferova-brand)]">Clúster</span>
        <h1 className="mt-2 font-display text-3xl font-bold text-[#1f1b16] sm:text-4xl">{category.pillarTitle}</h1>
        <p className="mt-3 max-w-2xl text-[#57524a]">{category.description}</p>

        {posts.length === 0 ? (
          <p className="mt-10 text-sm text-[#8a8377]">Todavía no hay artículos publicados en este clúster.</p>
        ) : (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link key={post.meta.slug} to={`/blog/${post.meta.slug}`}>
                <AnimatedCard className="h-full rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] p-5">
                  <h2 className="font-display text-base font-semibold text-[#1f1b16]">{post.meta.title}</h2>
                  <p className="mt-2 text-sm text-[#57524a]">{post.meta.description}</p>
                </AnimatedCard>
              </Link>
            ))}
          </div>
        )}
      </div>

      <MarketingFooter />
    </div>
  );
}
