import { Link, Navigate, useParams } from 'react-router-dom';
import { MarketingHeader } from '../../marketing/components/MarketingHeader';
import { MarketingFooter } from '../../marketing/components/MarketingFooter';
import { SeoHead } from '../../seo/SeoHead';
import { personSchema, breadcrumbSchema } from '../../seo/StructuredData';
import { Breadcrumb } from '../components/Breadcrumb';
import { AnimatedCard } from '../../components/motion/AnimatedCard';
import { getPostsByAuthor } from '../lib/posts';
import { getAuthor } from '../../content/authors';

const MIN_POSTS_TO_INDEX = 3;

export default function AuthorPage() {
  const { slug } = useParams<{ slug: string }>();
  const author = slug ? getAuthor(slug) : undefined;
  if (!author) return <Navigate to="/blog" replace />;

  const posts = getPostsByAuthor(author.slug);

  return (
    <div className="min-h-screen bg-[var(--ferova-canvas)] text-[#1f1b16] font-sans">
      <SeoHead
        title={author.name}
        description={author.bio}
        path={`/autores/${author.slug}`}
        noindex={posts.length < MIN_POSTS_TO_INDEX}
        jsonLd={[
          personSchema(author),
          breadcrumbSchema([{ name: 'Inicio', path: '/' }, { name: 'Blog', path: '/blog' }, { name: author.name, path: `/autores/${author.slug}` }]),
        ]}
      />
      <MarketingHeader />

      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Breadcrumb items={[{ label: 'Inicio', path: '/' }, { label: 'Blog', path: '/blog' }, { label: author.name }]} />
        <div className="mt-4 flex items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[var(--ferova-brand)] font-display text-xl font-bold text-white">
            {author.name.charAt(0)}
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-[#1f1b16]">{author.name}</h1>
            <p className="text-sm text-[#8a8377]">{author.role}</p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-[#57524a]">{author.bio}</p>

        <p className="mt-10 font-display text-lg font-semibold text-[#1f1b16]">Artículos</p>
        {posts.length === 0 ? (
          <p className="mt-3 text-sm text-[#8a8377]">Todavía no hay artículos publicados de este autor.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
