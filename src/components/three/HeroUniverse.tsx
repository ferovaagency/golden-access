import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';

const ProductUniverseCanvas = lazy(() => import('./ProductUniverse'));

interface HeroUniverseProps {
  /** Fallback CSS/2D -- se usa mientras carga, en movil (<768px) y con prefers-reduced-motion. */
  poster: ReactNode;
}

function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible');
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return visible;
}

/**
 * Nunca bloquea el LCP: el poster (CSS, Nivel A) se pinta de inmediato;
 * el canvas WebGL se monta despues, solo en desktop y sin reduced-motion,
 * y detiene su render loop cuando la pestana no esta visible.
 */
export function HeroUniverse({ poster }: HeroUniverseProps) {
  const [eligible, setEligible] = useState(false);
  const pageVisible = usePageVisible();

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isDesktopWidth = window.innerWidth >= 768;
    setEligible(isDesktopWidth && !prefersReducedMotion);
  }, []);

  if (!eligible) return <>{poster}</>;

  return (
    <div className="relative h-full w-full">
      <Suspense fallback={poster}>
        <div className="h-[360px] w-full sm:h-[420px]" style={{ display: pageVisible ? 'block' : 'none' }}>
          <ProductUniverseCanvas />
        </div>
        {!pageVisible && poster}
      </Suspense>
    </div>
  );
}
