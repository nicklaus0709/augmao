import {
  defineFunction, getRecord, unwrap, audit, canOperate, deny, number, id, ROLE_RANK, OPEN_STATUSES,
} from '../../shared/guards.ts';

// Repuestos previstos para una OT. El stock se descuenta recién al cerrarla.
export default defineFunction('workOrderParts', async (ctx) => {
  const denied = await ctx.requireUser(ROLE_RANK.TECHNICIAN);
  if (denied) return denied;

  const action = ctx.body.action;
  const workOrder = await getRecord(ctx.db, 'WorkOrder', id(ctx.body.work_order_id, 'La orden de trabajo'));
  if (!workOrder) return Response.json({ error: 'No se encontró la orden de trabajo' }, { status: 404 });
  ctx.fields.work_order = workOrder.code;
  if (!OPEN_STATUSES.includes(workOrder.status)) {
    return Response.json({ error: 'La OT está cerrada' }, { status: 409 });
  }
  if (!canOperate(ctx.user, workOrder)) return deny(ctx, 'OT asignada a otro técnico', 'La OT está asignada a otro técnico');

  if (action === 'upsert') {
    const spare = await getRecord(ctx.db, 'SparePart', id(ctx.body.spare_part_id, 'El repuesto'));
    if (!spare) return Response.json({ error: 'El repuesto no existe' }, { status: 400 });
    const quantity = number(ctx.body.quantity, 'La cantidad', { min: 0.001, max: 100000, required: true });

    const existing = unwrap(
      await ctx.db.WorkOrderPart.filter({ work_order_id: workOrder.id, spare_part_id: spare.id }, { limit: 1 })
    )[0];
    const data = { quantity_used: quantity, unit_cost: spare.unit_cost ?? null };
    const part = existing
      ? await ctx.db.WorkOrderPart.update(existing.id, data)
      : await ctx.db.WorkOrderPart.create({ work_order_id: workOrder.id, spare_part_id: spare.id, ...data });

    await audit(ctx, {
      action: 'workorder.part',
      entity: 'WorkOrder',
      entityId: workOrder.id,
      summary: spare.code + ': ' + quantity + (existing ? ' (antes ' + existing.quantity_used + ')' : ''),
    });
    return Response.json({ part });
  }

  if (action === 'remove') {
    const part = await getRecord(ctx.db, 'WorkOrderPart', id(ctx.body.part_id, 'El repuesto'));
    if (!part || part.work_order_id !== workOrder.id) return Response.json({ error: 'No se encontró el repuesto' }, { status: 404 });
    await ctx.db.WorkOrderPart.delete(part.id);
    const spare = await getRecord(ctx.db, 'SparePart', part.spare_part_id);
    await audit(ctx, {
      action: 'workorder.part_remove',
      entity: 'WorkOrder',
      entityId: workOrder.id,
      summary: 'Quitó ' + (spare ? spare.code : 'un repuesto') + ' (' + part.quantity_used + ')',
    });
    return Response.json({ ok: true });
  }

  return Response.json({ error: 'Acción desconocida' }, { status: 400 });
});
