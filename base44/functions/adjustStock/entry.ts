import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireUser, errorResponse, applyStockChange } from '../../shared/guards.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const { denied } = await requireUser(base44, 2);
    if (denied) return denied;

    const body = await req.json().catch(() => ({}));
    if (!body.spare_part_id) return errorResponse('Falta el repuesto');

    const quantity = Number(body.quantity);
    if (!quantity || Number.isNaN(quantity)) {
      return errorResponse('Ingresá una cantidad distinta de 0');
    }

    const result = await applyStockChange(base44, body.spare_part_id, quantity);
    if (result.error) return errorResponse(result.error);

    const movement = await base44.entities.StockMovement.create({
      spare_part_id: body.spare_part_id,
      type: quantity > 0 ? 'ENTRY' : 'EXIT',
      quantity: Math.abs(quantity),
      stock_after: result.stock_after,
      reason: String(body.reason || '').trim() || 'Ajuste manual',
      work_order_id: body.work_order_id || null,
    });

    return Response.json({
      movement_id: movement.id,
      stock_after: result.stock_after,
      type: quantity > 0 ? 'ENTRY' : 'EXIT',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}