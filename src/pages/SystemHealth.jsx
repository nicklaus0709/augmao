import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, AlertTriangle, CalendarClock, RefreshCw, ShieldAlert, Boxes } from "lucide-react";
import { callFunction } from "@/api/data";
import PageHeader from "@/components/common/PageHeader";
import StatCard from "@/components/common/StatCard";
import { LoadingBlock } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/Badges";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const RUN_TONE = {
  OK: "bg-emerald-100 text-emerald-800",
  ERROR: "bg-red-100 text-red-700",
  RUNNING: "bg-amber-100 text-amber-800",
};

function sinceLabel(iso, nowIso) {
  const hours = Math.max(0, Math.round((new Date(nowIso) - new Date(iso)) / 3600000));
  return hours < 1 ? "Recién" : `Hace ${hours} h`;
}

function Section({ title, children, empty, count }) {
  return (
    <section className="card-surface p-5">
      <h2 className="mb-4 font-heading text-base font-bold text-navy">
        {title}
        {count !== undefined && <span className="ml-2 font-mono text-xs text-mutedText">{count}</span>}
      </h2>
      {empty ? <p className="text-sm text-mutedText">{empty}</p> : children}
    </section>
  );
}

function Table({ head, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b border-line">
            {head.map((label) => (
              <th key={label} className="table-head py-2 text-left">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}

// Tablero para administradores: si corrieron los preventivos, qué falla, quién
// intenta acciones fuera de su rol y qué necesita atención en planta.
export default function SystemHealth() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await callFunction("systemHealth", {}, "No se pudo cargar el estado del sistema"));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = (
    <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
      <RefreshCw size={16} className={cn(loading && "animate-spin")} aria-hidden="true" />
      Actualizar
    </button>
  );

  if (loading && !data) {
    return (
      <div className="card-surface">
        <LoadingBlock label="Revisando el sistema..." />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div>
        <PageHeader eyebrow="Administración" title="Salud del sistema" actions={refresh} />
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      </div>
    );
  }

  const { preventives, errors, operations, audit } = data;

  return (
    <div>
      <PageHeader
        eyebrow="Administración"
        title="Salud del sistema"
        subtitle={`Últimas 24 horas · actualizado ${formatDateTime(data.generated_at)}`}
        actions={refresh}
      />

      {preventives.stale && (
        <p className="mb-5 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          {preventives.last_ok_at
            ? `Los preventivos no se generan desde ${formatDateTime(preventives.last_ok_at)}. Revisá el workflow "Preventivos diarios" en Base44.`
            : 'No hay ninguna ejecución exitosa de "Preventivos diarios". Revisá que el workflow esté activo en Base44.'}
        </p>
      )}

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Último preventivo OK"
          value={preventives.last_ok_at ? sinceLabel(preventives.last_ok_at, data.generated_at) : "Nunca"}
          subtitle={preventives.last_ok_at ? formatDateTime(preventives.last_ok_at) : undefined}
          icon={CalendarClock}
          tone={preventives.stale ? "red" : "emerald"}
        />
        <StatCard title="Errores" value={errors.total} subtitle="Backend y navegador" icon={Activity} tone={errors.total ? "red" : "emerald"} />
        <StatCard title="Accesos denegados" value={errors.denied} subtitle="Acciones fuera del rol" icon={ShieldAlert} tone={errors.denied ? "amber" : "emerald"} />
        <StatCard title="Repuestos bajo mínimo" value={operations.low_stock.length} icon={Boxes} tone={operations.low_stock.length ? "amber" : "emerald"} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section title="Errores y rechazos por función" empty={errors.groups.length ? null : "Sin errores en las últimas 24 horas."}>
          <Table
            head={["Origen", "Función", "Tipo", "Cantidad", "Último"]}
            rows={errors.groups.map((group) => (
              <tr key={group.source + group.level + group.fn} className="border-b border-line/70 last:border-0 align-top">
                <td className="py-2 text-navy">{group.source === "frontend" ? "Navegador" : "Backend"}</td>
                <td className="py-2 font-mono text-xs text-navy">{group.fn}</td>
                <td className="py-2 text-navy">{group.level === "denied" ? "Denegado" : "Error"}</td>
                <td className="py-2 text-navy">{group.count}</td>
                <td className="py-2 text-xs text-mutedText">
                  <span className="block text-navy/80">{group.last_message}</span>
                  {formatDateTime(group.last_at)}
                </td>
              </tr>
            ))}
          />
        </Section>

        <Section title="Ejecuciones de preventivos" empty={preventives.runs.length ? null : "Todavía no hay ejecuciones registradas."}>
          <Table
            head={["Inicio", "Estado", "OTs", "Duración", "Detalle"]}
            rows={preventives.runs.map((run) => (
              <tr key={run.id} className="border-b border-line/70 last:border-0 align-top">
                <td className="py-2 text-navy">{formatDateTime(run.started_at)}</td>
                <td className="py-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", RUN_TONE[run.status])}>{run.status}</span>
                </td>
                <td className="py-2 text-navy">{run.generated ?? "-"}</td>
                <td className="py-2 text-navy">{run.duration_ms ? `${Math.round(run.duration_ms / 100) / 10} s` : "-"}</td>
                <td className="py-2 text-xs text-mutedText">{run.error || (run.codes || []).join(", ") || run.trigger}</td>
              </tr>
            ))}
          />
        </Section>

        <Section
          title="OTs vencidas"
          count={operations.overdue_count}
          empty={operations.overdue_work_orders.length ? null : "No hay OTs abiertas con fecha programada vencida."}
        >
          <Table
            head={["OT", "Estado", "Programada", "Técnico"]}
            rows={operations.overdue_work_orders.map((wo) => (
              <tr key={wo.id} className="border-b border-line/70 last:border-0">
                <td className="py-2">
                  <Link to={`/work-orders/${wo.id}`} className="font-mono text-xs text-brand-600 hover:underline">{wo.code}</Link>
                  <span className="block truncate text-navy">{wo.title}</span>
                </td>
                <td className="py-2"><StatusBadge value={wo.status} /></td>
                <td className="py-2 text-navy">{formatDateTime(wo.scheduled_at)}</td>
                <td className="py-2 text-navy">{wo.assigned_to_name || "Sin asignar"}</td>
              </tr>
            ))}
          />
        </Section>

        <Section
          title="En progreso hace más de 48 h"
          empty={operations.stuck_work_orders.length ? null : "Ninguna OT lleva más de 48 horas en progreso."}
        >
          <Table
            head={["OT", "Iniciada", "Técnico"]}
            rows={operations.stuck_work_orders.map((wo) => (
              <tr key={wo.id} className="border-b border-line/70 last:border-0">
                <td className="py-2">
                  <Link to={`/work-orders/${wo.id}`} className="font-mono text-xs text-brand-600 hover:underline">{wo.code}</Link>
                  <span className="block truncate text-navy">{wo.title}</span>
                </td>
                <td className="py-2 text-navy">{formatDateTime(wo.started_at)}</td>
                <td className="py-2 text-navy">{wo.assigned_to_name || "Sin asignar"}</td>
              </tr>
            ))}
          />
        </Section>

        <Section title="Repuestos bajo mínimo" empty={operations.low_stock.length ? null : "Todo el stock está sobre el mínimo."}>
          <Table
            head={["Repuesto", "Stock", "Mínimo"]}
            rows={operations.low_stock.map((part) => (
              <tr key={part.id} className="border-b border-line/70 last:border-0">
                <td className="py-2">
                  <Link to={`/inventory/${part.id}`} className="text-brand-600 hover:underline">{part.code} - {part.name}</Link>
                </td>
                <td className="py-2 text-red-600">{part.stock_current}</td>
                <td className="py-2 text-navy">{part.stock_minimum}</td>
              </tr>
            ))}
          />
        </Section>

        <Section title="Actividad reciente" empty={audit.length ? null : "Sin cambios registrados todavía."}>
          <ol className="space-y-3">
            {audit.map((entry) => (
              <li key={entry.id} className="border-b border-line/70 pb-2 last:border-0 last:pb-0">
                <p className="text-sm text-navy">{entry.summary || entry.action}</p>
                <p className="text-xs text-mutedText">
                  {entry.actor_name || "Sistema"} · {formatDateTime(entry.created_date)} · <span className="font-mono">{entry.request_id}</span>
                </p>
              </li>
            ))}
          </ol>
        </Section>
      </div>

      {preventives.overdue_plans.length > 0 && (
        <p className="mt-5 text-sm text-mutedText">
          Planes activos vencidos hace más de un día: {preventives.overdue_plans.map((plan) => plan.name).join(", ")}.
        </p>
      )}
    </div>
  );
}
