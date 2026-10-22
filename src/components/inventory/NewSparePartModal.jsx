import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { callFunction } from "@/api/data";
import { PART_UNIT } from "@/lib/constants";

const EMPTY = {
  code: "",
  name: "",
  unit: "unit",
  stock_current: "0",
  stock_minimum: "1",
  unit_cost: "",
  location: "",
  supplier: "",
};

export default function NewSparePartModal({ open, onOpenChange, part, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm(
      part
        ? {
            code: part.code || "",
            name: part.name || "",
            unit: part.unit || "unit",
            stock_current: String(part.stock_current ?? 0),
            stock_minimum: String(part.stock_minimum ?? 1),
            unit_cost: part.unit_cost === null || part.unit_cost === undefined ? "" : String(part.unit_cost),
            location: part.location || "",
            supplier: part.supplier || "",
          }
        : EMPTY
    );
  }, [open, part]);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.code.trim() || !form.name.trim()) {
      setError("Completá código y nombre");
      return;
    }
    if (Number(form.stock_current) < 0) {
      setError("El stock actual no puede ser negativo");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        unit: form.unit,
        stock_current: Number(form.stock_current) || 0,
        stock_minimum: Number(form.stock_minimum) || 0,
        unit_cost: form.unit_cost === "" ? null : Number(Number(form.unit_cost).toFixed(2)),
        location: form.location.trim(),
        supplier: form.supplier.trim(),
      };

      // El stock de un repuesto existente solo cambia con "Ajustar stock" (queda el movimiento).
      if (part) delete payload.stock_current;
      await callFunction(
        "manageCatalog",
        part
          ? { entity: "SparePart", action: "update", id: part.id, data: payload }
          : { entity: "SparePart", action: "create", data: payload },
        "No se pudo guardar el repuesto"
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-heading">{part ? "Editar repuesto" : "Nuevo repuesto"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="part-code">Código *</label>
              <input id="part-code" className="field-input field-mono" placeholder="REP-0006" value={form.code} onChange={set("code")} required />
            </div>
            <div>
              <label className="field-label" htmlFor="part-name">Nombre *</label>
              <input id="part-name" className="field-input" value={form.name} onChange={set("name")} required />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="field-label" htmlFor="part-unit">Unidad</label>
              <select id="part-unit" className="field-input" value={form.unit} onChange={set("unit")}>
                {Object.entries(PART_UNIT).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="part-stock">Stock actual *</label>
              <input id="part-stock" type="number" min="0" className="field-input" value={form.stock_current} onChange={set("stock_current")} required />
            </div>
            <div>
              <label className="field-label" htmlFor="part-min">Stock mínimo *</label>
              <input id="part-min" type="number" min="0" className="field-input" value={form.stock_minimum} onChange={set("stock_minimum")} required />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="field-label" htmlFor="part-cost">Costo unitario</label>
              <input id="part-cost" type="number" step="0.01" min="0" className="field-input" value={form.unit_cost} onChange={set("unit_cost")} />
            </div>
            <div>
              <label className="field-label" htmlFor="part-location">Ubicación</label>
              <input id="part-location" className="field-input" placeholder="Almacén A - Estante 3" value={form.location} onChange={set("location")} />
            </div>
            <div>
              <label className="field-label" htmlFor="part-supplier">Proveedor</label>
              <input id="part-supplier" className="field-input" value={form.supplier} onChange={set("supplier")} />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <button type="button" className="btn-secondary" onClick={() => onOpenChange(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {part ? "Guardar cambios" : "Crear repuesto"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}