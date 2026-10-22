import { defineFunction, unwrap, fetchAll, ROLE_RANK, OPEN_STATUSES } from '../../shared/guards.ts';

const HOUR = 3600 * 1000;
// El workflow corre a diario a las 06:00: más de 26 h sin ejecución exitosa es una alerta.
const PREVENTIVE_STALE_MS = 26 * HOUR;

// Tablero de salud para administradores: tareas programadas, errores, accesos
// denegados y señales operativas que nadie más vigila.
export default defineFunction('systemHealth', async (ctx) => {
  const denied = await ctx.requireUser(ROLE_RANK.ADMIN);
  if (denied) return denied;

  const db = ctx.db;
  const now = Date.now();
  const since = new Date(now - 24 * HOUR).toISOString();

  const [jobs, events, parts, openOrders, plans, auditLog] = await Promise.all([
    db.JobRun.filter({ job: 'preventivos' }, { sort: '-started_at', limit: 10 }).then(unwrap),
    fetchAll(db, 'ErrorEvent', { created_date: { $gte: since } }, { sort: '-created_date', max: 5000 }),
    fetchAll(db, 'SparePart', {}, { sort: 'code' }),
    fetchAll(db, 'WorkOrder', { status: { $in: OPEN_STATUSES } }, { sort: 'scheduled_at' }),
    fetchAll(db, 'MaintenancePlan', { active: true }, { sort: 'next_run_at' }),
    db.AuditLog.filter({}, { sort: '-created_date', limit: 25 }).then(unwrap),
  ]);

  const lastOk = jobs.find((j) => j.status === 'OK');
  const lastOkAt = lastOk ? new Date(lastOk.finished_at || lastOk.started_at).getTime() : null;

  const groups = {};
  for (const e of events) {
    const key = e.source + '|' + (e.level || 'error') + '|' + (e.fn || '-');
    if (!groups[key]) {
      groups[key] = { source: e.source, level: e.level || 'error', fn: e.fn || '-', count: 0, last_at: e.created_date, last_message: e.message };
    }
    groups[key].count += 1;
  }

  const lowStock = parts
    .filter((p) => Number(p.stock_minimum || 0) > 0 && Number(p.stock_current || 0) < Number(p.stock_minimum))
    .map((p) => ({ id: p.id, code: p.code, name: p.name, stock_current: Number(p.stock_current || 0), stock_minimum: Number(p.stock_minimum) }));

  const overdue = openOrders.filter((wo) => wo.scheduled_at && new Date(wo.scheduled_at).getTime() < now);
  const stuck = openOrders.filter(
    (wo) => wo.status === 'IN_PROGRESS' && wo.started_at && now - new Date(wo.started_at).getTime() > 48 * HOUR
  );
  const overduePlans = plans.filter((p) => p.next_run_at && now - new Date(p.next_run_at).getTime() > 24 * HOUR);
  const pick = (wo) => ({ id: wo.id, code: wo.code, title: wo.title, status: wo.status, scheduled_at: wo.scheduled_at, started_at: wo.started_at, assigned_to_name: wo.assigned_to_name });

  return Response.json({
    generated_at: new Date(now).toISOString(),
    preventives: {
      last_ok_at: lastOkAt ? new Date(lastOkAt).toISOString() : null,
      stale: !lastOkAt || now - lastOkAt > PREVENTIVE_STALE_MS,
      runs: jobs,
      overdue_plans: overduePlans.map((p) => ({ id: p.id, name: p.name, next_run_at: p.next_run_at })),
    },
    errors: {
      total: events.filter((e) => e.level !== 'denied').length,
      denied: events.filter((e) => e.level === 'denied').length,
      groups: Object.values(groups).sort((a, b) => b.count - a.count),
      recent: events.slice(0, 20),
    },
    operations: {
      low_stock: lowStock,
      overdue_work_orders: overdue.slice(0, 50).map(pick),
      overdue_count: overdue.length,
      stuck_work_orders: stuck.slice(0, 50).map(pick),
      open_count: openOrders.length,
    },
    audit: auditLog,
  });
});
