import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireUser, errorResponse, unwrap, runPlanNow, getRecord } from '../../shared/guards.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Proceso automático diario: solo lo puede disparar un administrador.
    if (body.mode === 'due') {
      const user = await base44.auth.me();
      if (!user) return errorResponse('No autorizado', 401);
      if (user.role !== 'admin') return errorResponse('No autorizado', 403);

      const plans = unwrap(await base44.entities.MaintenancePlan.filter({ active: true }, { limit: 200 }));
      const now = Date.now();
      const due = plans.filter((p) => p.next_run_at && new Date(p.next_run_at).getTime() <= now);

      const codes = [];
      for (const plan of due) {
        const workOrder = await runPlanNow(base44, plan);
        if (workOrder) codes.push(workOrder.code);
      }
      return Response.json({ generated: codes.length, codes });
    }

    // Ejecutar ahora desde la app: Jefe de área o superior.
    const { denied } = await requireUser(base44, 3);
    if (denied) return denied;
    if (!body.plan_id) return errorResponse('Falta el plan');

    const plan = await getRecord(base44, 'MaintenancePlan', body.plan_id);
    if (!plan) return errorResponse('No se encontró el plan de mantenimiento', 404);

    const workOrder = await runPlanNow(base44, plan);
    if (!workOrder) return errorResponse('El plan ya fue ejecutado por otro proceso');

    return Response.json({ workOrder });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}