import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackEvent } from './analytics';

/** Dispara page_view en cada cambio de ruta -- montar una sola vez, dentro del Router. */
export function usePageView() {
  const location = useLocation();
  useEffect(() => {
    trackEvent('page_view', { path: location.pathname });
  }, [location.pathname]);
}
