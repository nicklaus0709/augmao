import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireUser, errorResponse, resolveUserName, getRecord } from '../../shared/guards.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    const { denied } = await requireUser(base44, action === 'assign' ? 3 : 2);
    if (denied) return denied;

    if (!body.work_order_id) return errorResponse('Falta la orden de trabajo');
    const workOrder = await getRecord(base44, 'WorkOrder', body.work_order_id);
    if (!workOrder) return errorResponse('No se encontró la orden de trabajo', 404);
    if (workOrder.status === 'COMPLETED') return errorResponse('La OT ya está cerrada');
    if (workOrder.status === 'CANCELLED') return errorResponse('No se puede modificar una OT cancelada');

    if (action === 'assign') {
      if (!body.assigned_to_id) return errorResponse('Elegí un técnico');
      const assignedName = await resolveUserName(base44, body.assigned_to_id);
      await base44.entities.WorkOrder.update(workOrder.id, {
        assigned_to_id: body.assigned_to_id,
        assigned_to_name: assignedName || null,
        status: 'ASSIGNED',
      });
      return Response.json({ ok: true, status: 'ASSIGNED' });
    }

    if (action === 'start') {
      const patch = { status: 'IN_PROGRESS' };
      if (!workOrder.started_at) patch.started_at = new Date().toISOString();
      await base44.entities.WorkOrder.update(workOrder.id, patch);
      return Response.json({ ok: true, status: 'IN_PROGRESS', started_at: patch.started_at || workOrder.started_at });
    }

    if (action === 'pause') {
      if (workOrder.status !== 'IN_PROGRESS') return errorResponse('La OT no está en progreso');
      await base44.entities.WorkOrder.update(workOrder.id, { status: 'ON_HOLD' });
      return Response.json({ ok: true, status: 'ON_HOLD' });
    }

    return errorResponse('Acción desconocida');
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}