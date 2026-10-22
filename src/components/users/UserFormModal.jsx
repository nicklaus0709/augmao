import React, { useEffect, useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { ROLES } from "@/lib/constants";

export default function UserFormModal({ open, onOpenChange, member, onSaved }) {
  const [form, setForm] = useState({ full_name: "", email: "", app_role: "VIEWER", phone: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm(
      member
        ? {
            full_name: member.full_name || "",
            email: member.email || "",
            app_role: member.app_role || "VIEWER",
            phone: member.phone || "",
          }
        : { full_name: "", email: "", app_role: "VIEWER", phone: "" }
    );
  }, [open, member]);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.full_name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    if (!member && !form.email.trim()) {
      setError("El email es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const response = await base44.functions.invoke(
        "manageUsers",
        member
          ? { action: "update", user_id: member.id, full_name: form.full_name, app_role: form.app_role, phone: form.phone }
          : { action: "invite", full_name: form.full_name, email: form.email, app_role: form.app_role, phone: form.phone }
      );
      if (response.data?.error) {
        setError(response.data.error);
        return;
      }
      onOpenChange(false);
      onSaved(response.data);
    } catch (e) {
      setError(e.response?.data?.error || "No se pudo guardar el usuario");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">{member ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {!member && (
            <p className="rounded-xl bg-brand-50 px-3 py-2 text-xs text-navy">
              Se envía una invitación por email con el sistema de Base44. La contraseña la administra el propio usuario.
            </p>
          )}

          <div>
            <label className="field-label" htmlFor="user-name">Nombre completo *</label>
            <input id="user-name" className="field-input" placeholder="Juan Perez" value={form.full_name} onChange={set("full_name")} required />
          </div>

          <div>
            <label className="field-label" htmlFor="user-email">Email *</label>
            <input
              id="user-email"
              type="email"
              className="field-input"
              value={form.email}
              onChange={set("email")}
              disabled={Boolean(member)}
              required={!member}
            />
          </div>

          <div>
            <label className="field-label" htmlFor="user-role">Rol *</label>
            <select id="user-role" className="field-input" value={form.app_role} onChange={set("app_role")}>
              {Object.entries(ROLES).map(([value, cfg]) => (
                <option key={value} value={value}>{cfg.label} — {cfg.desc}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="user-phone">Teléfono</label>
            <input id="user-phone" className="field-input" placeholder="+54 11 1234-5678" value={form.phone} onChange={set("phone")} />
          </div>

          <DialogFooter className="gap-2">
            <button type="button" className="btn-secondary" onClick={() => onOpenChange(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus size={16} aria-hidden="true" />}
              {member ? "Guardar cambios" : "Invitar usuario"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}