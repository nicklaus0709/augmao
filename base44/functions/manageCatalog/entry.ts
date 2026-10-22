import {
  defineFunction, getRecord, unwrap, audit, diff, displayName, addFrequency,
  text, number, dateOnly, oneOf, id, assertAssignable, ROLE_RANK, ValidationError,
} from '../../shared/guards.ts';

const ASSET_CATEGORIES = ['MACHINERY', 'VEHICLE', 'ELECTRICAL', 'HVAC', 'FACILITY', 'IT_EQUIPMENT', 'OTHER'];
const ASSET_STATUSES = ['OPERATIONAL', 'UNDER_MAINTENANCE', 'OUT_OF_SERVICE', 'RETIRED'];
const UNITS = ['unit', 'liter', 'kg', 'meter', 'kit'];
const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'HOURS_OF_USE'];

async function assertUniqueCode(db, entity, code, currentId) {
  const existing = unwrap(await db[entity].filter({ code }, { limit: 5 }));
  if (existing.some((item) => item.id !== currentId)) {
    throw new ValidationError('El código ' + code + ' ya está en uso');
  }
}

// El padre no puede ser el mismo activo ni uno de sus descendientes.
async function assertValidParent(db, assetId, parentId) {
  if (!parentId) return null;
  if (parentId === assetId) throw new ValidationError('Un activo no puede ser su propio padre');
  let current = await getRecord(db, 'Asset', parentId);
  if (!current) throw new ValidationError('El activo padre no existe');
  if (!assetId) return parentId;
  for (let depth = 0; current && depth < 50; depth++) {
    if (current.parent_id === assetId) throw new ValidationError('El activo padre no puede ser un descendiente');
    current = current.parent_id ? await getRecord(db, 'Asset', current.parent_id) : null;
  }
  return parentId;
}

async function saveAsset(ctx, data, existing) {
  const payload = {
    code: text(data.code, 'El código', { max: 40, required: true }),
    name: text(data.name, 'El nombre', { max: 150, required: true }),
    category: oneOf(data.category, ASSET_CATEGORIES, 'La categoría', 'OTHER'),
    status: oneOf(data.status, ASSET_STATUSES, 'El estado', 'OPERATIONAL'),
    location: text(data.location, 'La ubicación', { max: 150, required: true }),
    manufacturer: text(data.manufacturer, 'El fabricante', { max: 100 }),
    model: text(data.model, 'El modelo', { max: 100 }),
    serial_number: text(data.serial_number, 'El número de serie', { max: 100 }),
    warranty_expires: dateOnly(data.warranty_expires, 'El vencimiento de garantía'),
    parent_id: await assertValidParent(ctx.db, existing ? existing.id : null, data.parent_id || null),
  };
  await assertUniqueCode(ctx.db, 'Asset', payload.code, existing && existing.id);
  return payload;
}

async function saveSparePart(ctx, data, existing) {
  const payload = {
    code: text(data.code, 'El código', { max: 40, required: true }),
    name: text(data.name, 'El nombre', { max: 150, required: true }),
    unit: oneOf(data.unit, UNITS, 'La unidad', 'unit'),
    stock_minimum: number(data.stock_minimum, 'El stock mínimo', { min: 0, max: 1000000 }) ?? 0,
    unit_cost: number(data.unit_cost, 'El costo unitario', { min: 0, max: 1e9 }),
    location: text(data.location, 'La ubicación', { max: 150 }),
    supplier: text(data.supplier, 'El proveedor', { max: 150 }),
  };
  if (payload.unit_cost !== null) payload.unit_cost = Number(payload.unit_cost.toFixed(2));
  // El stock solo cambia por movimientos (adjustStock / cierre de OT); al crear se toma el inicial.
  if (!existing) payload.stock_current = number(data.stock_current, 'El stock inicial', { min: 0, max: 1000000 }) ?? 0;
  await assertUniqueCode(ctx.db, 'SparePart', payload.code, existing && existing.id);
  return payload;
}

