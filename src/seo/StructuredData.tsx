import { SITE_URL, SITE_NAME } from './config';

// Fabricas de JSON-LD (Manual_Landing_Blog_SEO_Ferova_One, sec. 6.5). Devuelven
// objetos planos para pasarle a <SeoHead jsonLd={...} />, no componentes --
// mas facil de combinar varios en un array por pagina.

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Ferova Agency',
    url: SITE_URL,
    // TODO (manual, sec. 14 "Pendientes antes de publicar"): logo definitivo y datos legales del publisher.
  };
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/blog?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

/** price=null cuando todavia no esta confirmado -- omite el bloque `offers` en vez de inventar un numero. */
export function softwareApplicationSchema(options?: { price?: string; priceCurrency?: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: 'Sistema operativo empresarial para finanzas, ventas, proyectos y planificación con asistente de IA contextual.',
    ...(options?.price ? { offers: { '@type': 'Offer', price: options.price, priceCurrency: options.priceCurrency || 'USD' } } : {}),
    publisher: { '@type': 'Organization', name: 'Ferova Agency' },
  };
}

export function breadcrumbSchema(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

export function personSchema(author: { name: string; slug: string; bio: string; role?: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: author.name,
    url: `${SITE_URL}/autores/${author.slug}`,
    description: author.bio,
    ...(author.role ? { jobTitle: author.role } : {}),
  };
}

export function blogPostingSchema(post: {
  title: string;
  description: string;
  slug: string;
  publishedAt: string;
  updatedAt?: string;
  authorName: string;
  authorSlug: string;
  image?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    url: `${SITE_URL}/blog/${post.slug}`,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    author: { '@type': 'Person', name: post.authorName, url: `${SITE_URL}/autores/${post.authorSlug}` },
    publisher: { '@type': 'Organization', name: 'Ferova Agency' },
    ...(post.image ? { image: post.image } : {}),
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/blog/${post.slug}` },
  };
}

export function collectionPageSchema(options: { name: string; description: string; path: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: options.name,
    description: options.description,
    url: `${SITE_URL}${options.path}`,
  };
}
