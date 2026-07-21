import type { ComponentType } from 'react';
import type { PostMeta } from '../../content/blog/postMeta';

export interface Post {
  meta: PostMeta;
  Component: ComponentType<Record<string, unknown>>;
}

interface MdxModule {
  default: ComponentType<Record<string, unknown>>;
  meta: PostMeta;
}

// import.meta.glob compila en build time -- cada .mdx nuevo en
// src/content/blog/ aparece aca automaticamente, sin tocar este archivo.
const modules = import.meta.glob<MdxModule>('/src/content/blog/*.mdx', { eager: true });

const allPosts: Post[] = Object.values(modules)
  .map((mod) => ({ meta: mod.meta, Component: mod.default }))
  .sort((a, b) => b.meta.publishedAt.localeCompare(a.meta.publishedAt));

/** Solo lo que es seguro mostrar en el sitio publico. */
export function getPublishedPosts(): Post[] {
  return allPosts.filter((post) => post.meta.status === 'published');
}

export function getPostBySlug(slug: string): Post | undefined {
  return getPublishedPosts().find((post) => post.meta.slug === slug);
}

export function getPostsByCategory(categorySlug: string): Post[] {
  return getPublishedPosts().filter((post) => post.meta.category === categorySlug);
}

export function getPostsByAuthor(authorSlug: string): Post[] {
  return getPublishedPosts().filter((post) => post.meta.authorSlug === authorSlug);
}

export function getRelatedPosts(post: Post): Post[] {
  const bySlug = new Map(getPublishedPosts().map((p) => [p.meta.slug, p]));
  return post.meta.relatedSlugs.map((slug) => bySlug.get(slug)).filter((p): p is Post => Boolean(p));
}
