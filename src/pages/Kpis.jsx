import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FileDown, TrendingUp, Clock, ClipboardList, Wrench, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { fetchAll } from "@/api/data";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import PageHeader from "@/components/common/PageHeader";
import StatCard from "@/components/common/StatCard";
import { LoadingBlock } from "@/components/common/EmptyState";
import { TypeBarChart, StatusDonut, ChartCard } from "@/components/common/Charts";
import { computeKpis, kpisByAsset, kpisByTechnician } from "@/lib/kpis";
import { exportKpisPdf } from "@/lib/exports/pdf";
import { formatMinutes } from "@/lib/format";
import { cn } from "@/lib/utils";

const PERIOD_DAYS = 90;

function AvailabilityBar({ value }) {
  const tone = value >= 90 ? "bg-emerald-500" : value >= 70 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-4">
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-line/70">
        <div className={cn("h-full rounded-full transition-all duration-500", tone)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      <span className="font-heading text-3xl font-bold text-navy">{value.toFixed(2)}%</span>
    </div>
  );
}

export default function Kpis() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [workOrders, setWorkOrders] = useState([]);
  const [parts, setParts] = useState([]);
  const [assets, setAssets] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [woResult, partsResult, assetsResult, teamResponse] = await Promise.all([
        fetchAll("WorkOrder", {}, { sort: "-created_date" }),
        fetchAll("SparePart", {}, { sort: "code" }),
        fetchAll("Asset", {}, { sort: "code" }),
        base44.functions.invoke("manageUsers", { action: "list" }).catch(() => ({ data: { users: [] } })),
      ]);
      setWorkOrders(woResult.items || []);
      setParts(partsResult.items || []);
      setAssets(assetsResult.items || []);
      setTeam(teamResponse.data?.users || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const kpis = useMemo(() => computeKpis(workOrders, PERIOD_DAYS), [workOrders]);
  const byAsset = useMemo(() => kpisByAsset(kpis.inPeriod, assets), [kpis, assets]);
  const byTechnician = useMemo(() => kpisByTechnician(kpis.inPeriod, team), [kpis, team]);
  const lowStock = useMemo(
    () => parts.filter((part) => Number(part.stock_current || 0) <= Number(part.stock_minimum || 0)).length,
    [parts]
  );

  const exportPdf = () => {
    try {
      exportKpisPdf({
        kpis,
        statusCounts: kpis.statusCounts,
        typeCounts: kpis.typeCounts,
        lowStockCount: lowStock,
        userName: user?.full_name || user?.email,
        filename: "Informe-KPIs-AuGmao.pdf",
      });
    } catch (e) {
      toast({ title: "No se pudo exportar el informe", variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="card-surface"><LoadingBlock label="Calculando indicadores..." /></div>;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Informes"
        title="KPIs e informes"
        subtitle="Indicadores clave de mantenimiento"
        actions={
          <button type="button" className="btn-primary" onClick={exportPdf}>
            <FileDown size={16} aria-hidden="true" />
            Exportar PDF
          </button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="MTBF" value={`${kpis.mtbf ? kpis.mtbf.toFixed(1) : 0}h`} subtitle="Tiempo entre fallos" icon={TrendingUp} tone="violet" />
        <StatCard title="MTTR" value={formatMinutes(kpis.mttr)} subtitle="Tiempo de reparacion" icon={Clock} tone="amber" />
        <StatCard title="Total OTs" value={kpis.total} subtitle="en el periodo" icon={ClipboardList} tone="brand" />
        <StatCard
          title="Tasa cierre"
          value={`${kpis.closureRate.toFixed(2)}%`}
          subtitle={`${kpis.completed} completadas`}
          icon={Wrench}
          tone="emerald"
        />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard title="OTs por tipo">
          <TypeBarChart counts={kpis.typeCounts} />
        </ChartCard>
        <ChartCard title="OTs por estado">
          <StatusDonut counts={kpis.statusCounts} />
        </ChartCard>
      </div>

      <section className="card-surface mb-5 p-5">
        <h2 className="mb-4 font-heading text-base font-bold text-navy">Disponibilidad del sistema</h2>
        <AvailabilityBar value={kpis.availability} />
        <p className="mt-3 text-xs text-mutedText">Calculado en base a MTBF y MTTR del periodo</p>
        {lowStock > 0 && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            <AlertTriangle size={14} aria-hidden="true" />
            {lowStock} repuesto(s) con stock por debajo del mínimo
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="card-surface overflow-hidden">
          <header className="border-b border-line px-5 py-4">
            <h2 className="font-heading text-base font-bold text-navy">Indicadores por activo</h2>
          </header>
          {byAsset.length === 0 ? (
            <p className="px-5 py-6 text-sm text-mutedText">Sin datos en el período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-line bg-cream/60">
                    <th className="table-head px-4 py-2.5 text-left">Activo</th>
                    <th className="table-head px-4 py-2.5 text-right">OTs</th>
                    <th className="table-head px-4 py-2.5 text-right">Compl.</th>
                    <th className="table-head px-4 py-2.5 text-right">Corr.</th>
                    <th className="table-head px-4 py-2.5 text-right">Prev.</th>
                    <th className="table-head px-4 py-2.5 text-right">MTTR</th>
                  </tr>
                </thead>
                <tbody>
                  {byAsset.map((row) => (
                    <tr key={row.id} className="border-b border-line/70">
                      <td className="px-4 py-2.5 text-navy">{row.name}</td>
                      <td className="px-4 py-2.5 text-right text-navy">{row.total}</td>
                      <td className="px-4 py-2.5 text-right text-navy">{row.completed}</td>
                      <td className="px-4 py-2.5 text-right text-navy">{row.corrective}</td>
                      <td className="px-4 py-2.5 text-right text-navy">{row.preventive}</td>
                      <td className="px-4 py-2.5 text-right text-navy">{formatMinutes(row.mttr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card-surface overflow-hidden">
          <header className="border-b border-line px-5 py-4">
            <h2 className="font-heading text-base font-bold text-navy">Indicadores por técnico</h2>
          </header>
          {byTechnician.length === 0 ? (
            <p className="px-5 py-6 text-sm text-mutedText">Sin datos en el período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-line bg-cream/60">
                    <th className="table-head px-4 py-2.5 text-left">Técnico</th>
                    <th className="table-head px-4 py-2.5 text-right">Asignadas</th>
                    <th className="table-head px-4 py-2.5 text-right">Completadas</th>
                    <th className="table-head px-4 py-2.5 text-right">Cierre</th>
                    <th className="table-head px-4 py-2.5 text-right">Prom. reparación</th>
                  </tr>
                </thead>
                <tbody>
                  {byTechnician.map((row) => (
                    <tr key={row.id} className="border-b border-line/70">
                      <td className="px-4 py-2.5 text-navy">{row.name}</td>
                      <td className="px-4 py-2.5 text-right text-navy">{row.assigned}</td>
                      <td className="px-4 py-2.5 text-right text-navy">{row.completed}</td>
                      <td className="px-4 py-2.5 text-right text-navy">{row.closureRate.toFixed(2)}%</td>
                      <td className="px-4 py-2.5 text-right text-navy">{formatMinutes(row.avgMinutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}