import React, { useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { Menu, ScanLine, UserX, LogOut } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import Sidebar from "@/components/layout/Sidebar";
import Footer from "@/components/layout/Footer";
import Logo from "@/components/layout/Logo";

function Deactivated({ onLogout }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-cream">
      <div className="bp-grid-light pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
      <div className="relative flex flex-1 items-center justify-center px-6">
        <div className="card-surface w-full max-w-md p-8 text-center">
          <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600">
            <UserX size={26} aria-hidden="true" />
          </span>
          <h1 className="font-heading text-2xl font-bold text-navy">Tu usuario está desactivado</h1>
          <p className="mt-3 text-sm text-mutedText">
            Un administrador tiene que reactivar tu cuenta para que puedas volver a usar AuGmao.
          </p>
          <button
            type="button"
            onClick={onLogout}
            className="btn-secondary mt-6 w-full justify-center"
          >
            <LogOut size={16} aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [expanded, setExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    setBlocked(Boolean(user) && user.active === false);
  }, [user]);

  // El bloqueo por desactivación tiene efecto inmediato aunque la sesión siga abierta.
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const me = await base44.auth.me();
        if (alive) setBlocked(Boolean(me) && me.active === false);
      } catch (e) {
        /* si falla la consulta se mantiene el estado actual */
      }
    };
    const id = setInterval(check, 60000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const handleLogout = () => logout();

  if (blocked) return <Deactivated onLogout={handleLogout} />;

  return (
    <div className="min-h-screen bg-cream" onClick={() => setExpanded(false)}>
      <Sidebar
        user={user}
        expanded={expanded}
        mobileOpen={mobileOpen}
        onExpand={() => setExpanded(true)}
        onCollapse={() => setExpanded(false)}
        onCloseMobile={() => setMobileOpen(false)}
        onLogout={handleLogout}
      />

      <div className={`flex min-h-screen flex-col transition-[margin] duration-200 ${expanded ? "lg:ml-[240px]" : "lg:ml-[68px]"}`}>
        <header className="glass sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line px-4 lg:hidden">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMobileOpen(true);
            }}
            aria-label="Abrir menú"
            className="rounded-xl p-2 text-navy hover:bg-navy/5"
          >
            <Menu size={20} />
          </button>
          <Logo size="sm" variant="navy" subtitle={false} />
          <Link
            to="/scan"
            aria-label="Escanear QR"
            title="Escanear QR"
            className="ml-auto rounded-xl p-2 text-brand-600 hover:bg-brand-50"
          >
            <ScanLine size={20} />
          </Link>
        </header>

        <main className="flex-1">
          <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            <Outlet />
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}