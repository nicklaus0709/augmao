import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ClipboardList, CheckCircle, FileDown, CalendarDays, Boxes, AlertTriangle, ChevronRight, Clock, TrendingUp,
} from "lucide-react";
import { fetchAll } from "@/api/data";
import { useAuth } from "@/lib/AuthContext";
import PageHeader from "@/components/common/PageHeader";
import StatCard from "@/components/common/StatCard";
import { LoadingBlock } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/Badges";
import { TypeBarChart, StatusDonut, ChartCard } from "@/components/common/Charts";
import { computeKpis } from "@/lib/kpis";
import { can } from "@/lib/permissions";
import { exportGridList } from "@/lib/gridExport";
import { unitLabel } from "@/components/common/Badges";
import { formatDate, formatMinutes } from "@/lib/format";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [workOrders, setWorkOrders] = useState([]);
  const [parts, setParts] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [woResult, partsResult, assetsResult] = await Promise.all([
        fetchAll("WorkOrder", {}, { sort: "-created_date" }),
        fetchAll("SparePart", {}, { sort: "code" }),
        fetchAll("Asset", {}, { sort: "code" }),
      ]);
      setWorkOrders(woResult.items || []);
      setParts(partsResult.items || []);
      setAssets(assetsResult.items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const kpis = useMemo(() => computeKpis(workOrders), [workOrders]);
  const assetsById = useMemo(() => Object.fromEntries(assets.map((asset) => [asset.id, asset])), [assets]);
  const lowStock = useMemo(
    () => parts.filter((part) => Number(part.stock_current || 0) <= Number(part.stock_minimum || 0)),
    [parts]
  );
  const latest = useMemo(
    () => [...workOrders].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 5),
    [workOrders]
  );

  const exportInventory = () => {
    exportGridList({
      format: "excel",
      title: "Inventario",
      fileBase: "Inventario-stock-bajo",
      columns: [
        { label: "Código" },
        { label: "Nombre" },
        { label: "Unidad" },
        { label: "Stock actual", align: "right" },
        { label: "Stock mínimo", align: "right" },
        { label: "Ubicación" },
      ],
      rows: lowStock.map((part) => [
        part.code,
        part.name,
        unitLabel(part.unit),
        Number(part.stock_current || 0),
        Number(part.stock_minimum || 0),
        part.location || "",
      ]),
      filters: ["Stock bajo"],
      userName: user?.full_name || user?.email,
    });
  };

  if (loading) {
    return <div className="card-surface"><LoadingBlock label="Cargando dashboard..." /></div>;
  }

  return (
    <div>
      <PageHeader
        eyebrow="AuGmao"
        title="Dashboard"
        subtitle="Resumen general del sistema"
        actions={
          <button type="button" className="btn-secondary" onClick={() => navigate("/work-orders/calendar")}>
            <CalendarDays size={16} aria-hidden="true" />
            Ver en calendario
          </button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Total OTs"
          value={kpis.total}
          subtitle="en el periodo"
          icon={ClipboardList}
          tone="brand"
          onClick={() => navigate("/work-orders")}
        />
        <StatCard
          title="Completadas"
          value={kpis.completed}
          subtitle={`${kpis.openCount} abiertas`}
          icon={CheckCircle}
          tone="emerald"
          onClick={() => navigate("/work-orders")}
        />
        <StatCard title="MTTR" value={formatMinutes(kpis.mttr)} subtitle="tiempo reparacion" icon={Clock} tone="amber" />
        <StatCard title="MTBF" value={`${kpis.mtbf ? kpis.mtbf.toFixed(1) : 0}h`} subtitle="entre fallos" icon={TrendingUp} tone="violet" />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard title="OTs por tipo">
          <TypeBarChart counts={kpis.typeCounts} />
        </ChartCard>
        <ChartCard title="OTs por estado">
          <StatusDonut counts={kpis.statusCounts} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="card-surface overflow-hidden lg:col-span-2">
          <header className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-heading text-base font-bold text-navy">Ultimas ordenes de trabajo</h2>
            <Link to="/work-orders" className="text-sm font-medium text-brand-600 hover:underline">
              Ver todas
            </Link>
          </header>
          {latest.length === 0 ? (
            <p className="px-5 py-8 text-sm text-mutedText">Todavía no hay órdenes de trabajo.</p>
          ) : (
            <ul className="divide-y divide-line/70">
              {latest.map((wo) => (
                <li key={wo.id}>
                  <Link to={`/work-orders/${wo.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-cream">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-navy">{wo.title}</span>
                      <span className="mt-0.5 block truncate font-mono text-xs text-mutedText">
                        {wo.code} - {assetsById[wo.asset_id]?.name || "Sin activo"}
                      </span>
                    </span>
                    <StatusBadge value={wo.status} />
                    <span className="hidden shrink-0 text-xs text-mutedText sm:block">
                      {formatDate(wo.scheduled_at || wo.created_date)}
                    </span>
                    <ChevronRight size={15} className="shrink-0 text-mutedText" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-surface overflow-hidden">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
            <h2 className="font-heading text-base font-bold text-navy">Stock bajo minimo</h2>
            {lowStock.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                {lowStock.length}
              </span>
            )}
          </header>
          {lowStock.length === 0 ? (
            <div className="flex flex-col items-center px-5 py-10 text-center">
              <Boxes className="mb-3 text-emerald-500" size={30} aria-hidden="true" />
              <p className="text-sm font-medium text-navy">Stock OK</p>
              <p className="mt-1 text-xs text-mutedText">Ningún repuesto por debajo del mínimo.</p>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-line/70">
                {lowStock.slice(0, 6).map((part) => (
                  <li key={part.id}>
                    <Link to={`/inventory/${part.id}`} className="flex items-center gap-2 px-5 py-3 transition-colors hover:bg-cream">
                      <AlertTriangle size={15} className="shrink-0 text-red-600" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-navy">{part.name}</span>
                        <span className="block font-mono text-[11px] text-mutedText">{part.code}</span>
                      </span>
                      <span className="shrink-0 text-sm font-bold text-red-600">
                        {part.stock_current ?? 0} / min {part.stock_minimum ?? 0} {unitLabel(part.unit).toLowerCase()}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {can.viewInventory(user) && (
                <div className="border-t border-line px-5 py-3">
                  <button type="button" className="btn-secondary w-full justify-center" onClick={exportInventory}>
                    <FileDown size={15} aria-hidden="true" />
                    Exportar stock bajo
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}