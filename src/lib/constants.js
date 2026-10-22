// Etiquetas, colores y opciones de AuGmao.

export const WO_STATUS = {
  OPEN: { label: "Abierta", badge: "bg-amber-100 text-amber-800", chart: "#f59e0b" },
  ASSIGNED: { label: "Asignada", badge: "bg-blue-100 text-blue-800", chart: "#3b82f6" },
  IN_PROGRESS: { label: "En progreso", badge: "bg-purple-100 text-purple-800", chart: "#8b5cf6" },
  ON_HOLD: { label: "En pausa", badge: "bg-gray-100 text-gray-700", chart: "#6b7280" },
  COMPLETED: { label: "Completada", badge: "bg-emerald-100 text-emerald-800", chart: "#10b981" },
  CANCELLED: { label: "Cancelada", badge: "bg-red-100 text-red-700", chart: "#ef4444" },
};

export const WO_PRIORITY = {
  LOW: { label: "Baja", badge: "bg-gray-100 text-gray-600", dot: "bg-gray-400", rank: 1 },
  MEDIUM: { label: "Media", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-400", rank: 2 },
  HIGH: { label: "Alta", badge: "bg-orange-100 text-orange-700", dot: "bg-orange-500", rank: 3 },
  CRITICAL: { label: "Crítica", badge: "bg-red-100 text-red-700", dot: "bg-red-600", rank: 4 },
};

export const WO_TYPE = {
  CORRECTIVE: {
    label: "Correctiva",
    chip: "bg-rose-100 text-rose-900",
    event: "bg-rose-100 text-rose-900 hover:bg-rose-200",
    dot: "bg-rose-400",
  },
  PREVENTIVE: {
    label: "Preventiva",
    chip: "bg-emerald-100 text-emerald-900",
    event: "bg-emerald-100 text-emerald-900 hover:bg-emerald-200",
    dot: "bg-emerald-400",
  },
  PREDICTIVE: {
    label: "Predictiva",
    chip: "bg-violet-100 text-violet-900",
    event: "bg-violet-100 text-violet-900 hover:bg-violet-200",
    dot: "bg-violet-400",
  },
  INSPECTION: {
    label: "Inspección",
    chip: "bg-sky-100 text-sky-900",
    event: "bg-sky-100 text-sky-900 hover:bg-sky-200",
    dot: "bg-sky-400",
  },
};

export const ASSET_CATEGORY = {
  MACHINERY: "Maquinaria",
  VEHICLE: "Vehículo",
  ELECTRICAL: "Eléctrico",
  HVAC: "HVAC",
  FACILITY: "Instalación",
  IT_EQUIPMENT: "Informática",
  OTHER: "Otro",
};

export const ASSET_STATUS = {
  OPERATIONAL: { label: "Operativo", badge: "bg-emerald-100 text-emerald-800" },
  UNDER_MAINTENANCE: { label: "En mantenimiento", badge: "bg-amber-100 text-amber-800" },
  OUT_OF_SERVICE: { label: "Fuera de servicio", badge: "bg-red-100 text-red-700" },
  RETIRED: { label: "Retirado", badge: "bg-gray-100 text-gray-600" },
};

export const PART_UNIT = {
  unit: "Unidad",
  liter: "Litro",
  kg: "Kilogramo",
  meter: "Metro",
  kit: "Kit",
};

export const ROLES = {
  ADMIN: { label: "Administrador", desc: "Acceso total al sistema", badge: "bg-purple-100 text-purple-800" },
  SUPERVISOR: { label: "Jefe de área", desc: "ABM completo de OTs, activos e inventario", badge: "bg-blue-100 text-blue-800" },
  TECHNICIAN: { label: "Operario nivel 2", desc: "Ver y modificar OTs, ver activos e inventario", badge: "bg-amber-100 text-amber-800" },
  VIEWER: { label: "Operario nivel 1", desc: "Solo ver y comentar OTs", badge: "bg-gray-100 text-gray-600" },
};

export const FREQUENCY = {
  DAILY: { label: "Diario", plural: "días" },
  WEEKLY: { label: "Semanal", plural: "semanas" },
  MONTHLY: { label: "Mensual", plural: "meses" },
  QUARTERLY: { label: "Trimestral", plural: "trimestres" },
  YEARLY: { label: "Anual", plural: "años" },
  HOURS_OF_USE: { label: "Por horas de uso", plural: "horas de uso" },
};

export const MOVEMENT_KIND = {
  INVOICE: { label: "Factura", chip: "bg-emerald-100 text-emerald-800" },
  DELIVERY_NOTE: { label: "Remito", chip: "bg-blue-100 text-blue-800" },
  OTHER: { label: "Otro", chip: "bg-gray-100 text-gray-700" },
};

export const ALLOWED_ATTACHMENT_TYPES = [
  "image/png", "image/jpeg", "image/webp", "image/gif",
  "application/pdf", "text/plain", "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export const RECEIPT_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function options(map) {
  return Object.entries(map).map(([value, cfg]) => ({ value, label: cfg.label }));
}

export function frequencyText(type, value) {
  const cfg = FREQUENCY[type];
  if (!cfg) return "-";
  const n = Number(value) || 1;
  if (n === 1) return cfg.label;
  return "Cada " + n + " " + cfg.plural;
}