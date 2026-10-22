// Utilidades compartidas por las funciones de backend de AuGmao.
//
// Modelo de seguridad: el cliente solo lee (la RLS de las entidades bloquea toda
// escritura desde el navegador). Cada cambio pasa por una función que valida
// rol, estado del registro y datos, escribe con el rol de servicio y deja
// rastro en AuditLog. Ver base44/entities/*.jsonc.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

export const ROLE_RANK = { VIEWER: 1, TECHNICIAN: 2, SUPERVISOR: 3, ADMIN: 4 };
export const ROLES = Object.keys(ROLE_RANK);
export const OPEN_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'];

export function unwrap(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.items)) return result.items;
  return [];
}

// Mínimo privilegio: sin rol de app válido el usuario es Operario nivel 1.
export function roleOf(user) {
  if (!user) return 'VIEWER';
  const raw = user.app_role || (user.data && user.data.app_role);
  if (raw && ROLE_RANK[raw]) return raw;
  return user.role === 'admin' ? 'ADMIN' : 'VIEWER';
}

export function rankOf(user) {
  return ROLE_RANK[roleOf(user)] || 0;
}

export function isActive(user) {
  if (!user) return false;
  const raw = user.active !== undefined ? user.active : user.data && user.data.active;
  return raw !== false;
}

export function displayName(user) {
  if (!user) return null;
  return user.full_name || user.email || null;
}

export function errorResponse(message, status) {
  return Response.json({ error: message }, { status: status || 400 });
}

export class ValidationError extends Error {}

// ---------------------------------------------------------------------------
// Observabilidad
// ---------------------------------------------------------------------------

// Una línea JSON por evento: Base44 la muestra en los logs de la función.
// Nunca incluir emails, teléfonos ni texto libre del usuario.
export function logEvent(level, fields) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

function outcomeOf(status) {
  if (status < 400) return 'ok';
  if (status === 401 || status === 403) return 'denied';
  if (status < 500) return 'invalid';
  return 'error';
}

async function recordErrorEvent(ctx, level, message, stack) {
  try {
    await ctx.db.ErrorEvent.create({
      source: 'backend',
      level,
      fn: ctx.name + (ctx.body && ctx.body.action ? ':' + ctx.body.action : ''),
      message: String(message || '').slice(0, 500),
      stack: stack ? String(stack).slice(0, 2000) : null,
      request_id: ctx.requestId,
      user_id: ctx.user ? ctx.user.id : null,
      user_role: ctx.user ? roleOf(ctx.user) : null,
    });
  } catch (e) {
    logEvent('warn', { fn: ctx.name, request_id: ctx.requestId, msg: 'error_event_failed', error: e.message });
  }
}

// Envuelve una función de backend: id de correlación, medición de tiempo, log
// estructurado, errores genéricos hacia el cliente y registro de fallas.
//
// El handler recibe ctx = { name, requestId, base44, db, body, user, fields,
// requireUser(minRank) } y devuelve un Response. `db` son las entidades con rol
// de servicio: usarlo solo después de autorizar.
export function defineFunction(name, handler) {
  return async function (req) {
    const started = Date.now();
    const requestId = crypto.randomUUID().slice(0, 8);
    const ctx = { name, requestId, base44: null, db: null, body: {}, user: null, fields: {} };
    let response;
    let failure = null;

    try {
      ctx.base44 = createClientFromRequest(req);
      ctx.db = ctx.base44.asServiceRole.entities;
      const body = await req.json().catch(() => ({}));
      ctx.body = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
      ctx.requireUser = (minRank) => requireUser(ctx, minRank);
      response = await handler(ctx);
    } catch (error) {
      if (error instanceof ValidationError) {
        response = errorResponse(error.message, 400);
      } else {
        failure = error;
        response = Response.json(
          { error: 'Ocurrió un error inesperado. Código: ' + requestId, request_id: requestId },
          { status: 500 }
        );
      }
    }

    const outcome = outcomeOf(response.status);
    logEvent(outcome === 'error' ? 'error' : outcome === 'denied' ? 'warn' : 'info', {
      fn: name,
      action: ctx.body.action || null,
      request_id: requestId,
      user_id: ctx.user ? ctx.user.id : null,
      role: ctx.user ? roleOf(ctx.user) : null,
      outcome,
      status: response.status,
      duration_ms: Date.now() - started,
      ...ctx.fields,
      ...(failure ? { error: failure.message } : {}),
    });

    if (ctx.db && failure) await recordErrorEvent(ctx, 'error', failure.message, failure.stack);
    else if (ctx.db && response.status === 403 && ctx.user) await recordErrorEvent(ctx, 'denied', ctx.deniedReason || 'Acceso denegado');

    try {
      response.headers.set('x-request-id', requestId);
    } catch (e) {
      /* cabeceras inmutables: el id ya va en el log */
    }
    return response;
  };
}

