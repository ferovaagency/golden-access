import { useEffect, useRef } from 'react';

/** Llama onVisible() la primera vez que el elemento referenciado entra en viewport. Usado para eventos tipo pricing_view/blog_article_view. */
export function useInViewOnce<T extends HTMLElement>(onVisible: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    let fired = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !fired) {
        fired = true;
        onVisible();
        observer.disconnect();
      }
    }, { threshold: 0.3 });
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}
