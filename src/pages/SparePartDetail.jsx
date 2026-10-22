import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileText, TrendingUp, TrendingDown, Paperclip, X, SearchX, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { callFunction } from "@/api/data";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import PageHeader from "@/components/common/PageHeader";
import { LoadingBlock } from "@/components/common/EmptyState";
import { unitLabel } from "@/components/common/Badges";
import AdjustStockModal from "@/components/inventory/AdjustStockModal";
import AttachReceiptModal from "@/components/inventory/AttachReceiptModal";
import PurchaseNoteModal from "@/components/inventory/PurchaseNoteModal";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import AuditTrail from "@/components/common/AuditTrail";
import { can } from "@/lib/permissions";
import { MOVEMENT_KIND } from "@/lib/constants";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

function InfoBox({ label, value, tone }) {
  return (
    <div className={cn("rounded-xl border border-line p-4", tone === "red" && "border-red-200 bg-red-50")}>
      <p className="stat-title">{label}</p>
      <p className={cn("mt-2 font-heading text-2xl font-bold", tone === "red" ? "text-red-600" : "text-navy")}>{value}</p>
      {tone === "red" && <p className="mt-1 text-xs font-medium text-red-600">Bajo mínimo</p>}
    </div>
  );
}

export default function SparePartDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();

  const [part, setPart] = useState(null);
  const [movements, setMovements] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [banner, setBanner] = useState("");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [attachFor, setAttachFor] = useState(null);
  const [pendingReceipt, setPendingReceipt] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const record = await base44.entities.SparePart.get(id).catch(() => null);
      if (!record) {
        setMissing(true);
        return;
      }
      setPart(record);
      const result = await base44.entities.StockMovement.filter({ spare_part_id: record.id }, { sort: "-created_date", limit: 20 });
      const list = result.items || [];
      setMovements(list);
      if (list.length) {
        const attachments = await base44.entities.StockMovementAttachment.filter(
          { movement_id: { $in: list.map((movement) => movement.id) } },
          { limit: 200 }
        );
        setReceipts(attachments.items || []);
      } else {
        setReceipts([]);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const receiptsByMovement = useMemo(() => {
    const grouped = {};
    for (const receipt of receipts) {
      if (!grouped[receipt.movement_id]) grouped[receipt.movement_id] = [];
      grouped[receipt.movement_id].push(receipt);
    }
    return grouped;
  }, [receipts]);

  const openReceipt = async (receipt) => {
    const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: receipt.file_uri });
    window.open(signed_url, "_blank", "noopener");
  };

  const removeReceipt = async (receipt) => {
    try {
      await callFunction("attachments", { action: "delete", target: "movement", id: receipt.id }, "No se pudo eliminar el comprobante");
      await loadAll();
    } catch (e) {
      toast({ title: e.message, variant: "destructive" });
    }
  };

  if (missing) {
    return (
      <div className="card-surface">
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <SearchX className="mb-4 text-slate-300" size={34} aria-hidden="true" />
          <h1 className="font-heading text-xl font-bold text-navy">Repuesto no encontrado</h1>
          <Link to="/inventory" className="btn-secondary mt-6">
            <ArrowLeft size={16} aria-hidden="true" /> Volver a inventario
          </Link>
        </div>
      </div>
    );
  }

  if (loading || !part) {
    return <div className="card-surface"><LoadingBlock label="Cargando repuesto..." /></div>;
  }

  const low = Number(part.stock_current || 0) <= Number(part.stock_minimum || 0);

  return (
    <div>
      <Link to="/inventory" className="btn-ghost mb-4 -ml-3">
        <ArrowLeft size={16} aria-hidden="true" /> Volver a inventario
      </Link>

      <PageHeader
        eyebrow={part.code}
        title={part.name}
        subtitle={`${unitLabel(part.unit)} · ${part.location || "sin ubicación"}`}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => setNoteOpen(true)}>
              <FileText size={16} aria-hidden="true" /> Nota de pedido
            </button>
            {can.adjustStock(user) && (
              <button type="button" className="btn-primary" onClick={() => setAdjustOpen(true)}>
                Ajustar stock
              </button>
            )}
          </>
        }
      />

      {banner && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p className="flex-1">Stock ajustado, pero no se pudo subir: {banner}. Podés adjuntarlo desde el historial.</p>
          <button type="button" onClick={() => setBanner("")} aria-label="Cerrar aviso" className="btn-icon h-6 w-6">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className="card-surface p-5">
            <h2 className="mb-4 font-heading text-base font-bold text-navy">Información del repuesto</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <InfoBox label="Stock actual" value={part.stock_current ?? 0} tone={low ? "red" : undefined} />
              <InfoBox label="Stock mínimo" value={part.stock_minimum ?? 0} />
              <InfoBox label="Costo unitario" value={formatMoney(part.unit_cost)} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <div className="border-b border-line/70 pb-2">
                <p className="text-[11px] uppercase tracking-wide text-mutedText">Proveedor</p>
                <p className="text-sm font-medium text-navy">{part.supplier || "-"}</p>
              </div>
              <div className="border-b border-line/70 pb-2">
                <p className="text-[11px] uppercase tracking-wide text-mutedText">Ubicación</p>
                <p className="text-sm font-medium text-navy">{part.location || "-"}</p>
              </div>
            </div>
          </section>

          <section className="card-surface overflow-hidden">
            <h2 className="border-b border-line px-5 py-4 font-heading text-base font-bold text-navy">Historial de movimientos</h2>
            {movements.length === 0 ? (
              <p className="px-5 py-6 text-sm text-mutedText">Sin movimientos registrados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead>
                    <tr className="border-b border-line bg-cream/60">
                      <th className="table-head px-4 py-2.5 text-left">Tipo</th>
                      <th className="table-head px-4 py-2.5 text-right">Cantidad</th>
                      <th className="table-head px-4 py-2.5 text-right">Stock resultante</th>
                      <th className="table-head px-4 py-2.5 text-left">Razón</th>
                      <th className="table-head px-4 py-2.5 text-left">Fecha</th>
                      <th className="table-head px-4 py-2.5 text-left">Usuario</th>
                      <th className="table-head px-4 py-2.5 text-left">Comprobantes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((movement) => {
                      const entry = movement.type === "ENTRY";
                      const chips = receiptsByMovement[movement.id] || [];
                      return (
                        <tr key={movement.id} className="border-b border-line/70">
                          <td className="px-4 py-3">
                            <span className={cn("inline-flex items-center gap-1.5 font-medium", entry ? "text-emerald-600" : "text-red-600")}>
                              {entry ? <TrendingUp size={15} aria-hidden="true" /> : <TrendingDown size={15} aria-hidden="true" />}
                              {entry ? "Entrada" : movement.type === "EXIT" ? "Salida" : "Ajuste"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-navy">{movement.quantity}</td>
                          <td className="px-4 py-3 text-right text-navy">{movement.stock_after}</td>
                          <td className="px-4 py-3 text-mutedText">{movement.reason || "-"}</td>
                          <td className="px-4 py-3 text-mutedText">{formatDate(movement.created_date)}</td>
                          <td className="px-4 py-3 text-mutedText">{movement.created_by || "-"}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {chips.map((receipt) => (
                                <span key={receipt.id} className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => openReceipt(receipt)}
                                    className={cn(
                                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                                      MOVEMENT_KIND[receipt.kind]?.chip
                                    )}
                                    title={receipt.file_name}
                                  >
                                    {MOVEMENT_KIND[receipt.kind]?.label || "Otro"}
                                  </button>
                                  {can.deleteAttachments(user) && (
                                    <button
                                      type="button"
                                      onClick={() => setPendingReceipt(receipt)}
                                      aria-label={`Eliminar ${receipt.file_name}`}
                                      className="btn-icon h-5 w-5 text-red-500"
                                    >
                                      <X size={12} />
                                    </button>
                                  )}
                                </span>
                              ))}
                              {can.uploadAttachments(user) && (
                                <button
                                  type="button"
                                  onClick={() => setAttachFor(movement)}
                                  aria-label="Adjuntar comprobante"
                                  title="Adjuntar comprobante"
                                  className="btn-icon h-6 w-6"
                                >
                                  <Paperclip size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section className="card-surface p-5">
            <h2 className="mb-3 font-heading text-base font-bold text-navy">Últimos movimientos</h2>
            {movements.length === 0 ? (
              <p className="text-sm text-mutedText">Sin movimientos.</p>
            ) : (
              <ul className="space-y-3">
                {movements.slice(0, 5).map((movement) => (
                  <li key={movement.id} className="border-b border-line/70 pb-2 last:border-0 last:pb-0">
                    <p className="text-sm text-navy">
                      {movement.type === "ENTRY" ? "+" : movement.type === "EXIT" ? "-" : "±"}
                      {movement.quantity} → {movement.stock_after}
                    </p>
                    <p className="text-xs text-mutedText">{movement.reason || "Ajuste"}
                      {movement.user_name ? ` · ${movement.user_name}` : ""} · {formatDateTime(movement.created_date)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {can.viewHistory(user) && <AuditTrail entity="SparePart" entityId={part.id} />}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingReceipt)}
        onOpenChange={(open) => !open && setPendingReceipt(null)}
        title={`¿Eliminar ${pendingReceipt?.file_name || "el comprobante"}?`}
        onConfirm={() => {
          const receipt = pendingReceipt;
          setPendingReceipt(null);
          removeReceipt(receipt);
        }}
      />
      <AdjustStockModal
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        part={part}
        onSaved={({ failed }) => {
          if (failed?.length) setBanner(failed.map((kind) => MOVEMENT_KIND[kind]?.label).join(", "));
          loadAll();
        }}
      />
      <PurchaseNoteModal open={noteOpen} onOpenChange={setNoteOpen} part={part} userName={user?.full_name || user?.email} />
      <AttachReceiptModal
        open={Boolean(attachFor)}
        onOpenChange={(value) => !value && setAttachFor(null)}
        movement={attachFor}
        onSaved={loadAll}
      />
    </div>
  );
}