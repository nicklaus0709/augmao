import React, { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Power, ShieldCheck, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import PageHeader from "@/components/common/PageHeader";
import { LoadingBlock } from "@/components/common/EmptyState";
import { RoleBadge, ActiveBadge } from "@/components/common/Badges";
import UserFormModal from "@/components/users/UserFormModal";
import { ROLES } from "@/lib/constants";
import { can } from "@/lib/permissions";

export default function Users() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke("manageUsers", { action: "list" });
      setMembers(response.data?.users || []);
      setError("");
    } catch (e) {
      setError("No se pudo cargar la lista de usuarios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (member) => {
    setBusyId(member.id);
    try {
      const response = await base44.functions.invoke("manageUsers", {
        action: "update",
        user_id: member.id,
        active: member.active === false,
      });
      if (response.data?.error) {
        toast({ title: response.data.error, variant: "destructive" });
        return;
      }
      toast({ title: member.active === false ? "Usuario activado" : "Usuario desactivado" });
      await load();
    } catch (e) {
      toast({ title: e.response?.data?.error || "No se pudo actualizar el usuario", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const canManage = can.manageUsers(user);

  return (
    <div>
      <PageHeader
        eyebrow="Accesos"
        title="Administracion de usuarios"
        subtitle="Gestion de accesos y roles del sistema"
        actions={
          canManage && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <Plus size={16} aria-hidden="true" />
              Nuevo usuario
            </button>
          )
        }
      />

      <section className="card-surface mb-5 p-5">
        <h2 className="mb-4 flex items-center gap-2 font-heading text-base font-bold text-navy">
          <ShieldCheck size={17} className="text-brand-600" aria-hidden="true" />
          Guía de roles
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Object.entries(ROLES).map(([value, cfg]) => (
            <li key={value} className="flex items-start gap-3 rounded-xl border border-line/70 px-3 py-2.5">
              <RoleBadge value={value} />
              <span className="text-sm text-mutedText">{cfg.desc}</span>
            </li>
          ))}
        </ul>
      </section>

      {error && <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading ? (
        <div className="card-surface"><LoadingBlock label="Cargando usuarios..." /></div>
      ) : (
        <div className="card-surface overflow-hidden">
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-line bg-cream/60">
                  <th className="table-head px-4 py-3 text-left">Nombre</th>
                  <th className="table-head px-4 py-3 text-left">Email</th>
                  <th className="table-head px-4 py-3 text-left">Rol</th>
                  <th className="table-head px-4 py-3 text-left">Teléfono</th>
                  <th className="table-head px-4 py-3 text-left">Estado</th>
                  <th className="table-head px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="border-b border-line/70">
                    <td className="px-4 py-3 font-medium text-navy">{member.full_name || "-"}</td>
                    <td className="px-4 py-3 text-mutedText">{member.email}</td>
                    <td className="px-4 py-3"><RoleBadge value={member.app_role} /></td>
                    <td className="px-4 py-3 text-mutedText">{member.phone || "-"}</td>
                    <td className="px-4 py-3"><ActiveBadge active={member.active !== false} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canManage && (
                          <>
                            <button
                              type="button"
                              className="btn-icon"
                              aria-label={`Editar ${member.full_name || member.email}`}
                              title="Editar"
                              onClick={() => {
                                setEditing(member);
                                setModalOpen(true);
                              }}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              className="btn-icon"
                              aria-label={member.active === false ? "Activar usuario" : "Desactivar usuario"}
                              title={member.active === false ? "Activar" : "Desactivar"}
                              disabled={busyId === member.id}
                              onClick={() => toggleActive(member)}
                            >
                              {busyId === member.id ? <Loader2 size={15} className="animate-spin" /> : <Power size={15} />}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-line/70 lg:hidden">
            {members.map((member) => (
              <li key={member.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-navy">{member.full_name || "-"}</p>
                    <p className="truncate text-xs text-mutedText">{member.email}</p>
                    <p className="mt-1 text-xs text-mutedText">{member.phone || "Sin teléfono"}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <RoleBadge value={member.app_role} />
                    <ActiveBadge active={member.active !== false} />
                  </div>
                </div>
                {canManage && (
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      className="btn-secondary px-3 py-1 text-xs"
                      onClick={() => {
                        setEditing(member);
                        setModalOpen(true);
                      }}
                    >
                      <Pencil size={13} aria-hidden="true" />
                      Editar
                    </button>
                    <button type="button" className="btn-secondary px-3 py-1 text-xs" onClick={() => toggleActive(member)} disabled={busyId === member.id}>
                      <Power size={13} aria-hidden="true" />
                      {member.active === false ? "Activar" : "Desactivar"}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <UserFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        member={editing}
        onSaved={(result) => {
          if (result?.invited && result?.applied === false) {
            toast({
              title: "Invitación enviada",
              description: "El rol se puede asignar cuando la persona inicie sesión por primera vez.",
            });
          } else {
            toast({ title: editing ? "Usuario actualizado" : "Invitación enviada" });
          }
          load();
        }}
      />
    </div>
  );
}