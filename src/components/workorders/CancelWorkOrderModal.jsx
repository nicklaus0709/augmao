import React, { useEffect, useState } from "react";
import { Loader2, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { callFunction } from "@/api/data";

export default function CancelWorkOrderModal({ open, onOpenChange, workOrder, onCancelled }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setReason("");
      setError("");
    }
  }, [open]);

  const submit = async (event) => {
    event.preventDefault();
    if (!reason.trim()) {
      setError("Indicá el motivo de la cancelación");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await callFunction(
        "updateWorkOrderStatus",
        { work_order_id: workOrder.id, action: "cancel", reason: reason.trim() },
        "No se pudo cancelar la OT"
      );
      onOpenChange(false);
      onCancelled();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Cancelar orden de trabajo</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <p className="text-sm text-mutedText">
            La OT {workOrder?.code} queda cancelada y no descuenta repuestos. Esta acción no se puede deshacer.
          </p>
          <div>
            <label className="field-label" htmlFor="cancel-reason">Motivo *</label>
            <textarea
              id="cancel-reason"
              className="field-input min-h-[90px]"
              maxLength={1000}
              placeholder="Ej: OT duplicada, el equipo se dio de baja"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <button type="button" className="btn-secondary" onClick={() => onOpenChange(false)}>Volver</button>
            <button type="submit" className="btn-primary bg-red-600 hover:bg-red-700" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle size={16} aria-hidden="true" />}
              Cancelar OT
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
