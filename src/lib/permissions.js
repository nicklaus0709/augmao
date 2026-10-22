// Matriz de permisos de AuGmao.
import { ROLES } from "@/lib/constants";

export const RANK = { VIEWER: 1, TECHNICIAN: 2, SUPERVISOR: 3, ADMIN: 4 };

export function resolveRole(user) {
  if (!user) return null;
  const raw = user.app_role || (user.data && user.data.app_role);
  if (raw && ROLES[raw]) return raw;
  // Mínimo privilegio: sin rol de app válido es Operario nivel 1 (igual que el backend).
  return user.role === "admin" ? "ADMIN" : "VIEWER";
}

export function rankOf(user) {
  return RANK[resolveRole(user)] || 0;
}

export function isDeactivated(user) {
  return Boolean(user) && user.active === false;
}

export const can = {
  comment: () => true,
  scan: () => true,
  createWorkOrder: (u) => rankOf(u) >= 2,
  closeWorkOrder: (u) => rankOf(u) >= 2,
  addParts: (u) => rankOf(u) >= 2,
  uploadAttachments: (u) => rankOf(u) >= 2,
  viewAssets: (u) => rankOf(u) >= 2,
  viewInventory: (u) => rankOf(u) >= 2,
  adjustStock: (u) => rankOf(u) >= 2,
  assignTechnician: (u) => rankOf(u) >= 3,
  manageAssets: (u) => rankOf(u) >= 3,
  manageSpareParts: (u) => rankOf(u) >= 3,
  deleteAttachments: (u) => rankOf(u) >= 3,
  managePlans: (u) => rankOf(u) >= 3,
  viewKpis: (u) => rankOf(u) >= 3,
  viewUsers: (u) => rankOf(u) >= 3,
  manageUsers: (u) => rankOf(u) === 4,
  cancelWorkOrder: (u) => rankOf(u) >= 3,
  viewHistory: (u) => rankOf(u) >= 3,
  viewHealth: (u) => rankOf(u) === 4,
};

// Un técnico opera OTs sin asignar o asignadas a él; jefes y admins, cualquiera.
export function canOperateWorkOrder(user, workOrder) {
  if (!user || !workOrder || rankOf(user) < 2) return false;
  if (rankOf(user) >= 3) return true;
  return !workOrder.assigned_to_id || workOrder.assigned_to_id === user.id;
}

export const NAV_ITEMS = [
  { label: "Dashboard", path: "/", icon: "LayoutDashboard", min: 1 },
  { label: "Órdenes de trabajo", path: "/work-orders", icon: "ClipboardList", min: 1 },
  { label: "Escanear QR", path: "/scan", icon: "ScanLine", min: 1 },
  { label: "Activos", path: "/assets", icon: "Package2", min: 2 },
  { label: "Inventario", path: "/inventory", icon: "Boxes", min: 2 },
  { label: "Mantenimiento", path: "/maintenance", icon: "Calendar", min: 3 },
  { label: "KPIs e informes", path: "/kpis", icon: "BarChart3", min: 3 },
  { label: "Usuarios", path: "/users", icon: "Users", min: 3 },
  { label: "Salud del sistema", path: "/health", icon: "Activity", min: 4 },
];

// Rango mínimo por ruta, usado por RequireRole en App.jsx.
export function minRankForPath(path) {
  const item = NAV_ITEMS.find((nav) => nav.path !== "/" && (path === nav.path || path.startsWith(nav.path + "/")));
  return item ? item.min : 1;
}

export function visibleNav(user) {
  const rank = rankOf(user);
  return NAV_ITEMS.filter((item) => rank >= item.min);
}

export function activeTechnicians(users) {
  return (users || []).filter(
    (u) => u.active !== false && (resolveRole(u) === "TECHNICIAN" || resolveRole(u) === "SUPERVISOR" || resolveRole(u) === "ADMIN")
  );
}