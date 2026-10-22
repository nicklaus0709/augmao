import React, { useEffect, useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { activeTechnicians } from "@/lib/permissions";

export default function AssignTechnicianModal({ open, onOpenChange, workOrder, users, onAssigned }) {
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const technicians = activeTechnicians(users);

  useEffect(() => {
    if (open) setSelected(workOrder?.assigned_to_id || "");
  }, [open, workOrder]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!selected) {
      setError("Elegí un técnico");
      return;
    }
    setSaving(true);
    try {
      const response = await base44.functions.invoke("updateWorkOrderStatus", {
        work_order_id: workOrder.id,
        action: "assign",
        assigned_to_id: selected,
      });
      if (response.data?.error) {
        setError(response.data.error);
        return;
      }
      onOpenChange(false);
      onAssigned();
    } catch (e) {
      setError(e.response?.data?.error || "No se pudo asignar el técnico");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Asignar técnico</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {workOrder?.assigned_to_name && (
            <p className="text-sm text-mutedText">Asignado a: <span className="font-medium text-navy">{workOrder.assigned_to_name}</span></p>
          )}
          <div>
            <label className="field-label" htmlFor="assign-select">Técnico</label>
            <select id="assign-select" className="field-input" value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">Elegí un técnico</option>
              {technicians.map((technician) => (
                <option key={technician.id} value={technician.id}>
                  {technician.full_name || technician.email}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter className="gap-2">
            <button type="button" className="btn-secondary" onClick={() => onOpenChange(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus size={16} aria-hidden="true" />}
              Confirmar
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}