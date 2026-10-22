import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Calendar, AlertTriangle, Plus, Play, Pause, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import useReferenceData from "@/hooks/useReferenceData";
import PageHeader from "@/components/common/PageHeader";
import StatCard from "@/components/common/StatCard";
import { LoadingBlock } from "@/components/common/EmptyState";
import NewPlanModal from "@/components/maintenance/NewPlanModal";
import { frequencyText } from "@/lib/constants";
import { can } from "@/lib/permissions";
import { formatDate, formatMinutes } from "@/lib/format";
import { cn } from "@/lib/utils";

const DAY = 86400000;

export default function Maintenance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { assets, users, loading: loadingRefs } = useReferenceData();

  const [plans, setPlans] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCard, setFilterCard] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [plansResult, woResult] = await Promise.all([
        base44.entities.MaintenancePlan.filter({}, { sort: "next_run_at", limit: 300 }),
        base44.entities.WorkOrder.filter({}, { sort: "-created_date", limit: 500 }),
      ]);
      setPlans(plansResult.items || []);
      setWorkOrders(woResult.items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const assetsById = useMemo(() => Object.fromEntries(assets.map((asset) => [asset.id, asset])), [assets]);

  const groups = useMemo(() => {
    const now = Date.now();
    const active = plans.filter((plan) => plan.active !== false);
    return {
      active,
      upcoming: active.filter((plan) => {
        if (!plan.next_run_at) return false;
        const time = new Date(plan.next_run_at).getTime();
        return time >= now && time <= now + 7 * DAY;
      }),
      overdue: active.filter((plan) => plan.next_run_at && new Date(plan.next_run_at).getTime() < now),
    };
  }, [plans]);

  const visiblePlans = useMemo(() => {
    if (filterCard === "active") return groups.active;
    if (filterCard === "upcoming") return groups.upcoming;
    if (filterCard === "overdue") return groups.overdue;
    return plans;
  }, [filterCard, groups, plans]);

  const listTitle = filterCard
    ? `${filterCard === "active" ? "Planes activos" : filterCard === "upcoming" ? "Proximos 7 dias" : "Vencidos"} (${visiblePlans.length})`
    : "Todos los planes";

  const next30 = useMemo(() => {
    const now = Date.now();
    return plans
      .filter((plan) => plan.active !== false && plan.next_run_at && new Date(plan.next_run_at).getTime() >= now)
      .filter((plan) => new Date(plan.next_run_at).getTime() <= now + 30 * DAY)
      .sort((a, b) => new Date(a.next_run_at) - new Date(b.next_run_at));
  }, [plans]);

  const generatedCount = useCallback(
    (planId) => workOrders.filter((wo) => wo.maintenance_plan_id === planId).length,
    [workOrders]
  );

  const runNow = async (plan) => {
    setBusyId(plan.id);
    try {
      const response = await base44.functions.invoke("runMaintenancePlan", { plan_id: plan.id });
      if (response.data?.error) {
        toast({ title: response.data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Orden generada", description: response.data.workOrder?.code });
      await load();
    } catch (e) {
      toast({ title: e.response?.data?.error || "No se pudo ejecutar el plan", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const togglePlan = async (plan) => {
    await base44.entities.MaintenancePlan.update(plan.id, { active: plan.active === false });
    await load();
  };

  const badgeFor = (plan) => {
    const now = Date.now();
    if (plan.active === false) return <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">Inactivo</span>;
    if (plan.next_run_at && new Date(plan.next_run_at).getTime() < now) {
      return <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Vencido</span>;
    }
    if (plan.next_run_at && new Date(plan.next_run_at).getTime() <= now + 7 * DAY) {
      return <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Próximo</span>;
    }
    return null;
  };

  if (loading || loadingRefs) {
    return <div className="card-surface"><LoadingBlock label="Cargando planes..." /></div>;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Preventivo"
        title="Planes de mantenimiento"
        subtitle="Programacion automatica de tareas preventivas"
        actions={
          can.managePlans(user) && (
            <button type="button" className="btn-primary" onClick={() => setModalOpen(true)}>
              <Plus size={16} aria-hidden="true" />
              Nuevo plan
            </button>
          )
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Planes activos"
          value={groups.active.length}
          icon={CheckCircle2}
          tone="emerald"
          onClick={() => setFilterCard(filterCard === "active" ? null : "active")}
          selected={filterCard === "active"}
        />
        <StatCard
          title="Proximos 7 dias"
          value={groups.upcoming.length}
          icon={Calendar}
          tone="amber"
          onClick={() => setFilterCard(filterCard === "upcoming" ? null : "upcoming")}
          selected={filterCard === "upcoming"}
        />
        <StatCard
          title="Vencidos"
          value={groups.overdue.length}
          icon={AlertTriangle}
          tone="red"
          onClick={() => setFilterCard(filterCard === "overdue" ? null : "overdue")}
          selected={filterCard === "overdue"}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="card-surface overflow-hidden lg:col-span-2">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
            <h2 className="font-heading text-base font-bold text-navy">{listTitle}</h2>
            {filterCard && (
              <button type="button" className="text-sm font-medium text-brand-600 hover:underline" onClick={() => setFilterCard(null)}>
                Ver todos los planes
              </button>
            )}
          </header>

          {visiblePlans.length === 0 ? (
            <p className="px-5 py-8 text-sm text-mutedText">
              {filterCard ? `No hay planes en "${filterCard === "active" ? "Planes activos" : filterCard === "upcoming" ? "Proximos 7 dias" : "Vencidos"}"` : "Todavía no hay planes de mantenimiento."}
            </p>
          ) : (
            <ul className="divide-y divide-line/70">
              {visiblePlans.map((plan) => (
                <li key={plan.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-navy">{plan.name}</p>
                        {badgeFor(plan)}
                      </div>
                      <p className="mt-1 text-xs text-mutedText">
                        {assetsById[plan.asset_id] ? `${assetsById[plan.asset_id].code} - ${assetsById[plan.asset_id].name}` : "Sin activo"} ·{" "}
                        {assetsById[plan.asset_id]?.location || "-"}
                      </p>
                      <p className="mt-1 text-xs text-mutedText">
                        {frequencyText(plan.frequency_type, plan.frequency_value)} · {formatMinutes(plan.estimated_minutes)} · Próxima:{" "}
                        {formatDate(plan.next_run_at)} · {generatedCount(plan.id)} OTs generadas
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={plan.active === false || busyId === plan.id}
                        onClick={() => runNow(plan)}
                      >
                        {busyId === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play size={15} aria-hidden="true" />}
                        Ejecutar ahora
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => togglePlan(plan)}>
                        {plan.active === false ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
                        {plan.active === false ? "Activar" : "Pausar"}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-surface overflow-hidden">
          <header className="border-b border-line px-5 py-4">
            <h2 className="font-heading text-base font-bold text-navy">Próximos 30 días</h2>
          </header>
          {next30.length === 0 ? (
            <p className="px-5 py-8 text-sm text-mutedText">Sin vencimientos en los próximos 30 días.</p>
          ) : (
            <ul className="divide-y divide-line/70">
              {next30.map((plan) => (
                <li key={plan.id} className="px-5 py-3">
                  <p className="text-sm font-medium text-navy">{plan.name}</p>
                  <p className="mt-0.5 text-xs text-mutedText">
                    {assetsById[plan.asset_id]?.code || "-"} · {formatDate(plan.next_run_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="mt-5 text-xs text-mutedText">
        Las tareas vencidas generan su OT automáticamente todos los días a las 06:00, según la frecuencia de cada plan.
      </p>

      <NewPlanModal open={modalOpen} onOpenChange={setModalOpen} assets={assets} users={users} onSaved={load} />
    </div>
  );
}