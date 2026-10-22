import React, { useEffect, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { callFunction } from "@/api/data";
import { FREQUENCY } from "@/lib/constants";
import { activeTechnicians } from "@/lib/permissions";
import { todayISODate } from "@/lib/format";

export default function NewPlanModal({ open, onOpenChange, assets, users, onSaved }) {
  const [form, setForm] = useState({
    name: "",
    asset_id: "",
    frequency_type: "MONTHLY",
    frequency_value: "1",
    estimated_minutes: "",
    start_date: "",
    assigned_to_id: "",
    description: "",
  });
  const [checklist, setChecklist] = useState([]);
  const [task, setTask] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setChecklist([]);
    setTask("");
    setForm({
      name: "",
      asset_id: "",
      frequency_type: "MONTHLY",
      frequency_value: "1",
      estimated_minutes: "",
      start_date: todayISODate(),
      assigned_to_id: "",
      description: "",
    });
  }, [open]);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const addTask = () => {
    const value = task.trim();
    if (!value) return;
    setChecklist((prev) => [...prev, value]);
    setTask("");
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("El nombre del plan es obligatorio");
      return;
    }
    if (!form.asset_id) {
      setError("Elegí un activo");
      return;
    }
    setSaving(true);
    try {
      await callFunction(
        "manageCatalog",
        {
          entity: "MaintenancePlan",
          action: "create",
          data: {
            name: form.name.trim(),
            description: form.description.trim(),
            asset_id: form.asset_id,
            frequency_type: form.frequency_type,
            frequency_value: Number(form.frequency_value) || 1,
            estimated_minutes: form.estimated_minutes ? Number(form.estimated_minutes) : null,
            task_checklist: checklist,
            assigned_to_id: form.assigned_to_id || null,
            start_date: form.start_date || todayISODate(),
          },
        },
        "No se pudo crear el plan"
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading">Nuevo plan de mantenimiento</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div>
            <label className="field-label" htmlFor="plan-name">Nombre del plan *</label>
            <input
              id="plan-name"
              className="field-input"
              placeholder="Ej: Mantenimiento mensual bomba hidraulica"
              value={form.name}
              onChange={set("name")}
              required
            />
          </div>

          <div>
            <label className="field-label" htmlFor="plan-asset">Activo *</label>
            <select id="plan-asset" className="field-input" value={form.asset_id} onChange={set("asset_id")} required>
              <option value="">Elegí un activo</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>{asset.code} - {asset.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="field-label" htmlFor="plan-frequency">Frecuencia</label>
              <select id="plan-frequency" className="field-input" value={form.frequency_type} onChange={set("frequency_type")}>
                {Object.entries(FREQUENCY).map(([value, cfg]) => (
                  <option key={value} value={value}>{cfg.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="plan-value">Cada cuánto</label>
              <input id="plan-value" type="number" min="1" className="field-input" value={form.frequency_value} onChange={set("frequency_value")} />
            </div>
            <div>
              <label className="field-label" htmlFor="plan-minutes">Tiempo estimado (min)</label>
              <input id="plan-minutes" type="number" min="1" className="field-input" value={form.estimated_minutes} onChange={set("estimated_minutes")} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="plan-start">Fecha de inicio</label>
              <input id="plan-start" type="date" className="field-input" value={form.start_date} onChange={set("start_date")} />
            </div>
            <div>
              <label className="field-label" htmlFor="plan-technician">Técnico por defecto</label>
              <select id="plan-technician" className="field-input" value={form.assigned_to_id} onChange={set("assigned_to_id")}>
                <option value="">Sin asignar</option>
                {activeTechnicians(users).map((technician) => (
                  <option key={technician.id} value={technician.id}>{technician.full_name || technician.email}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="plan-description">Descripción</label>
            <textarea id="plan-description" rows={3} className="field-input" value={form.description} onChange={set("description")} />
          </div>

          <div>
            <label className="field-label" htmlFor="plan-task">Checklist de tareas</label>
            <div className="flex items-center gap-2">
              <input
                id="plan-task"
                className="field-input"
                placeholder="Ej: Reemplazar filtro HF-200"
                value={task}
                onChange={(e) => setTask(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addTask();
                  }
                }}
              />
              <button type="button" className="btn-secondary shrink-0" onClick={addTask}>
                <Plus size={15} aria-hidden="true" />
                Agregar
              </button>
            </div>
            {checklist.length > 0 && (
              <ul className="mt-3 space-y-2">
                {checklist.map((item, index) => (
                  <li key={`${item}-${index}`} className="flex items-center gap-2 rounded-xl border border-line/70 px-3 py-2 text-sm text-navy">
                    <span className="min-w-0 flex-1">{item}</span>
                    <button
                      type="button"
                      onClick={() => setChecklist((prev) => prev.filter((_, i) => i !== index))}
                      aria-label={`Quitar ${item}`}
                      className="btn-icon h-6 w-6 text-red-500"
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DialogFooter className="gap-2">
            <button type="button" className="btn-secondary" onClick={() => onOpenChange(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Crear plan
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}