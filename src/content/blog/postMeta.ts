// Campos de un articulo (Manual_Landing_Blog_SEO_Ferova_One, sec. 5, tabla de
// campos). Cada .mdx en este directorio exporta `export const meta: PostMeta`.
export type PostStatus = 'draft' | 'review' | 'published' | 'archived';

export interface PostMeta {
  title: string;
  slug: string;
  description: string;
  publishedAt: string;
  updatedAt?: string;
  authorSlug: string;
  category: string;
  tags?: string[];
  featuredImage?: string;
  featuredImageAlt?: string;
  canonical?: string;
  relatedSlugs: string[];
  cta: { label: string; href: string };
  status: PostStatus;
  /** Minutos estimados de lectura -- se puede fijar a mano o calcular en el loader. */
  readingMinutes?: number;
}
