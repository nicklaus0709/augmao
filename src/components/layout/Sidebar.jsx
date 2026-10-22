import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, ClipboardList, ScanLine, Package2, Boxes, Calendar,
  BarChart3, Users, Activity, LogOut, User, X,
} from "lucide-react";
import Logo from "@/components/layout/Logo";
import { visibleNav, resolveRole } from "@/lib/permissions";
import { ROLES } from "@/lib/constants";

const ICONS = {
  LayoutDashboard, ClipboardList, ScanLine, Package2, Boxes, Calendar, BarChart3, Users, Activity,
};

function NavItems({ user, expanded, onNavigate }) {
  return (
    <nav className="flex-1 px-3 py-4">
      <ul className="space-y-1">
        {visibleNav(user).map((item) => {
          const Icon = ICONS[item.icon];
          return (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === "/"}
                onClick={() => onNavigate && onNavigate()}
                title={!expanded ? item.label : undefined}
                className={({ isActive }) =>
                  `flex items-center rounded-xl px-3 py-2.5 font-mono text-[13px] transition-colors duration-200 ${
                    expanded ? "gap-3" : "justify-center"
                  } ${
                    isActive
                      ? "bg-brand-600 text-white shadow-[0_10px_24px_-12px_rgba(67,119,239,0.9)]"
                      : "text-cream/65 hover:bg-white/[0.06] hover:text-cream"
                  }`
                }
              >
                <Icon size={17} aria-hidden="true" />
                {expanded && <span className="truncate">{item.label}</span>}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function UserBox({ user, expanded, onLogout }) {
  const role = resolveRole(user);
  return (
    <div className={`border-t border-white/10 px-3 py-4 ${expanded ? "" : "flex flex-col items-center"}`}>
      <div className={`flex items-center ${expanded ? "gap-3" : ""}`}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-cream">
          <User size={17} aria-hidden="true" />
        </span>
        {expanded && (
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-cream">{user?.full_name || "Usuario"}</span>
            <span className="block truncate font-mono text-[10px] uppercase tracking-[0.15em] text-cream/45">
              {ROLES[role]?.label || "Operario"}
            </span>
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onLogout}
        title="Cerrar sesión"
        aria-label="Cerrar sesión"
        className={`mt-3 flex items-center rounded-xl px-3 py-2 text-sm text-red-300 transition-colors duration-200 hover:bg-red-500/10 ${
          expanded ? "w-full gap-3" : "justify-center"
        }`}
      >
        <LogOut size={16} aria-hidden="true" />
        {expanded && <span>Cerrar sesion</span>}
      </button>
    </div>
  );
}

export function SidebarContent({ user, expanded, onLogout, onNavigate }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center border-b border-white/10 px-4">
        {expanded ? <Logo size="md" /> : (
          <a href="/" className="mx-auto" aria-label="AuGmao">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
            </span>
          </a>
        )}
      </div>
      <NavItems user={user} expanded={expanded} onNavigate={onNavigate} />
      <UserBox user={user} expanded={expanded} onLogout={onLogout} />
    </div>
  );
}

// Menú lateral: 240px en escritorio (68px reducido) y panel deslizante en celular.
export default function Sidebar({ user, expanded, mobileOpen, onCollapse, onExpand, onCloseMobile, onLogout }) {
  return (
    <>
      <aside
        onClick={(e) => {
          e.stopPropagation();
          onExpand();
        }}
        style={{ width: expanded ? 240 : 68 }}
        className="fixed inset-y-0 left-0 z-40 hidden overflow-hidden bg-navy-950 text-cream transition-[width] duration-200 ease-out lg:block"
      >
        <div className="bp-grid-dark pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="relative h-full">
          <SidebarContent user={user} expanded={expanded} onLogout={onLogout} />
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-navy-950/50 backdrop-blur-sm"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside
            style={{ width: 280 }}
            className="relative h-full overflow-hidden bg-navy-950 text-cream shadow-2xl"
          >
            <div className="bp-grid-dark pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Cerrar menú"
              className="absolute right-3 top-4 z-10 rounded-xl p-2 text-cream/70 hover:bg-white/10 hover:text-cream"
            >
              <X size={18} />
            </button>
            <div className="relative h-full">
              <SidebarContent user={user} expanded onLogout={onLogout} onNavigate={onCloseMobile} />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}