import React, { useEffect, useState } from "react";
import { Loader2, Paperclip } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { MAX_FILE_SIZE, MOVEMENT_KIND, RECEIPT_TYPES } from "@/lib/constants";

export default function AttachReceiptModal({ open, onOpenChange, movement, onSaved }) {
  const [kind, setKind] = useState("INVOICE");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setKind("INVOICE");
      setFile(null);
      setError("");
    }
  }, [open]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!file) {
      setError("Elegí un archivo");
      return;
    }
    setSaving(true);
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      await base44.entities.StockMovementAttachment.create({
        movement_id: movement.id,
        kind,
        file_name: file.name,
        file_uri,
        file_type: file.type,
        size_bytes: file.size,
      });
      onOpenChange(false);
      onSaved();
    } catch (e) {
      setError("No se pudo subir el archivo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Adjuntar comprobante</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div>
            <label className="field-label" htmlFor="receipt-kind">Tipo</label>
            <select id="receipt-kind" className="field-input" value={kind} onChange={(e) => setKind(e.target.value)}>
              {Object.entries(MOVEMENT_KIND).map(([value, cfg]) => (
                <option key={value} value={value}>{cfg.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="receipt-file">Archivo</label>
            <input
              id="receipt-file"
              type="file"
              accept="application/pdf,image/*"
              className="field-input"
              onChange={(event) => {
                const selected = event.target.files?.[0] || null;
                setError("");
                if (selected && selected.size > MAX_FILE_SIZE) {
                  setError("El archivo supera los 10 MB");
                  return;
                }
                if (selected && !RECEIPT_TYPES.includes(selected.type)) {
                  setError("El comprobante tiene que ser PDF o imagen");
                  return;
                }
                setFile(selected);
              }}
            />
          </div>
          <DialogFooter className="gap-2">
            <button type="button" className="btn-secondary" onClick={() => onOpenChange(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip size={16} aria-hidden="true" />}
              Adjuntar
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}