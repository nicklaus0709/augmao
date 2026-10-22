import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { minRankForPath, rankOf } from "@/lib/permissions";

// Guarda por ruta: los permisos reales están en el backend; esto evita que un
// usuario entre por URL a pantallas que no le corresponden.
export default function RequireRole() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (rankOf(user) >= minRankForPath(pathname)) return <Outlet />;
  return (
    <div className="card-surface mx-auto max-w-md p-8 text-center">
      <ShieldAlert className="mx-auto mb-4 text-slate-300" size={34} aria-hidden="true" />
      <h1 className="font-heading text-xl font-bold text-navy">No tenés acceso a esta sección</h1>
      <p className="mt-2 text-sm text-mutedText">Si lo necesitás, pedile al administrador que revise tu rol.</p>
      <Link to="/" className="btn-secondary mt-6">Volver al inicio</Link>
    </div>
  );
}
