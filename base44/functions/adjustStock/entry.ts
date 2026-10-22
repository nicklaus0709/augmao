import {
  defineFunction, getRecord, applyStockChange, checkLowStock, audit, displayName,
  text, number, id, ROLE_RANK, rankOf, deny,
} from '../../shared/guards.ts';

// Ajustes por encima de este volumen los aprueba un jefe de área.
const TECHNICIAN_MAX_ADJUSTMENT = 100;

export default defineFunction('adjustStock', async (ctx) => {
  const denied = await ctx.requireUser(ROLE_RANK.TECHNICIAN);
  if (denied) return denied;

  const sparePartId = id(ctx.body.spare_part_id, 'El repuesto');
  const quantity = number(ctx.body.quantity, 'La cantidad', { min: -1000000, max: 1000000, required: true });
  if (quantity === 0) return Response.json({ error: 'Ingresá una cantidad distinta de 0' }, { status: 400 });
  const reason = text(ctx.body.reason, 'El motivo', { max: 500, required: true });
  if (Math.abs(quantity) > TECHNICIAN_MAX_ADJUSTMENT && rankOf(ctx.user) < ROLE_RANK.SUPERVISOR) {
    return deny(ctx, 'Ajuste de stock grande', 'Los ajustes de más de ' + TECHNICIAN_MAX_ADJUSTMENT + ' unidades los hace un jefe de área');
  }

  let workOrderId = null;
  if (ctx.body.work_order_id) {
    const workOrder = await getRecord(ctx.db, 'WorkOrder', ctx.body.work_order_id);
    if (!workOrder) return Response.json({ error: 'La OT indicada no existe' }, { status: 400 });
    workOrderId = workOrder.id;
  }

  const result = await applyStockChange(ctx.db, sparePartId, quantity);
  if (result.error) return Response.json({ error: result.error }, { status: 409 });

  const type = quantity > 0 ? 'ENTRY' : 'EXIT';
  const movement = await ctx.db.StockMovement.create({
    spare_part_id: sparePartId,
    type,
    quantity: Math.abs(quantity),
    stock_after: result.stock_after,
    reason,
    work_order_id: workOrderId,
    user_id: ctx.user.id,
    user_name: displayName(ctx.user),
  });

  ctx.fields.spare_part = result.part.code;
  await audit(ctx, {
    action: 'stock.adjust',
    entity: 'SparePart',
    entityId: sparePartId,
    summary: (quantity > 0 ? 'Entrada de ' : 'Salida de ') + Math.abs(quantity) + ' en ' + result.part.code + ': ' + reason,
    changes: { stock_current: { from: result.previous, to: result.stock_after } },
  });
  await checkLowStock(ctx, result.part, result.previous, result.stock_after);

  return Response.json({ movement_id: movement.id, stock_after: result.stock_after, type });
});