async function savePlan(ctx, data) {
  const asset = await getRecord(ctx.db, 'Asset', id(data.asset_id, 'El activo'));
  if (!asset) throw new ValidationError('El activo no existe');
  const frequencyType = oneOf(data.frequency_type, FREQUENCIES, 'La frecuencia', 'MONTHLY');
  const frequencyValue = number(data.frequency_value, 'El intervalo', { min: 1, max: 1000, integer: true }) ?? 1;
  const checklist = Array.isArray(data.task_checklist) ? data.task_checklist : [];
  if (checklist.length > 100) throw new ValidationError('El checklist admite hasta 100 tareas');
  let assignedTo = null;
  if (data.assigned_to_id) assignedTo = (await assertAssignable(ctx.base44, data.assigned_to_id)).id;
  const start = dateOnly(data.start_date, 'La fecha de inicio') || new Date().toISOString().slice(0, 10);
  return {
    name: text(data.name, 'El nombre del plan', { max: 150, required: true }),
    description: text(data.description, 'La descripción', { max: 5000 }),
    asset_id: asset.id,
    frequency_type: frequencyType,
    frequency_value: frequencyValue,
    estimated_minutes: number(data.estimated_minutes, 'El tiempo estimado', { min: 1, max: 100000 }),
    task_checklist: checklist.map((t, i) => text(t, 'La tarea ' + (i + 1), { max: 300 })).filter(Boolean),
    assigned_to_id: assignedTo,
    active: true,
    next_run_at: addFrequency(start, frequencyType, frequencyValue),
  };
}

const ENTITIES = {
  Asset: { save: saveAsset, label: (r) => r.code + ' - ' + r.name, canUpdate: true },
  SparePart: { save: saveSparePart, label: (r) => r.code + ' - ' + r.name, canUpdate: true },
  MaintenancePlan: { save: savePlan, label: (r) => r.name, canUpdate: false },
};

// Altas y modificaciones de activos, repuestos y planes: Jefe de área o superior.
export default defineFunction('manageCatalog', async (ctx) => {
  const denied = await ctx.requireUser(ROLE_RANK.SUPERVISOR);
  if (denied) return denied;

  const entity = ctx.body.entity;
  const config = ENTITIES[entity];
  if (!config) throw new ValidationError('Entidad no válida');
  const action = ctx.body.action;
  const data = ctx.body.data && typeof ctx.body.data === 'object' ? ctx.body.data : {};
  const prefix = entity.charAt(0).toLowerCase() + entity.slice(1);

  if (action === 'create') {
    const payload = await config.save(ctx, data, null);
    const record = await ctx.db[entity].create(payload);
    if (entity === 'SparePart' && payload.stock_current > 0) {
      await ctx.db.StockMovement.create({
        spare_part_id: record.id,
        type: 'ENTRY',
        quantity: payload.stock_current,
        stock_after: payload.stock_current,
        reason: 'Stock inicial',
        user_id: ctx.user.id,
        user_name: displayName(ctx.user),
      });
    }
    await audit(ctx, { action: prefix + '.create', entity, entityId: record.id, summary: 'Alta de ' + config.label(record) });
    return Response.json({ record });
  }

  if (action === 'update' && config.canUpdate) {
    const existing = await getRecord(ctx.db, entity, id(ctx.body.id, 'El registro'));
    if (!existing) return Response.json({ error: 'No se encontró el registro' }, { status: 404 });
    const payload = await config.save(ctx, data, existing);
    const record = await ctx.db[entity].update(existing.id, payload);
    await audit(ctx, {
      action: prefix + '.update',
      entity,
      entityId: existing.id,
      summary: 'Modificó ' + config.label(record),
      changes: diff(existing, record, Object.keys(payload)),
    });
    return Response.json({ record });
  }

  if (action === 'set_active' && entity === 'MaintenancePlan') {
    const existing = await getRecord(ctx.db, entity, id(ctx.body.id, 'El plan'));
    if (!existing) return Response.json({ error: 'No se encontró el plan' }, { status: 404 });
    const active = Boolean(ctx.body.active);
    const record = await ctx.db.MaintenancePlan.update(existing.id, { active });
    await audit(ctx, {
      action: 'maintenancePlan.' + (active ? 'activate' : 'deactivate'),
      entity,
      entityId: existing.id,
      summary: (active ? 'Activó ' : 'Desactivó ') + 'el plan ' + existing.name,
    });
    return Response.json({ record });
  }

  return Response.json({ error: 'Acción desconocida' }, { status: 400 });
});
