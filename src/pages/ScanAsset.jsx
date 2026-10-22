import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, RefreshCw, ScanLine, MapPin, Package, MessageSquare, Paperclip, SearchX, AlertTriangle,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { fetchAll } from "@/api/data";
import { useAuth } from "@/lib/AuthContext";
import { LoadingBlock } from "@/components/common/EmptyState";
import { StatusBadge, PriorityBadge, AssetStatusBadge, TypeBadge, unitLabel } from "@/components/common/Badges";
import AttachmentPanel from "@/components/common/AttachmentPanel";
import { can } from "@/lib/permissions";
import { frequencyText } from "@/lib/constants";
import { formatClock, formatDate, formatMinutes } from "@/lib/format";
import { cn } from "@/lib/utils";

const REFRESH_MS = 10000;

function Dot({ status }) {
  const color = status === "COMPLETED" ? "bg-emerald-500" : status === "CANCELLED" ? "bg-gray-400" : "bg-amber-500";
  return <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", color)} aria-hidden="true" />;
}

export default function ScanAsset() {
  const { id } = useParams();
  const { user } = useAuth();

  const [asset, setAsset] = useState(null);
  const [parent, setParent] = useState(null);
  const [children, setChildren] = useState([]);
  const [plans, setPlans] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [partsByWo, setPartsByWo] = useState({});
  const [spares, setSpares] = useState([]);
  const [counts, setCounts] = useState({});
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(new Date());

  const load = useCallback(
    async (background = false) => {
      if (background) setRefreshing(true);
      else setLoading(true);
      try {
        const record = await base44.entities.Asset.get(id).catch(() => null);
        if (!record) {
          setMissing(true);
          return;
        }
        setAsset(record);

        const [woResult, plansResult, sparesResult, childrenResult, parentRecord] = await Promise.all([
          fetchAll("WorkOrder", { asset_id: record.id }, { sort: "-created_date" }),
          base44.entities.MaintenancePlan.filter({ asset_id: record.id, active: true }, { limit: 100 }),
          fetchAll("SparePart", {}, { sort: "code" }),
          fetchAll("Asset", { parent_id: record.id }, { sort: "code" }),
          record.parent_id ? base44.entities.Asset.get(record.parent_id).catch(() => null) : Promise.resolve(null),
        ]);

        const orders = woResult.items || [];
        const ids = orders.map((wo) => wo.id);
        setWorkOrders(orders);
        setPlans(plansResult.items || []);
        setSpares(sparesResult.items || []);
        setChildren(childrenResult.items || []);
        setParent(parentRecord);

        if (ids.length) {
          const [partsResult, commentsResult, attachmentsResult] = await Promise.all([
            base44.entities.WorkOrderPart.filter({ work_order_id: { $in: ids } }, { limit: 1000 }),
            base44.entities.WorkOrderComment.filter({ work_order_id: { $in: ids } }, { limit: 1000 }),
            base44.entities.WorkOrderAttachment.filter({ work_order_id: { $in: ids } }, { limit: 1000 }),
          ]);
          const grouped = {};
          for (const part of partsResult.items || []) {
            if (!grouped[part.work_order_id]) grouped[part.work_order_id] = [];
            grouped[part.work_order_id].push(part);
          }
          setPartsByWo(grouped);

          const tally = {};
          for (const id of ids) tally[id] = { comments: 0, attachments: 0 };
          for (const comment of commentsResult.items || []) {
            if (tally[comment.work_order_id]) tally[comment.work_order_id].comments += 1;
          }
          for (const attachment of attachmentsResult.items || []) {
            if (tally[attachment.work_order_id]) tally[attachment.work_order_id].attachments += 1;
          }
          setCounts(tally);
        } else {
          setPartsByWo({});
          setCounts({});
        }

        setUpdatedAt(new Date());
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Historial en vivo: se actualiza solo cada 10 segundos y al volver a la pestaña.
  useEffect(() => {
    const interval = setInterval(() => load(true), REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") load(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const sparesById = useMemo(() => Object.fromEntries(spares.map((part) => [part.id, part])), [spares]);

  const indicators = useMemo(() => {
    const completed = workOrders.filter((wo) => wo.status === "COMPLETED");
    const minutes = completed.reduce((sum, wo) => sum + Number(wo.actual_minutes || 0), 0);
    return {
      total: workOrders.length,
      open: workOrders.filter((wo) => wo.status !== "COMPLETED" && wo.status !== "CANCELLED").length,
      corrective: completed.filter((wo) => wo.type === "CORRECTIVE").length,
      preventive: completed.filter((wo) => wo.type === "PREVENTIVE").length,
      mttr: completed.length ? minutes / completed.length : 0,
    };
  }, [workOrders]);

  const inProgress = workOrders.filter((wo) => wo.status !== "COMPLETED" && wo.status !== "CANCELLED");

  if (missing) {
    return (
      <div className="card-surface">
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <SearchX className="mb-4 text-slate-300" size={34} aria-hidden="true" />
          <h1 className="font-heading text-xl font-bold text-navy">Activo no encontrado</h1>
          <p className="mt-2 text-sm text-mutedText">El código QR puede estar desactualizado.</p>
          <Link to="/scan" className="btn-secondary mt-6">
            <ScanLine size={16} aria-hidden="true" />
            Escanear otro
          </Link>
        </div>
      </div>
    );
  }

  if (loading || !asset) {
    return (
      <div className="card-surface">
        <LoadingBlock label="Buscando activo..." />
      </div>
    );
  }

  const attributes = Object.entries(asset.attributes || {});

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link to="/scan" className="btn-secondary">
          <ArrowLeft size={16} aria-hidden="true" />
          Volver
        </Link>
        <button
          type="button"
          onClick={() => load(true)}
          className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-sm font-medium text-navy hover:border-brand-600"
          title="Actualizar ahora"
        >
          <span className="live-dot h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
          En vivo · {formatClock(updatedAt)}
          <RefreshCw size={14} className={refreshing ? "animate-spin text-brand-600" : "text-mutedText"} aria-hidden="true" />
        </button>
        <Link to="/scan" className="btn-secondary ml-auto">
          <ScanLine size={16} aria-hidden="true" />
          Escanear otro
        </Link>
      </div>

      <div className="card-surface mb-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-brand-600">{asset.code}</span>
              <AssetStatusBadge value={asset.status} />
            </div>
            <h1 className="mt-2 font-heading text-2xl font-bold text-navy">{asset.name}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-mutedText">
              <MapPin size={14} aria-hidden="true" />
              {asset.location}
            </p>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Fabricante", asset.manufacturer],
            ["Modelo", asset.model],
            ["N° de serie", asset.serial_number],
            ["Garantía", asset.warranty_expires ? formatDate(asset.warranty_expires) : null],
            ["Pertenece a", parent ? `${parent.code} - ${parent.name}` : null],
            ...attributes.map(([key, value]) => [key, String(value)]),
          ].map(([label, value]) => (
            <div key={label} className="border-b border-line/70 pb-2">
              <dt className="text-[11px] uppercase tracking-wide text-mutedText">{label}</dt>
              <dd className="text-sm font-medium text-navy">{value || "-"}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "OTs totales", value: indicators.total, tone: "text-navy" },
          { label: "Abiertas", value: indicators.open, tone: indicators.open ? "text-amber-600" : "text-navy" },
          { label: "Correctivas / Preventivas", value: `${indicators.corrective} / ${indicators.preventive}`, tone: "text-navy" },
          { label: "MTTR", value: formatMinutes(indicators.mttr), tone: "text-navy" },
        ].map((item) => (
          <div key={item.label} className="card-surface p-4">
            <p className="stat-title">{item.label}</p>
            <p className={cn("mt-2 font-heading text-2xl font-bold", item.tone)}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className="card-surface border-amber-200 p-5">
            <h2 className="mb-3 font-heading text-base font-bold text-navy">Trabajos en curso</h2>
            {inProgress.length === 0 ? (
              <p className="text-sm text-mutedText">No hay trabajos en curso.</p>
            ) : (
              <ul className="space-y-2">
                {inProgress.map((wo) => (
                  <li key={wo.id}>
                    <Link to={`/work-orders/${wo.id}`} className="block rounded-xl border border-line/70 px-3 py-2 transition-colors hover:bg-cream">
                      <p className="text-sm font-medium text-navy">{wo.title}</p>
                      <p className="mt-0.5 text-xs text-mutedText">
                        {wo.code} · {wo.assigned_to_name || "Sin asignar"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <StatusBadge value={wo.status} />
                        <PriorityBadge value={wo.priority} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card-surface p-5">
            <h2 className="mb-4 font-heading text-base font-bold text-navy">Historial de mantenimiento</h2>
            {workOrders.length === 0 ? (
              <p className="text-sm text-mutedText">Esta máquina todavía no tiene órdenes de trabajo</p>
            ) : (
              <ol className="relative space-y-4 border-l border-line pl-5">
                {workOrders.slice(0, 200).map((wo) => (
                  <li key={wo.id} className="relative">
                    <span className="absolute -left-[26px]"><Dot status={wo.status} /></span>
                    <Link to={`/work-orders/${wo.id}`} className="block rounded-xl px-2 py-1 transition-colors hover:bg-cream">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-brand-600">{wo.code}</span>
                        <TypeBadge value={wo.type} />
                        <StatusBadge value={wo.status} />
                      </div>
                      <p className="mt-1 text-sm font-medium text-navy">{wo.title}</p>
                      <p className="mt-0.5 text-xs text-mutedText">
                        {formatDate(wo.completed_at || wo.scheduled_at || wo.created_date)} · {wo.assigned_to_name || "Sin asignar"} ·{" "}
                        {formatMinutes(wo.actual_minutes)}
                      </p>
                      {wo.failure_cause && <p className="mt-1 text-xs text-red-600">Causa: {wo.failure_cause}</p>}
                      {wo.closing_notes && <p className="mt-1 whitespace-pre-wrap text-xs text-mutedText">{wo.closing_notes}</p>}
                      {partsByWo[wo.id]?.length > 0 && (
                        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-mutedText">
                          <Package size={13} aria-hidden="true" />
                          {partsByWo[wo.id]
                            .map((part) => {
                              const spare = sparesById[part.spare_part_id];
                              return `${part.quantity_used} ${unitLabel(spare?.unit)} ${spare?.name || "repuesto"}`;
                            })
                            .join(", ")}
                        </p>
                      )}
                      <p className="mt-1 flex items-center gap-3 text-[11px] text-mutedText">
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare size={12} aria-hidden="true" />
                          {counts[wo.id]?.comments || 0}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Paperclip size={12} aria-hidden="true" />
                          {counts[wo.id]?.attachments || 0}
                        </span>
                      </p>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section className="card-surface p-5">
            <h2 className="mb-3 font-heading text-base font-bold text-navy">Próximos mantenimientos</h2>
            {plans.length === 0 ? (
              <p className="text-sm text-mutedText">Sin planes activos.</p>
            ) : (
              <ul className="space-y-3">
                {plans.map((plan) => (
                  <li key={plan.id} className="border-b border-line/70 pb-3 last:border-0 last:pb-0">
                    <p className="text-sm font-medium text-navy">{plan.name}</p>
                    <p className="mt-0.5 text-xs text-mutedText">{frequencyText(plan.frequency_type, plan.frequency_value)}</p>
                    <p className="text-xs text-mutedText">próxima {formatDate(plan.next_run_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card-surface p-5">
            <h2 className="mb-3 font-heading text-base font-bold text-navy">Subcomponentes</h2>
            {children.length === 0 ? (
              <p className="text-sm text-mutedText">Sin subcomponentes.</p>
            ) : (
              <ul className="space-y-2">
                {children.map((child) => (
                  <li key={child.id}>
                    <Link
                      to={`/scan/asset/${child.id}`}
                      className="flex items-center justify-between gap-2 rounded-xl border border-line/70 px-3 py-2 text-sm transition-colors hover:bg-cream"
                    >
                      <span className="min-w-0">
                        <span className="block font-mono text-xs text-brand-600">{child.code}</span>
                        <span className="block truncate text-navy">{child.name}</span>
                      </span>
                      <AssetStatusBadge value={child.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <AttachmentPanel
            entity="AssetAttachment"
            field="asset_id"
            recordId={asset.id}
            canUpload={can.uploadAttachments(user)}
            canDelete={can.deleteAttachments(user)}
          />
        </div>
      </div>

      {indicators.open > 0 && (
        <p className="mt-5 flex items-center gap-2 text-xs text-amber-700">
          <AlertTriangle size={14} aria-hidden="true" />
          Hay {indicators.open} orden(es) de trabajo sin cerrar sobre este activo.
        </p>
      )}
    </div>
  );
}