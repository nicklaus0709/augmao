// Utilidades compartidas por las funciones de backend de AuGmao.
export const ROLE_RANK = { VIEWER: 1, TECHNICIAN: 2, SUPERVISOR: 3, ADMIN: 4 };

export function unwrap(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.items)) return result.items;
  return [];
}

export function roleOf(user) {
  if (!user) return "VIEWER";
  const raw = user.app_role || (user.data && user.data.app_role);
  if (raw && ROLE_RANK[raw]) return raw;
  return user.role === "admin" ? "ADMIN" : "TECHNICIAN";
}

export function rankOf(user) {
  return ROLE_RANK[roleOf(user)] || 0;
}

export function errorResponse(message, status) {
  return Response.json({ error: message }, { status: status || 400 });
}

// Lee un registro y devuelve null si no existe (el SDK lanza error en ese caso).
export async function getRecord(base44, entityName, id) {
  if (!id) return null;
  try {
    return await base44.entities[entityName].get(id);
  } catch (e) {
    return null;
  }
}

// Devuelve { user } o { denied: Response }
export async function requireUser(base44, minRank) {
  const user = await base44.auth.me();
  if (!user) return { denied: errorResponse("No autorizado", 401) };
  if (user.active === false) return { denied: errorResponse("Tu usuario está desactivado", 403) };
  if (minRank && rankOf(user) < minRank) {
    return { denied: errorResponse("No tenés permisos para esta acción", 403) };
  }
  return { user };
}

export function currentYearAR() {
  return Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
      year: "numeric",
    }).format(new Date())
  );
}

export function formatWorkOrderCode(year, number) {
  return "OT-" + year + "-" + String(number).padStart(4, "0");
}

// Reserva el próximo número correlativo del año de forma segura ante ejecuciones simultáneas.
export async function reserveWorkOrderCode(base44) {
  const year = currentYearAR();
  let counters = unwrap(await base44.entities.WorkOrderCounter.filter({ year }));
  if (!counters.length) {
    const existing = unwrap(
      await base44.entities.WorkOrder.filter({ code: { $regex: "^OT-" + year + "-" } }, { limit: 500 })
    );
    let max = 0;
    for (const wo of existing) {
      const match = /-(\d+)$/.exec(wo.code || "");
      if (match) max = Math.max(max, Number(match[1]));
    }
    try {
      const created = await base44.entities.WorkOrderCounter.create({ year, last: max });
      counters = [created];
    } catch (e) {
      counters = unwrap(await base44.entities.WorkOrderCounter.filter({ year }));
    }
  }
  const counter = counters[0];
  if (!counter) throw new Error("No se pudo inicializar el contador de órdenes de trabajo");

  for (let attempt = 0; attempt < 20; attempt++) {
    const current = await base44.entities.WorkOrderCounter.get(counter.id);
    const last = Number(current.last || 0);
    const next = last + 1;
    await base44.entities.WorkOrderCounter.updateMany(
      { id: counter.id, last },
      { $inc: { last: 1 } }
    );
    const after = await base44.entities.WorkOrderCounter.get(counter.id);
    if (Number(after.last || 0) === next) return formatWorkOrderCode(year, next);
  }
  throw new Error("No se pudo reservar el código de la OT, intentá nuevamente");
}

export function addFrequency(isoDate, type, value) {
  const base = isoDate ? new Date(isoDate) : new Date();
  const n = Number(value) || 1;
  const d = new Date(base.getTime());
  switch (type) {
    case "DAILY":
      d.setUTCDate(d.getUTCDate() + n);
      break;
    case "WEEKLY":
      d.setUTCDate(d.getUTCDate() + n * 7);
      break;
    case "MONTHLY":
      d.setUTCMonth(d.getUTCMonth() + n);
      break;
    case "QUARTERLY":
      d.setUTCMonth(d.getUTCMonth() + n * 3);
      break;
    case "YEARLY":
      d.setUTCFullYear(d.getUTCFullYear() + n);
      break;
    default:
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
  }
  return d.toISOString();
}

// Aplica un cambio de stock de forma segura: nunca deja el stock negativo y
// dos ajustes simultáneos se suman. Devuelve { stock_after } o { error }.
export async function applyStockChange(base44, sparePartId, delta) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const part = await getRecord(base44, "SparePart", sparePartId);
    if (!part) return { error: "Repuesto no encontrado" };
    const current = Number(part.stock_current || 0);
    if (current + delta < 0) {
      return { error: "Stock insuficiente. Actual: " + current, current };
    }
    const filter = delta < 0
      ? { id: sparePartId, stock_current: { $gte: -delta } }
      : { id: sparePartId };
    await base44.entities.SparePart.updateMany(filter, { $inc: { stock_current: delta } });
    const after = await getRecord(base44, "SparePart", sparePartId);
    const stockAfter = Number(after ? after.stock_current || 0 : current);
    if (stockAfter !== current) {
      return { stock_after: stockAfter, part: after, previous: current };
    }
  }
  return { error: "No se pudo actualizar el stock, intentá nuevamente" };
}

// Directorio del equipo: eleva privilegios porque la entidad User solo la pueden
// listar los administradores de plataforma, y AuGmao necesita mostrar al equipo.
export async function teamDirectory(base44) {
  const users = unwrap(await base44.asServiceRole.entities.User.list());
  return users.map((u) => ({
    id: u.id,
    full_name: u.full_name || "",
    email: u.email || "",
    app_role: u.app_role || (u.role === "admin" ? "ADMIN" : "TECHNICIAN"),
    phone: u.phone || "",
    active: u.active !== false,
    created_date: u.created_date || null,
  }));
}

export async function resolveUserName(base44, userId) {
  if (!userId) return null;
  try {
    const record = await base44.asServiceRole.entities.User.get(userId);
    return record ? record.full_name || record.email || null : null;
  } catch (e) {
    return null;
  }
}

// Reserva el plan (para no duplicar OTs si la tarea corre dos veces) y genera la OT.
export async function runPlanNow(base44, plan) {
  const previous = plan.next_run_at || new Date().toISOString();
  const nowIso = new Date().toISOString();
  const nextRun = addFrequency(previous, plan.frequency_type, plan.frequency_value);

  await base44.entities.MaintenancePlan.updateMany(
    { id: plan.id, next_run_at: plan.next_run_at || null },
    { $set: { last_run_at: nowIso, next_run_at: nextRun } }
  );
  const after = await getRecord(base44, "MaintenancePlan", plan.id);
  const storedNext = after && after.next_run_at ? new Date(after.next_run_at).getTime() : null;
  if (storedNext !== new Date(nextRun).getTime()) return null;

  const checklist = Array.isArray(plan.task_checklist) ? plan.task_checklist.filter(Boolean) : [];
  const description = checklist.length
    ? "Checklist:\n" + checklist.map((t, i) => i + 1 + ". " + t).join("\n")
    : plan.description || "";

  const code = await reserveWorkOrderCode(base44);

  return await base44.entities.WorkOrder.create({
    code,
    type: "PREVENTIVE",
    status: plan.assigned_to_id ? "ASSIGNED" : "OPEN",
    priority: "MEDIUM",
    title: "PREVENTIVO - " + plan.name,
    description,
    asset_id: plan.asset_id,
    maintenance_plan_id: plan.id,
    assigned_to_id: plan.assigned_to_id || null,
    scheduled_at: previous,
    estimated_minutes: plan.estimated_minutes || null,
  });
}