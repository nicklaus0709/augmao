import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, FileDown, UserPlus, Play, Pause, CheckCircle2, Plus, Package, SearchX, XCircle, X,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { callFunction, fetchAll } from "@/api/data";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import PageHeader from "@/components/common/PageHeader";
import { LoadingBlock } from "@/components/common/EmptyState";
import { StatusBadge, PriorityBadge, TypeBadge, unitLabel } from "@/components/common/Badges";
import AttachmentPanel from "@/components/common/AttachmentPanel";
import CloseWorkOrderModal from "@/components/workorders/CloseWorkOrderModal";
import AssignTechnicianModal from "@/components/workorders/AssignTechnicianModal";
import AddPartModal from "@/components/workorders/AddPartModal";
import CommentsPanel from "@/components/workorders/CommentsPanel";
import CancelWorkOrderModal from "@/components/workorders/CancelWorkOrderModal";
import AuditTrail from "@/components/common/AuditTrail";
import { exportWorkOrderPdf } from "@/lib/exports/pdf";
import { can, canOperateWorkOrder } from "@/lib/permissions";
import { WO_TYPE } from "@/lib/constants";
import { formatDateTime, formatMinutes, formatMoney } from "@/lib/format";

const CLOSED = ["COMPLETED", "CANCELLED"];

function DetailRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/70 py-2 last:border-0">
      <span className="text-xs uppercase tracking-wide text-mutedText">{label}</span>
      <span className="text-right text-sm font-medium text-navy">{value || "-"}</span>
    </div>
  );
}

