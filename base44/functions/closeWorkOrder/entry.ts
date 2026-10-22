import {
  defineFunction, getRecord, unwrap, applyStockChange, checkLowStock, audit, displayName,
  canOperate, deny, text, number, id, logEvent, ROLE_RANK,
} from '../../shared/guards.ts';

// Un cierre que quedó a medias (proceso caído) libera la OT pasado este tiempo.
const STALE_CLAIM_MS = 5 * 60 * 1000;

export default defineFunction('closeWorkOrder', async (ctx) => {
  const denied = await ctx.requireUser(ROLE_RANK.TECHNICIAN);
  if (denied) return denied;

  const body = ctx.body;
  const workOrderId = id(body.work_order_id, 'La orden de trabajo');
  const minutes = number(body.actual_minutes, 'El tiempo real', { min: 1, max: 100000, required: true });
  const failureCause = text(body.failure_cause, 'La causa de falla', { max: 1000 });
  const notes = [
    text(body.action_taken, 'La acción realizada', { max: 5000 }),
    text(body.observations, 'Las observaciones', { max: 5000 }),
  ].filter(Boolean);

  const db = ctx.db;
  const workOrder = await getRecord(db, 'WorkOrder', workOrderId);
  if (!workOrder) return Response.json({ error: 'No se encontró la orden de trabajo' }, { status: 404 });
  ctx.fields.work_order = workOrder.code;
  if (workOrder.status === 'COMPLETED') return Response.json({ error: 'La OT ya está cerrada' }, { status: 409 });
  if (workOrder.status === 'CANCELLED') return Response.json({ error: 'No se puede cerrar una OT cancelada' }, { status: 409 });
  if (!canOperate(ctx.user, workOrder)) return deny(ctx, 'OT asignada a otro técnico', 'La OT está asignada a otro técnico');

  // 1. Validar todo el stock antes de tocar nada.
  const parts = unwrap(await db.WorkOrderPart.filter({ work_order_id: workOrder.id }, { limit: 500 }))
    .filter((p) => Number(p.quantity_used || 0) > 0);
  const spareIds = [...new Set(parts.map((p) => p.spare_part_id).filter(Boolean))];
  const spares = spareIds.length ? unwrap(await db.SparePart.filter({ id: { $in: spareIds } }, { limit: 500 })) : [];
  const byId = Object.fromEntries(spares.map((s) => [s.id, s]));
  for (const part of parts) {
    const spare = byId[part.spare_part_id];
    if (spare && Number(spare.stock_current || 0) < Number(part.quantity_used)) {
      return Response.json({ error: 'Stock insuficiente para ' + spare.name }, { status: 409 });
    }
  }

  // 2. Reservar el cierre: solo un cierre simultáneo puede avanzar.
  const previousToken = workOrder.closing_token || null;
  if (previousToken && Date.now() - new Date(previousToken.split('|')[0]).getTime() < STALE_CLAIM_MS) {
    return Response.json({ error: 'La OT se está cerrando en este momento' }, { status: 409 });
  }
  const token = new Date().toISOString() + '|' + ctx.requestId;
  await db.WorkOrder.updateMany({ id: workOrder.id, closing_token: previousToken }, { $set: { closing_token: token } });
  const claimed = await getRecord(db, 'WorkOrder', workOrder.id);
  if (!claimed || claimed.closing_token !== token || claimed.status === 'COMPLETED') {
    return Response.json({ error: 'La OT se está cerrando en este momento' }, { status: 409 });
  }

  // 3. Descontar el stock. Si una salida falla, se revierten las ya aplicadas.
  const applied = [];
  for (const part of parts) {
    if (!byId[part.spare_part_id]) continue;
    const quantity = Number(part.quantity_used);
    const result = await applyStockChange(db, part.spare_part_id, -quantity);
    if (result.error) {
      for (const done of applied) {
        const undo = await applyStockChange(db, done.part.spare_part_id, done.quantity);
        if (undo.error) {
          logEvent('error', { fn: ctx.name, request_id: ctx.requestId, msg: 'stock_rollback_failed', spare_part_id: done.part.spare_part_id, quantity: done.quantity });
        }
      }
      await db.WorkOrder.update(workOrder.id, { closing_token: null });
      return Response.json({ error: result.error }, { status: 409 });
    }
    applied.push({ part, quantity, result });
  }

  // 4. Registrar las salidas y guardar el cierre.
  const now = new Date().toISOString();
  for (const { part, quantity, result } of applied) {
    await db.StockMovement.create({
      spare_part_id: part.spare_part_id,
      type: 'EXIT',
      quantity,
      stock_after: result.stock_after,
      reason: 'Cierre OT ' + workOrder.code,
      work_order_id: workOrder.id,
      user_id: ctx.user.id,
      user_name: displayName(ctx.user),
    });
    await checkLowStock(ctx, result.part, result.previous, result.stock_after);
  }

  const updated = await db.WorkOrder.update(workOrder.id, {
    status: 'COMPLETED',
    completed_at: now,
    actual_minutes: minutes,
    failure_cause: failureCause,
    closing_notes: notes.join('\n\n'),
    started_at: workOrder.started_at || now,
    closing_token: null,
  });

  ctx.fields.stock_moves = applied.length;
  await audit(ctx, {
    action: 'workorder.close',
    entity: 'WorkOrder',
    entityId: workOrder.id,
    summary: workOrder.code + ' cerrada (' + minutes + ' min, ' + applied.length + ' repuestos descontados)',
    changes: { status: { from: workOrder.status, to: 'COMPLETED' } },
  });

  return Response.json({ workOrder: updated });
});
