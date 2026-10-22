import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireUser, errorResponse, reserveWorkOrderCode, resolveUserName } from '../../shared/guards.ts';

const TYPES = ['CORRECTIVE', 'PREVENTIVE', 'PREDICTIVE', 'INSPECTION'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const { user, denied } = await requireUser(base44, 2);
    if (denied) return denied;

    const body = await req.json().catch(() => ({}));
    const title = String(body.title || '').trim();
    if (!title) return errorResponse('El título es obligatorio');
    if (!body.asset_id) return errorResponse('El activo es obligatorio');

    const type = TYPES.includes(body.type) ? body.type : 'CORRECTIVE';
    const priority = PRIORITIES.includes(body.priority) ? body.priority : 'MEDIUM';
    const estimated = body.estimated_minutes === '' || body.estimated_minutes === null || body.estimated_minutes === undefined
      ? null
      : Number(body.estimated_minutes);

    const code = await reserveWorkOrderCode(base44);
    const assignedName = body.assigned_to_id ? await resolveUserName(base44, body.assigned_to_id) : null;

    const workOrder = await base44.entities.WorkOrder.create({
      code,
      title,
      type,
      priority,
      status: body.assigned_to_id ? 'ASSIGNED' : 'OPEN',
      description: body.description || '',
      asset_id: body.asset_id,
      assigned_to_id: body.assigned_to_id || null,
      assigned_to_name: assignedName || null,
      scheduled_at: body.scheduled_at || null,
      estimated_minutes: estimated,
    });

    return Response.json({ workOrder });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}