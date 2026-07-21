import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { MDXProvider } from '@mdx-js/react';
import { Calendar, Clock3 } from 'lucide-react';
import { MarketingHeader } from '../../marketing/components/MarketingHeader';
import { MarketingFooter } from '../../marketing/components/MarketingFooter';
import { SeoHead } from '../../seo/SeoHead';
import { blogPostingSchema, breadcrumbSchema } from '../../seo/StructuredData';
import { Breadcrumb } from '../components/Breadcrumb';
import { mdxComponents } from '../components/mdxComponents';
import { getPostBySlug, getRelatedPosts } from '../lib/posts';
import { getAuthor } from '../../content/authors';
import { getCategory } from '../../content/categories';
import { AnimatedCard } from '../../components/motion/AnimatedCard';

interface TocItem { id: string; text: string; level: number }

function slugify(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getPostBySlug(slug) : undefined;
  const articleRef = useRef<HTMLDivElement>(null);
  const [toc, setToc] = useState<TocItem[]>([]);

  useEffect(() => {
    if (!articleRef.current) return;
    const headings = Array.from(articleRef.current.querySelectorAll('h2, h3'));
    const items: TocItem[] = headings.map((heading) => {
      const text = heading.textContent || '';
      const id = heading.id || slugify(text);
      heading.id = id;
      return { id, text, level: heading.tagName === 'H2' ? 2 : 3 };
    });
    setToc(items);
  }, [post?.meta.slug]);

  if (!post) return <Navigate to="/blog" replace />;

  const author = getAuthor(post.meta.authorSlug);
  const category = getCategory(post.meta.category);
  const related = getRelatedPosts(post);
  const readingMinutes = post.meta.readingMinutes || 6;
  const Content = post.Component;

  return (
    <div className="min-h-screen bg-[var(--ferova-canvas)] text-[#1f1b16] font-sans">
      <SeoHead
        title={post.meta.title}
        description={post.meta.description}
        path={`/blog/${post.meta.slug}`}
        ogImage={post.meta.featuredImage}
        type="article"
        jsonLd={[
          blogPostingSchema({
            title: post.meta.title,
            description: post.meta.description,
            slug: post.meta.slug,
            publishedAt: post.meta.publishedAt,
            updatedAt: post.meta.updatedAt,
            authorName: author?.name || 'Ferova Agency',
            authorSlug: post.meta.authorSlug,
            image: post.meta.featuredImage,
          }),
          breadcrumbSchema([
            { name: 'Inicio', path: '/' },
            { name: 'Blog', path: '/blog' },
            ...(category ? [{ name: category.name, path: `/blog/categoria/${category.slug}` }] : []),
            { name: post.meta.title, path: `/blog/${post.meta.slug}` },
          ]),
        ]}
      />
      <MarketingHeader />

      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Breadcrumb
          items={[
            { label: 'Inicio', path: '/' },
            { label: 'Blog', path: '/blog' },
            ...(category ? [{ label: category.name, path: `/blog/categoria/${category.slug}` }] : []),
            { label: post.meta.title },
          ]}
        />

        <header className="mt-4">
          {category && (
            <Link to={`/blog/categoria/${category.slug}`} className="text-xs font-semibold uppercase tracking-widest text-[var(--ferova-brand)]">
              {category.name}
            </Link>
          )}
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#1f1b16] sm:text-4xl">{post.meta.title}</h1>
          <p className="mt-3 text-base text-[#57524a]">{post.meta.description}</p>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-[#8a8377]">
            <span>{author?.name || 'Ferova Agency'}</span>
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {post.meta.publishedAt}</span>
            <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {readingMinutes} min de lectura</span>
          </div>
        </header>

        {toc.length > 0 && (
          <nav aria-label="Tabla de contenidos" className="mt-8 rounded-[var(--ferova-radius-control)] border border-[var(--ferova-line)] bg-[var(--ferova-soft)] p-4 lg:sticky lg:top-20">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#a39a8a]">En este artículo</p>
            <ul className="mt-2 space-y-1 text-sm">
              {toc.map((item) => (
                <li key={item.id} className={item.level === 3 ? 'pl-3' : ''}>
                  <a href={`#${item.id}`} className="text-[#57524a] hover:text-[var(--ferova-brand)]">{item.text}</a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div ref={articleRef}>
          <MDXProvider components={mdxComponents}>
            <Content />
          </MDXProvider>
        </div>

        <AnimatedCard hoverable={false} className="mt-10 rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] p-6 text-center shadow-[var(--ferova-shadow)]">
          <p className="font-display text-lg font-semibold text-[#1f1b16]">{post.meta.cta.label}</p>
          <Link
            to={post.meta.cta.href}
            className="mt-3 inline-flex items-center gap-2 rounded-[var(--ferova-radius-pill)] bg-[var(--ferova-brand)] px-5 py-2.5 text-sm font-medium font-display text-white hover:bg-[var(--ferova-brand-2)]"
          >
            Empezar ahora
          </Link>
        </AnimatedCard>

        {author && (
          <div className="mt-10 flex items-start gap-3 rounded-[var(--ferova-radius-control)] border border-[var(--ferova-line)] bg-[var(--ferova-soft)] p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--ferova-brand)] font-display text-sm font-bold text-white">
              {author.name.charAt(0)}
            </div>
            <div>
              <Link to={`/autores/${author.slug}`} className="font-display text-sm font-semibold text-[#1f1b16] hover:text-[var(--ferova-brand)]">{author.name}</Link>
              <p className="mt-1 text-xs leading-5 text-[#8a8377]">{author.bio}</p>
            </div>
          </div>
        )}

        {related.length > 0 && (
          <div className="mt-12">
            <p className="font-display text-lg font-semibold text-[#1f1b16]">Relacionados</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {related.map((relatedPost) => (
                <Link
                  key={relatedPost.meta.slug}
                  to={`/blog/${relatedPost.meta.slug}`}
                  className="rounded-[var(--ferova-radius-control)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] p-4 text-sm font-medium text-[#1f1b16] transition hover:border-[var(--ferova-brand)]/40"
                >
                  {relatedPost.meta.title}
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>

      <MarketingFooter />
    </div>
  );
}