// Devuelve un Response de rechazo, o null si el usuario puede seguir.
export async function requireUser(ctx, minRank) {
  let user = null;
  try {
    user = await ctx.base44.auth.me();
  } catch (e) {
    user = null;
  }
  if (!user) return errorResponse('No autorizado', 401);
  ctx.user = user;
  if (!isActive(user)) {
    ctx.deniedReason = 'Usuario desactivado';
    return errorResponse('Tu usuario está desactivado', 403);
  }
  if (minRank && rankOf(user) < minRank) {
    ctx.deniedReason = 'Rol insuficiente (requiere nivel ' + minRank + ')';
    return errorResponse('No tenés permisos para esta acción', 403);
  }
  return null;
}

export function deny(ctx, reason, message) {
  ctx.deniedReason = reason;
  return errorResponse(message || 'No tenés permisos para esta acción', 403);
}

// Auditoría de negocio: quién cambió qué. Nunca corta la operación principal.
export async function audit(ctx, { action, entity, entityId, summary, changes }) {
  try {
    await ctx.db.AuditLog.create({
      action,
      entity,
      entity_id: entityId || null,
      summary: summary ? String(summary).slice(0, 500) : null,
      changes: changes && Object.keys(changes).length ? changes : null,
      actor_id: ctx.user ? ctx.user.id : null,
      actor_name: ctx.user ? displayName(ctx.user) : 'Sistema',
      actor_role: ctx.user ? roleOf(ctx.user) : 'SYSTEM',
      request_id: ctx.requestId,
    });
  } catch (e) {
    logEvent('warn', { fn: ctx.name, request_id: ctx.requestId, msg: 'audit_failed', error: e.message });
  }
}

// { campo: { from, to } } solo con los campos que cambiaron.
export function diff(before, after, keys) {
  const out = {};
  for (const key of keys) {
    const from = before ? before[key] ?? null : null;
    const to = after ? after[key] ?? null : null;
    if (JSON.stringify(from) !== JSON.stringify(to)) out[key] = { from, to };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Validación de entrada
// ---------------------------------------------------------------------------

export function text(value, label, { max = 200, required = false } = {}) {
  const out = value === undefined || value === null ? '' : String(value).trim();
  if (required && !out) throw new ValidationError(label + ' es obligatorio');
  if (out.length > max) throw new ValidationError(label + ' admite hasta ' + max + ' caracteres');
  return out;
}

export function number(value, label, { min, max, integer = false, required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new ValidationError(label + ' es obligatorio');
    return null;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) throw new ValidationError(label + ' debe ser un número');
  if (integer && !Number.isInteger(n)) throw new ValidationError(label + ' debe ser un número entero');
  if (min !== undefined && n < min) throw new ValidationError(label + ' debe ser mayor o igual a ' + min);
  if (max !== undefined && n > max) throw new ValidationError(label + ' debe ser menor o igual a ' + max);
  return n;
}

export function dateTime(value, label) {
  if (value === undefined || value === null || value === '') return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new ValidationError(label + ' no es una fecha válida');
  return d.toISOString();
}

export function dateOnly(value, label) {
  if (value === undefined || value === null || value === '') return null;
  const raw = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(new Date(raw).getTime())) {
    throw new ValidationError(label + ' no es una fecha válida');
  }
  return raw;
}

export function oneOf(value, list, label, fallback) {
  if (value === undefined || value === null || value === '') {
    if (fallback !== undefined) return fallback;
    throw new ValidationError(label + ' es obligatorio');
  }
  if (!list.includes(value)) throw new ValidationError(label + ' no es válido');
  return value;
}

export function id(value, label) {
  const out = text(value, label, { max: 64, required: true });
  if (!/^[\w-]+$/.test(out)) throw new ValidationError(label + ' no es válido');
  return out;
}

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------

// Lee un registro y devuelve null si no existe (el SDK lanza error en ese caso).
export async function getRecord(db, entityName, recordId) {
  if (!recordId) return null;
  try {
    return await db[entityName].get(recordId);
  } catch (e) {
    return null;
  }
}

// Trae todas las páginas de una consulta (hasta `max` registros).
export async function fetchAll(db, entityName, query, { sort, max = 20000 } = {}) {
  const out = [];
  let cursor = null;
  do {
    const page = await db[entityName].filter(query || {}, cursor ? { cursor, limit: 5000 } : { sort, limit: 5000 });
    out.push(...unwrap(page));
    cursor = page && page.has_more ? page.next_cursor : null;
  } while (cursor && out.length < max);
  return out;
}

export function currentYearAR() {
  return Number(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
    }).format(new Date())
  );
}

