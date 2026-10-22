import React, { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { callFunction } from "@/api/data";
import { unitLabel } from "@/components/common/Badges";

export default function AddPartModal({ open, onOpenChange, workOrder, parts, onSaved }) {
  const [sparePartId, setSparePartId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setSparePartId("");
      setQuantity("1");
      setError("");
    }
  }, [open]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    const qty = Number(quantity);
    if (!sparePartId) {
      setError("Elegí un repuesto");
      return;
    }
    if (!qty || qty <= 0) {
      setError("La cantidad tiene que ser mayor a 0");
      return;
    }
    const spare = parts.find((p) => p.id === sparePartId);
    if (!spare) return;

    setSaving(true);
    try {
      await callFunction(
        "workOrderParts",
        { action: "upsert", work_order_id: workOrder.id, spare_part_id: sparePartId, quantity: qty },
        "No se pudo cargar el repuesto"
      );
      onOpenChange(false);
      onSaved();
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
          <DialogTitle className="font-heading">Agregar repuesto</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <p className="rounded-xl bg-brand-50 px-3 py-2 text-xs text-navy">
            El stock se descuenta automáticamente cuando se cierra la OT.
          </p>
          <div>
            <label className="field-label" htmlFor="part-select">Repuesto</label>
            <select id="part-select" className="field-input" value={sparePartId} onChange={(e) => setSparePartId(e.target.value)}>
              <option value="">Elegí un repuesto</option>
              {parts.map((part) => (
                <option key={part.id} value={part.id}>
                  {part.code} - {part.name} ({unitLabel(part.unit)} · stock {part.stock_current ?? 0})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="part-qty">Cantidad</label>
            <input
              id="part-qty"
              type="number"
              min="1"
              className="field-input"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <button type="button" className="btn-secondary" onClick={() => onOpenChange(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus size={16} aria-hidden="true" />}
              Agregar
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}