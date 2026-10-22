import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireUser, errorResponse, unwrap, applyStockChange, getRecord } from '../../shared/guards.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const { user, denied } = await requireUser(base44, 2);
    if (denied) return denied;

    const body = await req.json().catch(() => ({}));
    const workOrderId = body.work_order_id;
    if (!workOrderId) return errorResponse('Falta la orden de trabajo');

    const minutes = Number(body.actual_minutes);
    if (!minutes || minutes <= 0) return errorResponse('El tiempo real debe ser mayor a 0');

    const workOrder = await getRecord(base44, 'WorkOrder', workOrderId);
    if (!workOrder) return errorResponse('No se encontró la orden de trabajo', 404);
    if (workOrder.status === 'COMPLETED') return errorResponse('La OT ya está cerrada');
    if (workOrder.status === 'CANCELLED') return errorResponse('No se puede cerrar una OT cancelada');

    // 1. Validar todo el stock antes de tocar nada: el cierre es todo o nada.
    const parts = unwrap(await base44.entities.WorkOrderPart.filter({ work_order_id: workOrder.id }));
    const spareIds = [...new Set(parts.map((p) => p.spare_part_id).filter(Boolean))];
    const spares = spareIds.length
      ? unwrap(await base44.entities.SparePart.filter({ id: { $in: spareIds } }))
      : [];
    const byId = {};
    for (const spare of spares) byId[spare.id] = spare;
    for (const part of parts) {
      const spare = byId[part.spare_part_id];
      if (!spare) continue;
      if (Number(spare.stock_current || 0) < Number(part.quantity_used || 0)) {
        return errorResponse('Stock insuficiente para ' + spare.name);
      }
    }

    // 2. Reservar el cierre: solo un cierre simultáneo puede tener efecto.
    const token = new Date().toISOString();
    await base44.entities.WorkOrder.updateMany(
      { id: workOrder.id, status: { $ne: 'COMPLETED' } },
      { $set: { completed_at: token } }
    );
    const claimed = await getRecord(base44, 'WorkOrder', workOrder.id);
    if (!claimed || claimed.completed_at !== token) return errorResponse('La OT ya está cerrada');

    // 3. Descontar el stock y registrar cada salida.
    for (const part of parts) {
      const spare = byId[part.spare_part_id];
      if (!spare) continue;
      const quantity = Number(part.quantity_used || 0);
      if (quantity <= 0) continue;
      const result = await applyStockChange(base44, part.spare_part_id, -quantity);
      if (result.error) return errorResponse(result.error);
      await base44.entities.StockMovement.create({
        spare_part_id: part.spare_part_id,
        type: 'EXIT',
        quantity,
        stock_after: result.stock_after,
        reason: 'Cierre OT ' + workOrder.code,
        work_order_id: workOrder.id,
      });
    }

    // 4. Guardar los datos del cierre.
    const notes = [body.action_taken, body.observations].map((t) => String(t || '').trim()).filter(Boolean);
    const updated = await base44.entities.WorkOrder.update(workOrder.id, {
      status: 'COMPLETED',
      completed_at: token,
      actual_minutes: minutes,
      failure_cause: String(body.failure_cause || '').trim(),
      closing_notes: notes.join('\n\n'),
      started_at: workOrder.started_at || token,
    });

    return Response.json({ workOrder: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}