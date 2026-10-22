import {
  defineFunction, getRecord, assertAssignable, audit, displayName, canOperate, deny,
  text, id, ROLE_RANK, OPEN_STATUSES, notifyAssignment,
} from '../../shared/guards.ts';

// Transiciones válidas de la OT (el cierre está en closeWorkOrder).
const ACTIONS = {
  assign: { minRank: ROLE_RANK.SUPERVISOR, from: OPEN_STATUSES },
  start: { minRank: ROLE_RANK.TECHNICIAN, from: ['OPEN', 'ASSIGNED', 'ON_HOLD'] },
  pause: { minRank: ROLE_RANK.TECHNICIAN, from: ['IN_PROGRESS'] },
  cancel: { minRank: ROLE_RANK.SUPERVISOR, from: OPEN_STATUSES },
};

export default defineFunction('updateWorkOrderStatus', async (ctx) => {
  const action = ctx.body.action;
  const rule = ACTIONS[action];
  const denied = await ctx.requireUser(rule ? rule.minRank : ROLE_RANK.TECHNICIAN);
  if (denied) return denied;
  if (!rule) return Response.json({ error: 'Acción desconocida' }, { status: 400 });

  const workOrderId = id(ctx.body.work_order_id, 'La orden de trabajo');
  const workOrder = await getRecord(ctx.db, 'WorkOrder', workOrderId);
  if (!workOrder) return Response.json({ error: 'No se encontró la orden de trabajo' }, { status: 404 });
  ctx.fields.work_order = workOrder.code;

  if (workOrder.status === 'COMPLETED') return Response.json({ error: 'La OT ya está cerrada' }, { status: 409 });
  if (workOrder.status === 'CANCELLED') return Response.json({ error: 'La OT está cancelada' }, { status: 409 });
  if (!rule.from.includes(workOrder.status)) {
    return Response.json({ error: 'La OT no admite esta acción en su estado actual' }, { status: 409 });
  }
  if ((action === 'start' || action === 'pause') && !canOperate(ctx.user, workOrder)) {
    return deny(ctx, 'OT asignada a otro técnico', 'La OT está asignada a otro técnico');
  }

  let patch;
  let summary;
  let assignee = null;
  if (action === 'assign') {
    assignee = await assertAssignable(ctx.base44, ctx.body.assigned_to_id);
    patch = {
      assigned_to_id: assignee.id,
      assigned_to_name: displayName(assignee),
      status: workOrder.status === 'OPEN' ? 'ASSIGNED' : workOrder.status,
    };
    summary = 'Asignada a ' + displayName(assignee);
  } else if (action === 'start') {
    patch = { status: 'IN_PROGRESS' };
    if (!workOrder.started_at) patch.started_at = new Date().toISOString();
    // Un técnico que inicia una OT sin asignar la toma.
    if (!workOrder.assigned_to_id) {
      patch.assigned_to_id = ctx.user.id;
      patch.assigned_to_name = displayName(ctx.user);
    }
    summary = workOrder.status === 'ON_HOLD' ? 'Reanudada' : 'Iniciada';
  } else if (action === 'pause') {
    patch = { status: 'ON_HOLD' };
    summary = 'Pausada';
  } else {
    const reason = text(ctx.body.reason, 'El motivo', { max: 1000, required: true });
    patch = { status: 'CANCELLED', cancelled_at: new Date().toISOString(), cancel_reason: reason };
    summary = 'Cancelada: ' + reason;
  }

  const updated = await ctx.db.WorkOrder.update(workOrder.id, patch);
  await audit(ctx, {
    action: 'workorder.' + action,
    entity: 'WorkOrder',
    entityId: workOrder.id,
    summary: workOrder.code + ' ' + summary.charAt(0).toLowerCase() + summary.slice(1),
    changes: { status: { from: workOrder.status, to: patch.status } },
  });

  if (assignee && assignee.id !== workOrder.assigned_to_id) await notifyAssignment(ctx, assignee, updated);

  return Response.json({ ok: true, status: patch.status, workOrder: updated });
});