export function formatWorkOrderCode(year, number) {
  return 'OT-' + year + '-' + String(number).padStart(4, '0');
}

// Reserva el próximo número correlativo del año de forma segura ante ejecuciones simultáneas.
export async function reserveWorkOrderCode(db) {
  const year = currentYearAR();
  let counters = unwrap(await db.WorkOrderCounter.filter({ year }));
  if (!counters.length) {
    const existing = unwrap(
      await db.WorkOrder.filter({ code: { $regex: '^OT-' + year + '-' } }, { limit: 5000 })
    );
    let max = 0;
    for (const wo of existing) {
      const match = /-(\d+)$/.exec(wo.code || '');
      if (match) max = Math.max(max, Number(match[1]));
    }
    try {
      const created = await db.WorkOrderCounter.create({ year, last: max });
      counters = [created];
    } catch (e) {
      counters = unwrap(await db.WorkOrderCounter.filter({ year }));
    }
  }
  const counter = counters[0];
  if (!counter) throw new Error('No se pudo inicializar el contador de órdenes de trabajo');

  for (let attempt = 0; attempt < 20; attempt++) {
    const current = await db.WorkOrderCounter.get(counter.id);
    const last = Number(current.last || 0);
    const next = last + 1;
    await db.WorkOrderCounter.updateMany({ id: counter.id, last }, { $inc: { last: 1 } });
    const after = await db.WorkOrderCounter.get(counter.id);
    if (Number(after.last || 0) === next) return formatWorkOrderCode(year, next);
  }
  throw new Error('No se pudo reservar el código de la OT');
}

export function addFrequency(isoDate, type, value) {
  const base = isoDate ? new Date(isoDate) : new Date();
  const n = Number(value) || 1;
  const d = new Date(base.getTime());
  switch (type) {
    case 'DAILY':
      d.setUTCDate(d.getUTCDate() + n);
      break;
    case 'WEEKLY':
      d.setUTCDate(d.getUTCDate() + n * 7);
      break;
    case 'MONTHLY':
      d.setUTCMonth(d.getUTCMonth() + n);
      break;
    case 'QUARTERLY':
      d.setUTCMonth(d.getUTCMonth() + n * 3);
      break;
    case 'YEARLY':
      d.setUTCFullYear(d.getUTCFullYear() + n);
      break;
    default:
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
  }
  return d.toISOString();
}

// Aplica un cambio de stock de forma segura: nunca deja el stock negativo y
// dos ajustes simultáneos se suman. Devuelve { stock_after, previous, part } o { error }.
export async function applyStockChange(db, sparePartId, delta) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const part = await getRecord(db, 'SparePart', sparePartId);
    if (!part) return { error: 'Repuesto no encontrado' };
    const current = Number(part.stock_current || 0);
    if (current + delta < 0) {
      return { error: 'Stock insuficiente para ' + (part.name || 'el repuesto') + '. Actual: ' + current, current };
    }
    const filter = delta < 0
      ? { id: sparePartId, stock_current: { $gte: -delta } }
      : { id: sparePartId };
    await db.SparePart.updateMany(filter, { $inc: { stock_current: delta } });
    const after = await getRecord(db, 'SparePart', sparePartId);
    const stockAfter = Number(after ? after.stock_current || 0 : current);
    if (stockAfter !== current) {
      return { stock_after: stockAfter, part: after, previous: current };
    }
  }
  return { error: 'No se pudo actualizar el stock, intentá nuevamente' };
}

// ---------------------------------------------------------------------------
// Equipo y notificaciones
// ---------------------------------------------------------------------------

// Directorio del equipo: eleva privilegios porque la entidad User solo la pueden
// listar los administradores de plataforma. Email y teléfono solo para jefes y admins.
export async function teamDirectory(base44, { includeContact = false } = {}) {
  const users = unwrap(await base44.asServiceRole.entities.User.list());
  return users.map((u) => ({
    id: u.id,
    full_name: u.full_name || '',
    app_role: roleOf(u),
    active: isActive(u),
    ...(includeContact
      ? { email: u.email || '', phone: u.phone || '', created_date: u.created_date || null }
      : {}),
  }));
}

export async function getTeamMember(base44, userId) {
  if (!userId) return null;
  try {
    return await base44.asServiceRole.entities.User.get(userId);
  } catch (e) {
    return null;
  }
}

