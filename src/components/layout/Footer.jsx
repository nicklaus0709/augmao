import React from "react";
import AuvanceLogo from "@/components/layout/AuvanceLogo";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative w-full overflow-hidden bg-navy-950">
      <div className="bp-grid-dark pointer-events-none absolute inset-0 opacity-30" aria-hidden="true" />
      <div className="relative mx-auto flex max-w-[1280px] flex-col items-center px-6 py-8 text-center">
        <p className="text-xs text-cream/50 sm:text-sm">
          © {year} AuGmao · Gestión de Mantenimiento. Todos los derechos reservados.
        </p>
        <div className="h-10" />
        <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-cream/40">Desarrollado por</span>
        <div className="h-10" />
        <AuvanceLogo />
      </div>
    </footer>
  );
}