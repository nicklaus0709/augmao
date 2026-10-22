import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({ page, totalPages, total, onChange }) {
  const safeTotal = Math.max(1, totalPages || 1);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/70 px-4 py-3">
      <p className="text-xs text-mutedText">
        Página {page} de {safeTotal} · {total} resultados
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn-secondary disabled:opacity-40"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
        >
          <ChevronLeft size={16} />
          <span className="hidden sm:inline">Anterior</span>
        </button>
        <button
          type="button"
          className="btn-secondary disabled:opacity-40"
          onClick={() => onChange(page + 1)}
          disabled={page >= safeTotal}
          aria-label="Página siguiente"
        >
          <span className="hidden sm:inline">Siguiente</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}