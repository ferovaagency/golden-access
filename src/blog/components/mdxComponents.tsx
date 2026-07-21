import type { ComponentProps } from 'react';

// Mapea los elementos que produce MDX a estilos Ferova (tokens --ferova-*),
// sin depender de @tailwindcss/typography. Usado via MDXProvider en
// BlogPostPage -- el contenido .mdx sigue siendo Markdown/JSX puro.
export const mdxComponents = {
  h2: (props: ComponentProps<'h2'>) => <h2 className="mt-10 scroll-mt-28 font-display text-2xl font-semibold text-[#1f1b16]" {...props} />,
  h3: (props: ComponentProps<'h3'>) => <h3 className="mt-8 scroll-mt-28 font-display text-xl font-semibold text-[#1f1b16]" {...props} />,
  h4: (props: ComponentProps<'h4'>) => <h4 className="mt-6 font-display text-base font-semibold text-[#1f1b16]" {...props} />,
  p: (props: ComponentProps<'p'>) => <p className="mt-4 text-[15px] leading-7 text-[#3a352e]" {...props} />,
  ul: (props: ComponentProps<'ul'>) => <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-7 text-[#3a352e]" {...props} />,
  ol: (props: ComponentProps<'ol'>) => <ol className="mt-4 list-decimal space-y-2 pl-5 text-[15px] leading-7 text-[#3a352e]" {...props} />,
  li: (props: ComponentProps<'li'>) => <li {...props} />,
  a: (props: ComponentProps<'a'>) => <a className="font-medium text-[var(--ferova-brand)] underline underline-offset-2 hover:text-[var(--ferova-brand-2)]" {...props} />,
  strong: (props: ComponentProps<'strong'>) => <strong className="font-semibold text-[#1f1b16]" {...props} />,
  blockquote: (props: ComponentProps<'blockquote'>) => (
    <blockquote className="mt-6 rounded-[var(--ferova-radius-control)] border-l-4 border-[var(--ferova-brand)] bg-[var(--ferova-soft)] px-4 py-3 text-sm italic text-[#57524a]" {...props} />
  ),
  hr: (props: ComponentProps<'hr'>) => <hr className="my-10 border-[var(--ferova-line)]" {...props} />,
  table: (props: ComponentProps<'table'>) => (
    <div className="mt-6 overflow-x-auto rounded-[var(--ferova-radius-control)] border border-[var(--ferova-line)]">
      <table className="w-full min-w-[480px] border-collapse text-sm" {...props} />
    </div>
  ),
  thead: (props: ComponentProps<'thead'>) => <thead className="bg-[var(--ferova-soft)]" {...props} />,
  th: (props: ComponentProps<'th'>) => <th className="border-b border-[var(--ferova-line)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#57524a]" {...props} />,
  td: (props: ComponentProps<'td'>) => <td className="border-b border-[var(--ferova-line)] px-3 py-2 text-[#3a352e]" {...props} />,
  code: (props: ComponentProps<'code'>) => <code className="rounded bg-[var(--ferova-soft)] px-1.5 py-0.5 font-mono text-[13px] text-[#1f1b16]" {...props} />,
};
