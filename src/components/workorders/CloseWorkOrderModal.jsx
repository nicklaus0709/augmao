import React, { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";

export default function CloseWorkOrderModal({ open, onOpenChange, workOrder, onClosed }) {
  const [form, setForm] = useState({ actual_minutes: "", failure_cause: "", action_taken: "", observations: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    const minutes = Number(form.actual_minutes);
    if (!minutes || minutes <= 0) {
      setError("El tiempo real tiene que ser mayor a 0");
      return;
    }
    setSaving(true);
    try {
      const response = await base44.functions.invoke("closeWorkOrder", {
        work_order_id: workOrder.id,
        actual_minutes: minutes,
        failure_cause: form.failure_cause,
        action_taken: form.action_taken,
        observations: form.observations,
      });
      if (response.data?.error) {
        setError(response.data.error);
        return;
      }
      onOpenChange(false);
      onClosed(response.data.workOrder);
    } catch (e) {
      setError(e.response?.data?.error || "No se pudo cerrar la OT");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">Cerrar orden de trabajo</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div>
            <label className="field-label" htmlFor="close-minutes">Tiempo real empleado (minutos) *</label>
            <input
              id="close-minutes"
              type="number"
              min="1"
              className="field-input"
              value={form.actual_minutes}
              onChange={set("actual_minutes")}
              required
            />
          </div>
          <div>
            <label className="field-label" htmlFor="close-cause">Causa de la falla</label>
            <input id="close-cause" className="field-input" value={form.failure_cause} onChange={set("failure_cause")} />
          </div>
          <div>
            <label className="field-label" htmlFor="close-action">Acción realizada</label>
            <textarea id="close-action" rows={3} className="field-input" value={form.action_taken} onChange={set("action_taken")} />
          </div>
          <div>
            <label className="field-label" htmlFor="close-notes">Observaciones</label>
            <textarea id="close-notes" rows={3} className="field-input" value={form.observations} onChange={set("observations")} />
          </div>

          <DialogFooter className="gap-2">
            <button type="button" className="btn-secondary" onClick={() => onOpenChange(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 size={16} aria-hidden="true" />}
              Confirmar cierre
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}