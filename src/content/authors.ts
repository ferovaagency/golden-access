// Manual_Landing_Blog_SEO_Ferova_One, sec. 14: "Autores del blog" queda
// explicitamente pendiente de confirmar. Este placeholder deja la
// arquitectura (Person schema, biografia, enlace /autores/:slug) lista para
// cuando existan autores reales -- reemplazar antes de publicar en serio.
export interface Author {
  slug: string;
  name: string;
  role: string;
  bio: string;
}

export const AUTHORS: Author[] = [
  {
    slug: 'equipo-ferova',
    name: 'Equipo Ferova',
    role: 'Ferova Agency',
    bio: 'Contenido editorial de Ferova Agency sobre gestión financiera, ventas y operación para pequeñas empresas. Perfil placeholder -- reemplazar con autores reales y su experiencia antes de publicar.',
  },
];

export function getAuthor(slug: string): Author | undefined {
  return AUTHORS.find((author) => author.slug === slug);
}
