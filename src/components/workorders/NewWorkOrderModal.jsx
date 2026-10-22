import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { WO_PRIORITY, WO_TYPE, options } from "@/lib/constants";
import { activeTechnicians } from "@/lib/permissions";

const EMPTY = {
  title: "",
  type: "CORRECTIVE",
  priority: "MEDIUM",
  asset_id: "",
  assigned_to_id: "",
  scheduled_at: "",
  estimated_minutes: "",
  description: "",
};

export default function NewWorkOrderModal({ open, onOpenChange, assets, users, onCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const technicians = activeTechnicians(users);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.title.trim()) {
      setError("El título es obligatorio");
      return;
    }
    if (!form.asset_id) {
      setError("Elegí un activo");
      return;
    }
    setSaving(true);
    try {
      const response = await base44.functions.invoke("createWorkOrder", {
        title: form.title.trim(),
        type: form.type,
        priority: form.priority,
        asset_id: form.asset_id,
        assigned_to_id: form.assigned_to_id || null,
        scheduled_at: form.scheduled_at ? `${form.scheduled_at}:00-03:00` : null,
        estimated_minutes: form.estimated_minutes === "" ? null : Number(form.estimated_minutes),
        description: form.description,
      });
      if (response.data?.error) {
        setError(response.data.error);
        return;
      }
      setForm(EMPTY);
      onOpenChange(false);
      onCreated(response.data.workOrder);
    } catch (e) {
      setError(e.response?.data?.error || "No se pudo crear la orden de trabajo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading">Nueva orden de trabajo</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div>
            <label className="field-label" htmlFor="wo-title">Título *</label>
            <input
              id="wo-title"
              className="field-input"
              placeholder="Descripcion breve de la intervencion"
              value={form.title}
              onChange={set("title")}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="wo-type">Tipo *</label>
              <select id="wo-type" className="field-input" value={form.type} onChange={set("type")}>
                {options(WO_TYPE).map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="wo-priority">Prioridad *</label>
              <select id="wo-priority" className="field-input" value={form.priority} onChange={set("priority")}>
                {options(WO_PRIORITY).map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="wo-asset">Activo *</label>
            <select id="wo-asset" className="field-input" value={form.asset_id} onChange={set("asset_id")} required>
              <option value="">Elegí un activo</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>{asset.code} - {asset.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="wo-assignee">Asignar a técnico (opcional)</label>
            <select id="wo-assignee" className="field-input" value={form.assigned_to_id} onChange={set("assigned_to_id")}>
              <option value="">Sin asignar</option>
              {technicians.map((technician) => (
                <option key={technician.id} value={technician.id}>{technician.full_name || technician.email}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="wo-scheduled">Fecha programada</label>
              <input
                id="wo-scheduled"
                type="datetime-local"
                className="field-input"
                value={form.scheduled_at}
                onChange={set("scheduled_at")}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="wo-estimated">Tiempo estimado (min)</label>
              <input
                id="wo-estimated"
                type="number"
                min="1"
                className="field-input"
                value={form.estimated_minutes}
                onChange={set("estimated_minutes")}
              />
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="wo-description">Descripción</label>
            <textarea
              id="wo-description"
              rows={4}
              className="field-input"
              placeholder="Detalles de la intervencion..."
              value={form.description}
              onChange={set("description")}
            />
          </div>

          <DialogFooter className="gap-2">
            <button type="button" className="btn-secondary" onClick={() => onOpenChange(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Crear OT
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}