<<<<<<< Updated upstream
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/600.css';
import '@fontsource/figtree/700.css';
import Router from './router';
import { ToastProvider } from './components/ui/toast';
import { initObservability } from './lib/observability';
import './index.css';
import './styles/product-blue.css';
=======
import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import "@fontsource/outfit/700.css";
import "@fontsource/figtree/400.css";
import "@fontsource/figtree/500.css";
import "@fontsource/figtree/600.css";
import "@fontsource/figtree/700.css";
import Router from "./router";
import { ToastProvider } from "./components/ui/toast";
import { initObservability } from "./lib/observability";
import "./index.css";
>>>>>>> Stashed changes

initObservability();

const application = (
  <StrictMode>
    <ToastProvider>
      <Router />
    </ToastProvider>
  </StrictMode>
);

<<<<<<< Updated upstream
=======
const root = document.getElementById("root")!;
const currentPath = window.location.pathname.replace(/\/$/, "") || "/";
if (root.dataset.prerendered === currentPath && root.hasChildNodes()) {
  hydrateRoot(root, application);
} else {
  // SPA fallback pages must never hydrate another route's static markup.
  createRoot(root).render(application);
}
>>>>>>> Stashed changes
