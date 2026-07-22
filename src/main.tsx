import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/600.css';
import '@fontsource/figtree/700.css';
import { ViteReactSSG } from 'vite-react-ssg';
import { routes } from './router';
import './index.css';

// SeoHead/StructuredData/ToastProvider siguen viviendo en el arbol de rutas
// (ver src/router.tsx, RootLayout) -- este archivo solo arranca el render,
// igual que antes con createRoot().render(), pero via ViteReactSSG para que
// `vite-react-ssg build` pueda prerenderizar las rutas publicas listadas en
// vite.config.ts (ssgOptions.includedRoutes). `npm run dev` sigue siendo
// `vite` normal (CSR), sin cambios de flujo de desarrollo.
export const createRoot = ViteReactSSG({ routes });
