import React, { useEffect, useState } from "react";
import { Loader2, Receipt, Truck, X } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { MAX_FILE_SIZE, RECEIPT_TYPES } from "@/lib/constants";

function FilePicker({ label, icon: Icon, file, onPick, onClear }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-navy">
          <Icon size={15} className="text-brand-600" aria-hidden="true" />
          {label}
        </span>
        <label className="btn-secondary cursor-pointer px-3 py-1 text-xs">
          Elegir archivo
          <input
            type="file"
            className="hidden"
            accept="application/pdf,image/*"
            aria-label={label}
            onChange={(event) => onPick(event.target.files?.[0] || null, event)}
          />
        </label>
      </div>
      {file && (
        <p className="mt-2 flex items-center gap-2 text-xs text-mutedText">
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          <button type="button" onClick={onClear} aria-label={`Quitar ${label}`} className="btn-icon h-6 w-6">
            <X size={13} />
          </button>
        </p>
      )}
    </div>
  );
}

export default function AdjustStockModal({ open, onOpenChange, part, onSaved }) {
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [invoice, setInvoice] = useState(null);
  const [deliveryNote, setDeliveryNote] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setQuantity("");
      setReason("");
      setInvoice(null);
      setDeliveryNote(null);
      setError("");
    }
  }, [open]);

  const pick = (setter) => (file, event) => {
    setError("");
    if (event) event.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setError("El archivo supera los 10 MB");
      return;
    }
    if (!RECEIPT_TYPES.includes(file.type)) {
      setError("Los comprobantes tienen que ser PDF o imagen");
      return;
    }
    setter(file);
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    const qty = Number(quantity);
    if (!qty || Number.isNaN(qty)) {
      setError("Ingresá una cantidad distinta de 0");
      return;
    }
    setSaving(true);
    try {
      const response = await base44.functions.invoke("adjustStock", {
        spare_part_id: part.id,
        quantity: qty,
        reason,
      });
      if (response.data?.error) {
        setError(response.data.error);
        return;
      }

      const failed = [];
      const uploads = [];
      if (invoice) uploads.push({ file: invoice, kind: "INVOICE" });
      if (deliveryNote) uploads.push({ file: deliveryNote, kind: "DELIVERY_NOTE" });

      for (const item of uploads) {
        try {
          const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file: item.file });
          await base44.entities.StockMovementAttachment.create({
            movement_id: response.data.movement_id,
            kind: item.kind,
            file_name: item.file.name,
            file_uri,
            file_type: item.file.type,
            size_bytes: item.file.size,
          });
        } catch (e) {
          failed.push(item.kind);
        }
      }

      onOpenChange(false);
      onSaved({ failed });
    } catch (e) {
      setError(e.response?.data?.error || "No se pudo ajustar el stock");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">Ajustar stock</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <p className="rounded-xl bg-brand-50 px-3 py-2 text-xs text-navy">
            Stock actual: {part.stock_current ?? 0}. Ingresa un numero positivo para entrada o negativo para salida.
          </p>

          <div>
            <label className="field-label" htmlFor="adjust-qty">Cantidad *</label>
            <input
              id="adjust-qty"
              type="number"
              className="field-input"
              placeholder="Ej: 5 o -2"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="field-label" htmlFor="adjust-reason">Razón</label>
            <input
              id="adjust-reason"
              className="field-input"
              placeholder="Ej: Compra a proveedor"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <p className="stat-title">Comprobantes de la compra</p>
            <FilePicker label="Factura" icon={Receipt} file={invoice} onPick={pick(setInvoice)} onClear={() => setInvoice(null)} />
            <FilePicker label="Remito" icon={Truck} file={deliveryNote} onPick={pick(setDeliveryNote)} onClear={() => setDeliveryNote(null)} />
          </div>

          <DialogFooter className="gap-2">
            <button type="button" className="btn-secondary" onClick={() => onOpenChange(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar ajuste
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}