import {
  defineFunction, getRecord, audit, deny, displayName, text, id, rankOf, ROLE_RANK,
} from '../../shared/guards.ts';

// El autor sale de la sesión, nunca del cuerpo de la petición.
export default defineFunction('workOrderComments', async (ctx) => {
  const denied = await ctx.requireUser(ROLE_RANK.VIEWER);
  if (denied) return denied;

  if (ctx.body.action === 'add') {
    const workOrder = await getRecord(ctx.db, 'WorkOrder', id(ctx.body.work_order_id, 'La orden de trabajo'));
    if (!workOrder) return Response.json({ error: 'No se encontró la orden de trabajo' }, { status: 404 });
    const content = text(ctx.body.content, 'El comentario', { max: 2000, required: true });
    const comment = await ctx.db.WorkOrderComment.create({
      work_order_id: workOrder.id,
      user_id: ctx.user.id,
      user_name: displayName(ctx.user) || 'Usuario',
      content,
    });
    ctx.fields.work_order = workOrder.code;
    return Response.json({ comment });
  }

  if (ctx.body.action === 'delete') {
    const comment = await getRecord(ctx.db, 'WorkOrderComment', id(ctx.body.comment_id, 'El comentario'));
    if (!comment) return Response.json({ error: 'No se encontró el comentario' }, { status: 404 });
    const own = comment.user_id && comment.user_id === ctx.user.id;
    if (!own && rankOf(ctx.user) < ROLE_RANK.SUPERVISOR) {
      return deny(ctx, 'Borrar comentario ajeno', 'Solo podés borrar tus propios comentarios');
    }
    await ctx.db.WorkOrderComment.delete(comment.id);
    await audit(ctx, {
      action: 'comment.delete',
      entity: 'WorkOrder',
      entityId: comment.work_order_id,
      summary: 'Borró un comentario de ' + (comment.user_name || 'un usuario'),
    });
    return Response.json({ ok: true });
  }

  return Response.json({ error: 'Acción desconocida' }, { status: 400 });
});
