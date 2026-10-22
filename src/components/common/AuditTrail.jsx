import React, { useEffect, useState } from "react";
import { History } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { formatDateTime } from "@/lib/format";
import { Spinner } from "@/components/common/EmptyState";

const FIELD_LABELS = {
  status: "Estado",
  stock_current: "Stock",
  app_role: "Rol",
  active: "Activo",
  name: "Nombre",
  code: "Código",
  location: "Ubicación",
  stock_minimum: "Stock mínimo",
  unit_cost: "Costo unitario",
};

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "sí" : "no";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// Historial de cambios (entidad AuditLog, la escriben las funciones de backend).
// Solo visible para jefes de área y administradores.
export default function AuditTrail({ entity, entityId, limit = 30 }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!entityId) return undefined;
    let alive = true;
    setLoading(true);
    base44.entities.AuditLog.filter({ entity, entity_id: entityId }, { sort: "-created_date", limit })
      .then((page) => alive && setEntries(page.items || []))
      .catch(() => alive && setFailed(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [entity, entityId, limit]);

  return (
    <section className="card-surface p-5">
      <h2 className="mb-4 flex items-center gap-2 font-heading text-base font-bold text-navy">
        <History size={17} className="text-brand-600" aria-hidden="true" />
        Historial de cambios
      </h2>
      {loading ? (
        <div className="flex justify-center py-6">
          <Spinner className="h-5 w-5" />
        </div>
      ) : failed ? (
        <p className="text-sm text-mutedText">No se pudo cargar el historial.</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-mutedText">Sin cambios registrados.</p>
      ) : (
        <ol className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="border-b border-line/70 pb-2 last:border-0 last:pb-0">
              <p className="text-sm text-navy">{entry.summary || entry.action}</p>
              {entry.changes && (
                <ul className="mt-1 space-y-0.5">
                  {Object.entries(entry.changes).map(([field, change]) => (
                    <li key={field} className="text-xs text-mutedText">
                      {FIELD_LABELS[field] || field}: {formatValue(change?.from)} → {formatValue(change?.to)}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-0.5 text-xs text-mutedText">
                {entry.actor_name || "Sistema"} · {formatDateTime(entry.created_date)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
