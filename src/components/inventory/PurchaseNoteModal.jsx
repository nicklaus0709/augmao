import React, { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { exportPurchaseNoteDocx } from "@/lib/exports/docx";
import { unitLabel } from "@/components/common/Badges";
import { formatDate } from "@/lib/format";

function suggestedQuantity(part) {
  const current = Number(part.stock_current || 0);
  const minimum = Number(part.stock_minimum || 0);
  if (part.stock_maximum) return Math.max(1, Number(part.stock_maximum) - current);
  return Math.max(1, Math.max(minimum * 2 - current, minimum));
}

export default function PurchaseNoteModal({ open, onOpenChange, part, userName }) {
  const [supplier, setSupplier] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setSupplier(part.supplier || "");
    setQuantity(String(suggestedQuantity(part)));
    setNotes("");
    setError("");
  }, [open, part]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    const qty = Number(quantity);
    if (!qty || qty <= 0 || !Number.isInteger(qty)) {
      setError("La cantidad tiene que ser un número entero mayor a 0");
      return;
    }
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    const number = `NP-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;

    exportPurchaseNoteDocx({
      part: { ...part, unit_label: unitLabel(part.unit) },
      quantity: qty,
      supplier,
      notes,
      userName,
      number,
      date: formatDate(now),
      filename: `Nota-de-pedido-${part.code}-${number}.docx`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">Nota de pedido</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <p className="rounded-xl bg-brand-50 px-3 py-2 text-xs text-navy">
            Se genera un documento Word con los datos de {part.code} - {part.name} listo para enviar al proveedor.
          </p>

          <div>
            <label className="field-label" htmlFor="note-supplier">Proveedor</label>
            <input id="note-supplier" className="field-input" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          </div>

          <div>
            <label className="field-label" htmlFor="note-qty">Cantidad a pedir *</label>
            <input
              id="note-qty"
              type="number"
              min="1"
              step="1"
              className="field-input"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-mutedText">
              Sugerida según el stock actual ({part.stock_current ?? 0}) y el mínimo ({part.stock_minimum ?? 0})
            </p>
          </div>

          <div>
            <label className="field-label" htmlFor="note-notes">Observaciones</label>
            <textarea id="note-notes" rows={3} className="field-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <DialogFooter className="gap-2">
            <button type="button" className="btn-secondary" onClick={() => onOpenChange(false)}>Cancelar</button>
            <button type="submit" className="btn-primary">
              <FileText size={16} aria-hidden="true" />
              Descargar .docx
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}