export default function WorkOrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [workOrder, setWorkOrder] = useState(null);
  const [asset, setAsset] = useState(null);
  const [usedParts, setUsedParts] = useState([]);
  const [spareParts, setSpareParts] = useState([]);
  const [comments, setComments] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [partOpen, setPartOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const loadComments = useCallback(async () => {
    const result = await fetchAll("WorkOrderComment", { work_order_id: id }, { sort: "created_date" });
    setComments(result.items || []);
  }, [id]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let record = null;
      try {
        record = await base44.entities.WorkOrder.get(id);
      } catch (e) {
        record = null;
      }
      if (!record) {
        setMissing(true);
        return;
      }
      setWorkOrder(record);

      const [assetRecord, partsResult, sparesResult, teamResponse] = await Promise.all([
        record.asset_id ? base44.entities.Asset.get(record.asset_id).catch(() => null) : Promise.resolve(null),
        base44.entities.WorkOrderPart.filter({ work_order_id: record.id }, { limit: 200 }),
        fetchAll("SparePart", {}, { sort: "code" }),
        base44.functions.invoke("manageUsers", { action: "list" }).catch(() => ({ data: { users: [] } })),
      ]);
      setAsset(assetRecord);
      setUsedParts(partsResult.items || []);
      setSpareParts(sparesResult.items || []);
      setTeam(teamResponse.data?.users || []);
      await loadComments();
    } finally {
      setLoading(false);
    }
  }, [id, loadComments]);

  useEffect(() => {
    load();
  }, [load]);

  const sparesById = Object.fromEntries(spareParts.map((part) => [part.id, part]));

  const changeStatus = async (action) => {
    setBusy(true);
    try {
      await callFunction("updateWorkOrderStatus", { work_order_id: workOrder.id, action }, "No se pudo actualizar la OT");
      await load();
    } catch (e) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const removePart = async (part) => {
    setBusy(true);
    try {
      await callFunction("workOrderParts", { action: "remove", work_order_id: workOrder.id, part_id: part.id }, "No se pudo quitar el repuesto");
      await load();
    } catch (e) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const exportPdf = () => {
    exportWorkOrderPdf({
      workOrder: { ...workOrder, created_by: workOrder.created_by_name || workOrder.created_by || "-", assigned_to_name: workOrder.assigned_to_name || "-" },
      asset,
      parts: usedParts.map((part) => ({
        name: sparesById[part.spare_part_id]?.name || "-",
        code: sparesById[part.spare_part_id]?.code || "-",
        quantity_used: part.quantity_used,
        unit_label: unitLabel(sparesById[part.spare_part_id]?.unit),
        unit_cost: part.unit_cost,
      })),
      comments,
      userName: user?.full_name || user?.email,
      filename: `${workOrder.code}.pdf`,
    });
  };

  if (missing) {
    return (
      <div className="card-surface">
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <SearchX className="mb-4 text-slate-300" size={34} aria-hidden="true" />
          <h1 className="font-heading text-xl font-bold text-navy">Orden de trabajo no encontrada</h1>
          <p className="mt-2 text-sm text-mutedText">Puede que se haya eliminado o que el enlace sea incorrecto.</p>
          <Link to="/work-orders" className="btn-secondary mt-6">
            <ArrowLeft size={16} aria-hidden="true" />
            Volver a la lista
          </Link>
        </div>
      </div>
    );
  }

  if (loading || !workOrder) {
    return (
      <div className="card-surface">
        <LoadingBlock label="Cargando orden de trabajo..." />
      </div>
    );
  }

  const closed = CLOSED.includes(workOrder.status);
  const canStart = ["OPEN", "ASSIGNED", "ON_HOLD"].includes(workOrder.status);
  const isOnHold = workOrder.status === "ON_HOLD";
  const canOperate = canOperateWorkOrder(user, workOrder);
  const technicianName =
    workOrder.assigned_to_name ||
    team.find((member) => member.id === workOrder.assigned_to_id)?.full_name ||
    null;

  return (
    <div>
      <button type="button" className="btn-ghost mb-4 -ml-3" onClick={() => navigate("/work-orders")}>
        <ArrowLeft size={16} aria-hidden="true" />
        Volver
      </button>

      <PageHeader
        eyebrow="Orden de trabajo"
        title={workOrder.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-brand-600">{workOrder.code}</span>
            <span>
              {WO_TYPE[workOrder.type]?.label || "-"} · {asset ? `${asset.code} - ${asset.name}` : "-"} · {asset?.location || "-"}
            </span>
          </span>
        }
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={exportPdf}>
              <FileDown size={16} aria-hidden="true" />
              Exportar PDF
            </button>
            {can.assignTechnician(user) && !closed && (
              <button type="button" className="btn-secondary" onClick={() => setAssignOpen(true)}>
                <UserPlus size={16} aria-hidden="true" />
                {workOrder.assigned_to_id ? "Reasignar" : "Asignar"}
              </button>
            )}
            {canOperate && canStart && (
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => changeStatus("start")}>
                <Play size={16} aria-hidden="true" />
                {isOnHold ? "Reanudar" : "Iniciar"}
              </button>
            )}
            {canOperate && workOrder.status === "IN_PROGRESS" && (
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => changeStatus("pause")}>
                <Pause size={16} aria-hidden="true" />
                Pausar
              </button>
            )}
            {can.cancelWorkOrder(user) && !closed && (
              <button type="button" className="btn-secondary text-red-600" onClick={() => setCancelOpen(true)}>
                <XCircle size={16} aria-hidden="true" />
                Cancelar
              </button>
            )}
            {canOperate && !closed && (
              <button type="button" className="btn-primary" onClick={() => setCloseOpen(true)}>
                <CheckCircle2 size={16} aria-hidden="true" />
                Cerrar OT
              </button>
            )}
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm text-brand-600">{workOrder.code}</span>
        <StatusBadge value={workOrder.status} />
        <PriorityBadge value={workOrder.priority} />
        <TypeBadge value={workOrder.type} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className="card-surface p-5">
            <h2 className="mb-3 font-heading text-base font-bold text-navy">Descripción</h2>
            <p className="whitespace-pre-wrap break-words text-sm text-navy/90">
              {workOrder.description?.trim() || "Sin descripción."}
            </p>
          </section>

          <section className="card-surface p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-heading text-base font-bold text-navy">
                <Package size={17} className="text-brand-600" aria-hidden="true" />
                Repuestos utilizados
              </h2>
              {canOperate && !closed && (
                <button type="button" className="btn-secondary" onClick={() => setPartOpen(true)}>
                  <Plus size={15} aria-hidden="true" />
                  Agregar repuesto
                </button>
              )}
            </div>

            {usedParts.length === 0 ? (
              <p className="py-3 text-sm text-mutedText">Sin repuestos cargados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="table-head py-2 text-left">Repuesto</th>
                      <th className="table-head py-2 text-right">Cantidad</th>
                      <th className="table-head py-2 text-right">Costo</th>
                      {canOperate && !closed && <th className="table-head py-2" aria-label="Acciones" />}
                    </tr>
                  </thead>
                  <tbody>
                    {usedParts.map((part) => {
                      const spare = sparesById[part.spare_part_id];
                      const total = Number(part.unit_cost || 0) * Number(part.quantity_used || 0);
                      return (
                        <tr key={part.id} className="border-b border-line/70 last:border-0">
                          <td className="py-2.5 text-navy">
                            {spare ? `${spare.code} - ${spare.name}` : "Repuesto eliminado"}
                          </td>
                          <td className="py-2.5 text-right text-navy">
                            {part.quantity_used} {unitLabel(spare?.unit)}
                          </td>
                          <td className="py-2.5 text-right text-navy">{total ? formatMoney(total) : "-"}</td>
                          {canOperate && !closed && (
                            <td className="py-2.5 text-right">
                              <button
                                type="button"
                                className="btn-icon h-7 w-7 text-red-500 hover:bg-red-50"
                                aria-label={`Quitar ${spare?.name || "repuesto"}`}
                                disabled={busy}
                                onClick={() => removePart(part)}
                              >
                                <X size={14} />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <CommentsPanel workOrderId={workOrder.id} user={user} />
        </div>

        <div className="space-y-5">
          <section className="card-surface p-5">
            <h2 className="mb-3 font-heading text-base font-bold text-navy">Detalles</h2>
            <DetailRow label="Técnico asignado" value={technicianName || "Sin asignar"} />
            <DetailRow label="Creada por" value={workOrder.created_by_name || workOrder.created_by || "-"} />
            <DetailRow label="Programada" value={workOrder.scheduled_at ? formatDateTime(workOrder.scheduled_at) : "-"} />
            <DetailRow label="Iniciada" value={workOrder.started_at ? formatDateTime(workOrder.started_at) : "-"} />
            <DetailRow label="Completada" value={workOrder.completed_at ? formatDateTime(workOrder.completed_at) : "-"} />
            <DetailRow label="Tiempo estimado" value={formatMinutes(workOrder.estimated_minutes)} />
            <DetailRow label="Tiempo real" value={formatMinutes(workOrder.actual_minutes)} />
          </section>

          {workOrder.status === "CANCELLED" && (
            <section className="card-surface p-5">
              <h2 className="mb-3 font-heading text-base font-bold text-navy">Cancelación</h2>
              <p className="whitespace-pre-wrap break-words text-sm text-navy/90">{workOrder.cancel_reason || "-"}</p>
              {workOrder.cancelled_at && (
                <p className="mt-2 text-xs text-mutedText">{formatDateTime(workOrder.cancelled_at)}</p>
              )}
            </section>
          )}

          {(workOrder.closing_notes || workOrder.failure_cause) && (
            <section className="card-surface p-5">
              <h2 className="mb-3 font-heading text-base font-bold text-navy">Notas de cierre</h2>
              {workOrder.failure_cause && (
                <p className="mb-3 text-sm">
                  <span className="font-medium text-red-600">Causa: </span>
                  <span className="text-navy">{workOrder.failure_cause}</span>
                </p>
              )}
              <p className="whitespace-pre-wrap break-words text-sm text-navy/90">{workOrder.closing_notes || "-"}</p>
            </section>
          )}

          <AttachmentPanel
            entity="WorkOrderAttachment"
            field="work_order_id"
            recordId={workOrder.id}
            canUpload={can.uploadAttachments(user) && !closed}
            canDelete={can.deleteAttachments(user)}
          />

          {can.viewHistory(user) && <AuditTrail entity="WorkOrder" entityId={workOrder.id} />}
        </div>
      </div>

      {!closed && (
        <>
          <CloseWorkOrderModal
            open={closeOpen}
            onOpenChange={setCloseOpen}
            workOrder={workOrder}
            onClosed={(updated) => {
              setWorkOrder(updated);
              load();
            }}
          />
          <AssignTechnicianModal
            open={assignOpen}
            onOpenChange={setAssignOpen}
            workOrder={workOrder}
            users={team}
            onAssigned={load}
          />
          <CancelWorkOrderModal open={cancelOpen} onOpenChange={setCancelOpen} workOrder={workOrder} onCancelled={load} />
          <AddPartModal
            open={partOpen}
            onOpenChange={setPartOpen}
            workOrder={workOrder}
            parts={spareParts}
            onSaved={load}
          />
        </>
      )}
    </div>
  );
}