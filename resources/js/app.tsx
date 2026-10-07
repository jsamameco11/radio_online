import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import { createInertiaApp } from "@inertiajs/react";
import type { ComponentType } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";

const appName = import.meta.env.VITE_APP_NAME || "Tu Radio Online";
const pages = import.meta.glob<{ default: ComponentType }>("./Pages/**/*.tsx");

createInertiaApp({
  title: (title) => (title ? `${title} · ${appName}` : appName),
  resolve: (name) => {
    const page = pages[`./Pages/${name}.tsx`];
    if (!page) throw new Error(`Missing Inertia page: ${name}`);
    return page().then((module) => module.default);
  },
  setup({ el, App, props }) {
    const app = <App {...props} />;
    if (el.hasChildNodes()) hydrateRoot(el, app);
    else createRoot(el).render(app);
  },
  progress: { color: "#ff4d4f", showSpinner: false },
});
