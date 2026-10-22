import { base44 } from "@/api/base44Client";

// Envía errores del navegador a la función reportClientError (página "Salud del
// sistema"). Sin datos personales: solo mensaje, stack, ruta y versión.
const MAX_REPORTS_PER_SESSION = 10;
const reported = new Set();

export const APP_RELEASE = import.meta.env.VITE_APP_RELEASE || "dev";

export function reportClientError(error, kind = "error") {
  try {
    const message = String(error?.message || error || "Error desconocido").slice(0, 500);
    const key = kind + "|" + message;
    if (reported.has(key) || reported.size >= MAX_REPORTS_PER_SESSION) return;
    reported.add(key);
    base44.functions
      .invoke("reportClientError", {
        kind,
        message,
        stack: String(error?.stack || "").slice(0, 2000),
        path: window.location.pathname,
        release: APP_RELEASE,
      })
      .catch(() => {
        /* sin sesión o sin red: no hay dónde reportarlo */
      });
  } catch (e) {
    /* reportar nunca debe romper la app */
  }
}

let installed = false;

export function installGlobalErrorHandlers() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (event) => reportClientError(event.error || event.message, "window.error"));
  window.addEventListener("unhandledrejection", (event) => reportClientError(event.reason, "unhandledrejection"));
}
