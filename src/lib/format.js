// Formatos de fecha, hora, duración y montos (Argentina).

const TZ = "America/Argentina/Buenos_Aires";

function toDate(value) {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12));
  }
  let input = value;
  // Las fechas guardadas siempre llevan zona horaria; las que no la llevan son UTC.
  if (typeof input === "string" && input.includes("T") && !/([zZ]|[+-]\d{2}:?\d{2})$/.test(input)) {
    input = input + "Z";
  }
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parts(value, options) {
  const d = toDate(value);
  if (!d) return null;
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, ...options });
  const out = {};
  for (const p of fmt.formatToParts(d)) out[p.type] = p.value;
  return out;
}

export function formatDate(value) {
  if (!value) return "-";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }
  const p = parts(value, { day: "2-digit", month: "2-digit", year: "numeric" });
  return p ? `${p.day}/${p.month}/${p.year}` : "-";
}

export function formatTime(value) {
  const p = parts(value, { hour: "2-digit", minute: "2-digit", hour12: false });
  return p ? `${p.hour}:${p.minute}` : "-";
}

export function formatDateTime(value) {
  if (!value) return "-";
  return `${formatDate(value)}, ${formatTime(value)}`;
}

export function formatClock(value) {
  const p = parts(value, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  return p ? `${p.hour}:${p.minute}:${p.second}` : "--:--:--";
}

export function formatLongDate(value) {
  const p = parts(value, { weekday: "long", day: "numeric", month: "long" });
  if (!p) return "-";
  return `${p.weekday} ${p.day} de ${p.month}`;
}

export function formatMonthYear(value) {
  const p = parts(value, { month: "long", year: "numeric" });
  if (!p) return "-";
  return `${p.month} ${p.year}`;
}

export function formatMinutes(min) {
  const value = Number(min);
  if (!value || value <= 0) return "-";
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  if (hours === 0) return `${rest}min`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}min`;
}

export function formatMoney(value) {
  const n = Number(value);
  if (!value && value !== 0) return "-";
  if (Number.isNaN(n)) return "-";
  const fixed = Math.abs(n).toFixed(2);
  const [int, dec] = fixed.split(".");
  const withDots = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${n < 0 ? "-" : ""}$ ${withDots},${dec}`;
}

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatPercent(value) {
  const n = Number(value) || 0;
  return `${Math.round(n * 100) / 100}%`;
}

// Fechas con la hora local de Argentina, sin corrimientos.
export function toDateTimeLocal(value) {
  if (!value) return "";
  const p = parts(value, {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  if (!p) return "";
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function fromDateTimeLocal(value) {
  if (!value) return null;
  const normalized = value.length === 16 ? `${value}:00` : value;
  return `${normalized}-03:00`;
}

export function todayISODate() {
  const p = parts(new Date(), { year: "numeric", month: "2-digit", day: "2-digit" });
  return `${p.year}-${p.month}-${p.day}`;
}

export function addFrequency(isoDate, type, value) {
  const base = isoDate ? toDate(isoDate) : new Date();
  const n = Number(value) || 1;
  const d = new Date(base.getTime());
  switch (type) {
    case "DAILY": d.setUTCDate(d.getUTCDate() + n); break;
    case "WEEKLY": d.setUTCDate(d.getUTCDate() + n * 7); break;
    case "MONTHLY": d.setUTCMonth(d.getUTCMonth() + n); break;
    case "QUARTERLY": d.setUTCMonth(d.getUTCMonth() + n * 3); break;
    case "YEARLY": d.setUTCFullYear(d.getUTCFullYear() + n); break;
    default: d.setUTCMonth(d.getUTCMonth() + 1); break;
  }
  return d.toISOString();
}

export function startOfDay(date) {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

export function startOfMonth(date) {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
}

export function addMonths(date, months) {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months, 1);
  return d;
}

// Lunes como primer día de la semana.
export function startOfWeek(date) {
  const d = startOfDay(date);
  const day = (d.getDay() + 6) % 7;
  return addDays(d, -day);
}

export function isSameDay(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function isToday(date) {
  return isSameDay(date, new Date());
}

export function fileStamp(date = new Date()) {
  const p = parts(date, { year: "numeric", month: "2-digit", day: "2-digit" });
  return `${p.year}-${p.month}-${p.day}`;
}