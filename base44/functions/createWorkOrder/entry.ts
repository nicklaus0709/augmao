import {
  defineFunction, getRecord, reserveWorkOrderCode, assertAssignable, audit, displayName,
  text, number, dateTime, oneOf, id, ROLE_RANK, rankOf, deny, notifyAssignment,
} from '../../shared/guards.ts';

const TYPES = ['CORRECTIVE', 'PREVENTIVE', 'PREDICTIVE', 'INSPECTION'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export default defineFunction('createWorkOrder', async (ctx) => {
  const denied = await ctx.requireUser(ROLE_RANK.TECHNICIAN);
  if (denied) return denied;

  const body = ctx.body;
  const title = text(body.title, 'El título', { max: 150, required: true });
  const assetId = id(body.asset_id, 'El activo');
  const description = text(body.description, 'La descripción', { max: 5000 });
  const type = oneOf(body.type, TYPES, 'El tipo', 'CORRECTIVE');
  const priority = oneOf(body.priority, PRIORITIES, 'La prioridad', 'MEDIUM');
  const estimated = number(body.estimated_minutes, 'El tiempo estimado', { min: 1, max: 100000 });
  const scheduledAt = dateTime(body.scheduled_at, 'La fecha programada');

  const asset = await getRecord(ctx.db, 'Asset', assetId);
  if (!asset) return Response.json({ error: 'El activo no existe' }, { status: 400 });

  // Asignar al crear es decisión de un jefe; un técnico solo puede tomarla él mismo.
  let assignee = null;
  if (body.assigned_to_id) {
    if (rankOf(ctx.user) < ROLE_RANK.SUPERVISOR && body.assigned_to_id !== ctx.user.id) {
      return deny(ctx, 'Técnico asignando a otro usuario', 'Solo un jefe de área puede asignar a otro técnico');
    }
    assignee = await assertAssignable(ctx.base44, body.assigned_to_id);
  }

  const code = await reserveWorkOrderCode(ctx.db);
  const workOrder = await ctx.db.WorkOrder.create({
    code,
    title,
    type,
    priority,
    status: assignee ? 'ASSIGNED' : 'OPEN',
    description,
    asset_id: asset.id,
    assigned_to_id: assignee ? assignee.id : null,
    assigned_to_name: assignee ? displayName(assignee) : null,
    scheduled_at: scheduledAt,
    estimated_minutes: estimated,
    created_by_id: ctx.user.id,
    created_by_name: displayName(ctx.user),
  });

  ctx.fields.work_order = workOrder.code;
  await audit(ctx, {
    action: 'workorder.create',
    entity: 'WorkOrder',
    entityId: workOrder.id,
    summary: workOrder.code + ' creada sobre ' + asset.code + (assignee ? ', asignada a ' + displayName(assignee) : ''),
  });

  await notifyAssignment(ctx, assignee, workOrder);

  return Response.json({ workOrder });
});
