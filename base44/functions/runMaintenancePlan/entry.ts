import {
  defineFunction, unwrap, runPlanNow, getRecord, id, notifyRoles, logEvent, ROLE_RANK,
} from '../../shared/guards.ts';

export default defineFunction('runMaintenancePlan', async (ctx) => {
  // Proceso automático diario (workflow "Preventivos diarios").
  //
  // No exige usuario: el workflow programado puede invocar la función sin
  // sesión, y antes esa llamada se rechazaba en silencio. Es seguro porque solo
  // genera OTs de planes ya vencidos y la reserva del plan evita duplicados, así
  // que una llamada extra produce lo mismo que la ejecución programada.
  if (ctx.body.mode === 'due') {
    try {
      ctx.user = await ctx.base44.auth.me();
    } catch (e) {
      ctx.user = null;
    }
    const started = Date.now();
    // Límite para llamadas sin sesión: como mucho una ejecución cada 30 minutos.
    if (!ctx.user) {
      const last = unwrap(await ctx.db.JobRun.filter({ job: 'preventivos' }, { sort: '-started_at', limit: 1 }))[0];
      if (last && started - new Date(last.started_at).getTime() < 30 * 60 * 1000) {
        ctx.fields.skipped = true;
        return Response.json({ generated: 0, codes: [], status: 'SKIPPED' });
      }
    }
    const run = await ctx.db.JobRun.create({
      job: 'preventivos',
      trigger: ctx.user ? 'manual' : 'schedule',
      status: 'RUNNING',
      started_at: new Date(started).toISOString(),
      request_id: ctx.requestId,
    });

    const codes = [];
    const failures = [];
    try {
      const plans = unwrap(await ctx.db.MaintenancePlan.filter({ active: true }, { limit: 5000 }));
      const due = plans.filter((p) => p.next_run_at && new Date(p.next_run_at).getTime() <= started);
      for (const plan of due) {
        try {
          const workOrder = await runPlanNow(ctx, plan);
          if (workOrder) codes.push(workOrder.code);
        } catch (error) {
          failures.push(plan.name + ': ' + error.message);
          logEvent('error', { fn: ctx.name, request_id: ctx.requestId, msg: 'plan_failed', plan_id: plan.id, error: error.message });
        }
      }
    } catch (error) {
      failures.push(error.message);
    }

    const status = failures.length ? 'ERROR' : 'OK';
    await ctx.db.JobRun.update(run.id, {
      status,
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - started,
      generated: codes.length,
      codes,
      error: failures.length ? failures.join('\n').slice(0, 2000) : null,
    });
    ctx.fields.generated = codes.length;
    ctx.fields.failures = failures.length;

    if (failures.length) {
      await notifyRoles(
        ctx,
        ROLE_RANK.ADMIN,
        'AuGmao: falló la generación de preventivos',
        'La ejecución ' + ctx.requestId + ' generó ' + codes.length + ' OTs y tuvo ' + failures.length +
          ' errores:\n\n' + failures.join('\n')
      );
    }
    return Response.json({ generated: codes.length, codes, status });
  }

  // Ejecutar ahora desde la app: Jefe de área o superior.
  const denied = await ctx.requireUser(ROLE_RANK.SUPERVISOR);
  if (denied) return denied;
  const planId = id(ctx.body.plan_id, 'El plan');

  const plan = await getRecord(ctx.db, 'MaintenancePlan', planId);
  if (!plan) return Response.json({ error: 'No se encontró el plan de mantenimiento' }, { status: 404 });
  if (plan.active === false) return Response.json({ error: 'El plan está inactivo' }, { status: 409 });

  const workOrder = await runPlanNow(ctx, plan);
  if (!workOrder) return Response.json({ error: 'El plan ya fue ejecutado por otro proceso' }, { status: 409 });
  ctx.fields.work_order = workOrder.code;

  return Response.json({ workOrder });
});
