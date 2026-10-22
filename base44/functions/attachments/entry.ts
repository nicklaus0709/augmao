import {
  defineFunction, getRecord, audit, deny, displayName, text, number, oneOf, id,
  rankOf, ROLE_RANK, OPEN_STATUSES, ValidationError,
} from '../../shared/guards.ts';

// Mantener en sincronía con src/lib/constants.js.
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ATTACHMENT_TYPES = [
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'application/pdf', 'text/plain', 'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
const RECEIPT_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
const MOVEMENT_KINDS = ['INVOICE', 'DELIVERY_NOTE', 'OTHER'];

// target -> entidad del adjunto, campo que lo vincula y entidad dueña.
const TARGETS = {
  work_order: { entity: 'WorkOrderAttachment', field: 'work_order_id', parent: 'WorkOrder', types: ATTACHMENT_TYPES },
  asset: { entity: 'AssetAttachment', field: 'asset_id', parent: 'Asset', types: ATTACHMENT_TYPES },
  movement: { entity: 'StockMovementAttachment', field: 'movement_id', parent: 'StockMovement', types: RECEIPT_TYPES },
};

// Registra un archivo ya subido con UploadPrivateFile. El tipo y el tamaño los
// declara el cliente: se validan acá para que la regla no dependa de la UI.
export default defineFunction('attachments', async (ctx) => {
  const denied = await ctx.requireUser(ROLE_RANK.TECHNICIAN);
  if (denied) return denied;

  const target = TARGETS[ctx.body.target];
  if (!target) throw new ValidationError('Tipo de adjunto no válido');

  if (ctx.body.action === 'create') {
    const parent = await getRecord(ctx.db, target.parent, id(ctx.body.record_id, 'El registro'));
    if (!parent) return Response.json({ error: 'No se encontró el registro' }, { status: 404 });
    if (target.parent === 'WorkOrder' && !OPEN_STATUSES.includes(parent.status)) {
      return Response.json({ error: 'La OT está cerrada' }, { status: 409 });
    }
    const fileType = oneOf(ctx.body.file_type, target.types, 'El tipo de archivo');
    const size = number(ctx.body.size_bytes, 'El tamaño', { min: 1, max: MAX_FILE_SIZE, integer: true, required: true });
    const fileUri = text(ctx.body.file_uri, 'El archivo', { max: 500, required: true });
    if (/^[a-z]+:\/\//i.test(fileUri)) throw new ValidationError('El archivo no es válido');
    const fileName = text(ctx.body.file_name, 'El nombre del archivo', { max: 200, required: true }).replace(/[\\/]/g, '_');

    const record = await ctx.db[target.entity].create({
      [target.field]: parent.id,
      file_name: fileName,
      file_uri: fileUri,
      file_type: fileType,
      size_bytes: size,
      uploaded_by_id: ctx.user.id,
      uploaded_by_name: displayName(ctx.user),
      ...(target.entity === 'StockMovementAttachment' ? { kind: oneOf(ctx.body.kind, MOVEMENT_KINDS, 'El tipo de comprobante', 'OTHER') } : {}),
    });
    await audit(ctx, {
      action: 'attachment.create',
      entity: target.parent,
      entityId: parent.id,
      summary: 'Adjuntó ' + fileName,
    });
    return Response.json({ attachment: record });
  }

  if (ctx.body.action === 'delete') {
    if (rankOf(ctx.user) < ROLE_RANK.SUPERVISOR) return deny(ctx, 'Borrar adjunto', 'Solo un jefe de área puede borrar adjuntos');
    const record = await getRecord(ctx.db, target.entity, id(ctx.body.id, 'El adjunto'));
    if (!record) return Response.json({ error: 'No se encontró el adjunto' }, { status: 404 });
    await ctx.db[target.entity].delete(record.id);
    await audit(ctx, {
      action: 'attachment.delete',
      entity: target.parent,
      entityId: record[target.field],
      summary: 'Borró el adjunto ' + record.file_name,
    });
    return Response.json({ ok: true });
  }

  return Response.json({ error: 'Acción desconocida' }, { status: 400 });
});