// Un técnico asignable: existe, está activo y es Operario nivel 2 o superior.
export async function assertAssignable(base44, userId) {
  const member = await getTeamMember(base44, userId);
  if (!member) throw new ValidationError('El técnico elegido no existe');
  if (!isActive(member)) throw new ValidationError('El técnico elegido está desactivado');
  if (rankOf(member) < ROLE_RANK.TECHNICIAN) throw new ValidationError('El usuario elegido no puede tener OTs asignadas');
  return member;
}

// Un técnico solo opera OTs sin asignar o asignadas a él; jefes y admins, cualquiera.
export function canOperate(user, workOrder) {
  if (rankOf(user) >= ROLE_RANK.SUPERVISOR) return true;
  return !workOrder.assigned_to_id || workOrder.assigned_to_id === user.id;
}

export async function notifyRoles(ctx, minRank, subject, body) {
  try {
    const users = unwrap(await ctx.db.User.list());
    const to = users
      .filter((u) => isActive(u) && rankOf(u) >= minRank && u.email)
      .map((u) => u.email);
    for (const email of to) {
      await ctx.base44.asServiceRole.integrations.Core.SendEmail({ to: email, subject, body });
    }
    logEvent('info', { fn: ctx.name, request_id: ctx.requestId, msg: 'notification_sent', subject, recipients: to.length });
  } catch (e) {
    logEvent('warn', { fn: ctx.name, request_id: ctx.requestId, msg: 'notification_failed', subject, error: e.message });
  }
}

// Avisa a jefes y admins cuando un movimiento deja el repuesto bajo el mínimo.
export async function checkLowStock(ctx, part, previous, after) {
  const minimum = Number(part && part.stock_minimum);
  if (!part || !Number.isFinite(minimum) || minimum <= 0) return;
  if (previous >= minimum && after < minimum) {
    await notifyRoles(
      ctx,
      ROLE_RANK.SUPERVISOR,
      'AuGmao: stock bajo mínimo - ' + part.code,
      'El repuesto ' + part.code + ' - ' + part.name + ' quedó con ' + after +
        ' unidades (mínimo ' + minimum + ').' + (part.supplier ? '\nProveedor: ' + part.supplier : '')
    );
  }
}

// Reserva el plan (para no duplicar OTs si la tarea corre dos veces) y genera la OT.
export async function runPlanNow(ctx, plan) {
  const db = ctx.db;
  const previous = plan.next_run_at || new Date().toISOString();
  const nowIso = new Date().toISOString();
  const nextRun = addFrequency(previous, plan.frequency_type, plan.frequency_value);

  await db.MaintenancePlan.updateMany(
    { id: plan.id, next_run_at: plan.next_run_at || null },
    { $set: { last_run_at: nowIso, next_run_at: nextRun } }
  );
  const after = await getRecord(db, 'MaintenancePlan', plan.id);
  const storedNext = after && after.next_run_at ? new Date(after.next_run_at).getTime() : null;
  if (storedNext !== new Date(nextRun).getTime()) return null;

  const checklist = Array.isArray(plan.task_checklist) ? plan.task_checklist.filter(Boolean) : [];
  const description = checklist.length
    ? 'Checklist:\n' + checklist.map((t, i) => i + 1 + '. ' + t).join('\n')
    : plan.description || '';

  let assignee = null;
  if (plan.assigned_to_id) {
    const member = await getTeamMember(ctx.base44, plan.assigned_to_id);
    if (member && isActive(member) && rankOf(member) >= ROLE_RANK.TECHNICIAN) assignee = member;
  }

  const code = await reserveWorkOrderCode(db);
  const workOrder = await db.WorkOrder.create({
    code,
    type: 'PREVENTIVE',
    status: assignee ? 'ASSIGNED' : 'OPEN',
    priority: 'MEDIUM',
    title: 'PREVENTIVO - ' + plan.name,
    description,
    asset_id: plan.asset_id,
    maintenance_plan_id: plan.id,
    assigned_to_id: assignee ? assignee.id : null,
    assigned_to_name: assignee ? displayName(assignee) : null,
    scheduled_at: previous,
    estimated_minutes: plan.estimated_minutes || null,
    created_by_id: ctx.user ? ctx.user.id : null,
    created_by_name: ctx.user ? displayName(ctx.user) : 'Plan preventivo',
  });
  await audit(ctx, {
    action: 'workorder.create',
    entity: 'WorkOrder',
    entityId: workOrder.id,
    summary: workOrder.code + ' generada por el plan ' + plan.name,
  });
  return workOrder;
}
