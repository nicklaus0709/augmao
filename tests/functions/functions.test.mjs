// Pruebas de las funciones de backend contra un SDK simulado.
// Ejecutar con: npm run test:functions
import test from 'node:test';
import assert from 'node:assert/strict';
import { store, sentEmails } from './mock-sdk.mjs';

const USERS = {
  admin: { id: 'u_admin', full_name: 'Ana Admin', email: 'ana@planta.test', role: 'user', app_role: 'ADMIN', active: true },
  sup: { id: 'u_sup', full_name: 'Sole Jefa', email: 'sole@planta.test', role: 'user', app_role: 'SUPERVISOR', active: true },
  tech: { id: 'u_tech', full_name: 'Tomi Técnico', email: 'tomi@planta.test', role: 'user', app_role: 'TECHNICIAN', active: true },
  tech2: { id: 'u_tech2', full_name: 'Otro Técnico', email: 'otro@planta.test', role: 'user', app_role: 'TECHNICIAN', active: true },
  viewer: { id: 'u_view', full_name: 'Vero Operaria', email: 'vero@planta.test', role: 'user', app_role: 'VIEWER', active: true },
  noRole: { id: 'u_norole', full_name: 'Sin Rol', email: 'sinrol@planta.test', role: 'user', active: true },
  inactive: { id: 'u_off', full_name: 'Dado de Baja', email: 'baja@planta.test', role: 'user', app_role: 'TECHNICIAN', active: false },
};
store.User = Object.values(USERS).map((u) => ({ ...u }));

const logLines = [];
for (const method of ['log', 'warn', 'error']) console[method] = (line) => logLines.push(line);

async function call(fnName, user, body) {
  const { default: handler } = await import('../../base44/functions/' + fnName + '/entry.ts');
  const headers = user ? { 'x-user': JSON.stringify(user) } : {};
  const res = await handler(new Request('http://local', { method: 'POST', headers, body: JSON.stringify(body) }));
  return { status: res.status, data: await res.json(), requestId: res.headers.get('x-request-id') };
}

const state = {};
const stockOf = (id) => store.SparePart.find((p) => p.id === id).stock_current;

test('catálogo: solo jefes y admins, códigos únicos, sin ciclos de activos', async () => {
  assert.equal((await call('manageCatalog', USERS.tech, { entity: 'Asset', action: 'create', data: { code: 'P1', name: 'Bomba', location: 'Planta' } })).status, 403);

  let r = await call('manageCatalog', USERS.sup, { entity: 'Asset', action: 'create', data: { code: 'P1', name: 'Bomba', location: 'Planta', category: 'MACHINERY' } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  state.asset = r.data.record;

  r = await call('manageCatalog', USERS.sup, { entity: 'Asset', action: 'create', data: { code: 'P1', name: 'Otra', location: 'x' } });
  assert.equal(r.status, 400);
  assert.match(r.data.error, /en uso/);

  r = await call('manageCatalog', USERS.sup, { entity: 'Asset', action: 'create', data: { code: 'P2', name: 'Motor', location: 'x', parent_id: state.asset.id } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  r = await call('manageCatalog', USERS.sup, { entity: 'Asset', action: 'update', id: state.asset.id, data: { code: 'P1', name: 'Bomba', location: 'x', parent_id: r.data.record.id } });
  assert.equal(r.status, 400);
  assert.match(r.data.error, /descendiente/);
});

test('repuestos: el stock inicial genera movimiento y la edición no toca el stock', async () => {
  let r = await call('manageCatalog', USERS.sup, { entity: 'SparePart', action: 'create', data: { code: 'R1', name: 'Filtro', stock_current: 10, stock_minimum: 5, unit_cost: 3.456 } });
  assert.equal(r.status, 200);
  state.filter = r.data.record;
  assert.equal(state.filter.unit_cost, 3.46);
  assert.equal(store.StockMovement.filter((m) => m.spare_part_id === state.filter.id).length, 1);

  r = await call('manageCatalog', USERS.sup, { entity: 'SparePart', action: 'update', id: state.filter.id, data: { code: 'R1', name: 'Filtro', stock_current: 999, stock_minimum: 5 } });
  assert.equal(r.data.record.stock_current, 10);

  r = await call('manageCatalog', USERS.sup, { entity: 'SparePart', action: 'create', data: { code: 'R2', name: 'Correa', stock_current: 1, stock_minimum: 0 } });
  state.belt = r.data.record;
});

test('crear OT: roles, usuarios desactivados, validación y asignación', async () => {
  const asset_id = state.asset.id;
  assert.equal((await call('createWorkOrder', null, { title: 'x', asset_id })).status, 401);
  assert.equal((await call('createWorkOrder', USERS.viewer, { title: 'x', asset_id })).status, 403);
  assert.equal((await call('createWorkOrder', USERS.noRole, { title: 'x', asset_id })).status, 403, 'sin rol cuenta como Operario nivel 1');
  assert.equal((await call('createWorkOrder', USERS.inactive, { title: 'x', asset_id })).status, 403);
  assert.equal((await call('createWorkOrder', USERS.tech, { title: '', asset_id })).status, 400);
  assert.equal((await call('createWorkOrder', USERS.tech, { title: 'x', asset_id, assigned_to_id: USERS.tech2.id })).status, 403);

  let r = await call('createWorkOrder', USERS.sup, { title: 'Pierde aceite', asset_id, assigned_to_id: USERS.viewer.id });
  assert.equal(r.status, 400);

  r = await call('createWorkOrder', USERS.sup, { title: 'Pierde aceite', asset_id, assigned_to_id: USERS.tech.id, estimated_minutes: '60' });
  assert.equal(r.status, 200);
  state.wo = r.data.workOrder;
  assert.match(state.wo.code, /^OT-\d{4}-0001$/);
  assert.equal(state.wo.created_by_name, 'Sole Jefa');
  assert.equal(state.wo.status, 'ASSIGNED');
  assert.equal(sentEmails.at(-1).to, 'tomi@planta.test', 'el técnico recibe el aviso de asignación');
  sentEmails.length = 0;

  r = await call('createWorkOrder', USERS.tech, { title: 'Ruido', asset_id });
  state.wo2 = r.data.workOrder;
  assert.match(state.wo2.code, /-0002$/);
});

test('estados: solo el técnico asignado opera, cancelar requiere jefe y motivo', async () => {
  assert.equal((await call('updateWorkOrderStatus', USERS.tech2, { action: 'start', work_order_id: state.wo.id })).status, 403);
  assert.equal((await call('updateWorkOrderStatus', USERS.tech, { action: 'pause', work_order_id: state.wo.id })).status, 409);
  assert.equal((await call('updateWorkOrderStatus', USERS.tech, { action: 'start', work_order_id: state.wo.id })).status, 200);

  assert.equal((await call('updateWorkOrderStatus', USERS.tech2, { action: 'start', work_order_id: state.wo2.id })).status, 200);
  assert.equal(store.WorkOrder.find((w) => w.id === state.wo2.id).assigned_to_id, USERS.tech2.id, 'quien inicia una OT libre la toma');

  assert.equal((await call('updateWorkOrderStatus', USERS.tech, { action: 'cancel', work_order_id: state.wo2.id, reason: 'x' })).status, 403);
  assert.equal((await call('updateWorkOrderStatus', USERS.sup, { action: 'cancel', work_order_id: state.wo2.id })).status, 400);
  assert.equal((await call('updateWorkOrderStatus', USERS.sup, { action: 'cancel', work_order_id: state.wo2.id, reason: 'Duplicada' })).status, 200);
  assert.equal(store.WorkOrder.find((w) => w.id === state.wo2.id).status, 'CANCELLED');
});

test('cierre: descuenta stock, avisa stock bajo y no se repite', async () => {
  await call('workOrderParts', USERS.tech, { action: 'upsert', work_order_id: state.wo.id, spare_part_id: state.filter.id, quantity: 6 });
  assert.equal((await call('workOrderParts', USERS.tech2, { action: 'upsert', work_order_id: state.wo.id, spare_part_id: state.belt.id, quantity: 1 })).status, 403);
  assert.equal((await call('workOrderParts', USERS.tech, { action: 'upsert', work_order_id: state.wo.id, spare_part_id: state.belt.id, quantity: 1 })).status, 200);

  const r = await call('closeWorkOrder', USERS.tech, { work_order_id: state.wo.id, actual_minutes: 30, action_taken: 'Cambio de filtro' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(stockOf(state.filter.id), 4);
  assert.equal(stockOf(state.belt.id), 0);
  assert.deepEqual(sentEmails.map((m) => m.to).sort(), ['ana@planta.test', 'sole@planta.test']);
  assert.match(sentEmails[0].subject, /R1/);

  assert.equal((await call('closeWorkOrder', USERS.tech, { work_order_id: state.wo.id, actual_minutes: 30 })).status, 409);
});

test('cierre: si falla una salida se revierten las anteriores', async () => {
  let r = await call('createWorkOrder', USERS.tech, { title: 'Rollback', asset_id: state.asset.id });
  const wo = r.data.workOrder;
  await call('workOrderParts', USERS.tech, { action: 'upsert', work_order_id: wo.id, spare_part_id: state.filter.id, quantity: 2 });
  await call('workOrderParts', USERS.tech, { action: 'upsert', work_order_id: wo.id, spare_part_id: state.belt.id, quantity: 1 });

  // Sin stock de correa: falla la validación previa sin tocar nada.
  assert.equal((await call('closeWorkOrder', USERS.tech, { work_order_id: wo.id, actual_minutes: 5 })).status, 409);
  assert.equal(stockOf(state.filter.id), 4);

  // La correa se agota justo después de descontar el filtro.
  const belt = store.SparePart.find((p) => p.id === state.belt.id);
  belt.stock_current = 1;
  const index = store.SparePart.findIndex((p) => p.id === state.filter.id);
  store.SparePart[index] = new Proxy(store.SparePart[index], {
    set(target, key, value) {
      target[key] = value;
      if (key === 'stock_current') belt.stock_current = 0;
      return true;
    },
  });
  r = await call('closeWorkOrder', USERS.tech, { work_order_id: wo.id, actual_minutes: 5 });
  assert.equal(r.status, 409, JSON.stringify(r.data));
  assert.equal(stockOf(state.filter.id), 4, 'el filtro vuelve a su stock');
  const saved = store.WorkOrder.find((w) => w.id === wo.id);
  assert.equal(saved.closing_token, null);
  assert.equal(saved.status, 'OPEN');
  state.openWo = wo;
});

test('ajuste de stock: motivo obligatorio y tope para técnicos', async () => {
  assert.equal((await call('adjustStock', USERS.tech, { spare_part_id: state.filter.id, quantity: 5 })).status, 400);
  assert.equal((await call('adjustStock', USERS.tech, { spare_part_id: state.filter.id, quantity: 500, reason: 'Compra' })).status, 403);
  const r = await call('adjustStock', USERS.sup, { spare_part_id: state.filter.id, quantity: 500, reason: 'Compra' });
  assert.equal(r.status, 200);
  assert.equal(store.StockMovement.at(-1).user_name, 'Sole Jefa');
});

test('comentarios: autor tomado de la sesión, borrar solo propios o jefe', async () => {
  let r = await call('workOrderComments', USERS.viewer, { action: 'add', work_order_id: state.wo.id, content: 'Hola', user_name: 'Suplantado' });
  assert.equal(r.status, 200);
  assert.equal(r.data.comment.user_name, 'Vero Operaria');
  const id = r.data.comment.id;
  assert.equal((await call('workOrderComments', USERS.tech, { action: 'delete', comment_id: id })).status, 403);
  assert.equal((await call('workOrderComments', USERS.viewer, { action: 'delete', comment_id: id })).status, 200);
});

test('adjuntos: tipo, tamaño y OT abierta validados en el servidor', async () => {
  const base = { action: 'create', target: 'work_order', record_id: state.openWo.id, file_uri: 'private/abc', file_name: 'informe.pdf', file_type: 'application/pdf', size_bytes: 1000 };
  assert.equal((await call('attachments', USERS.tech, { ...base, file_type: 'application/x-msdownload' })).status, 400);
  assert.equal((await call('attachments', USERS.tech, { ...base, size_bytes: 20 * 1024 * 1024 })).status, 400);
  assert.equal((await call('attachments', USERS.tech, { ...base, file_uri: 'https://evil.test/x' })).status, 400);
  assert.equal((await call('attachments', USERS.tech, { ...base, record_id: state.wo.id })).status, 409, 'OT cerrada');
  const r = await call('attachments', USERS.tech, { ...base, file_name: '../informe.pdf' });
  assert.equal(r.status, 200);
  assert.equal(r.data.attachment.file_name, '.._informe.pdf');
  assert.equal(r.data.attachment.uploaded_by_id, USERS.tech.id);
  assert.equal((await call('attachments', USERS.tech, { action: 'delete', target: 'work_order', id: r.data.attachment.id })).status, 403);
});

test('usuarios: contacto solo para jefes, sin autodegradación ni escaladas', async () => {
  let r = await call('manageUsers', USERS.tech, { action: 'list' });
  assert.equal(r.status, 200);
  assert.equal(r.data.users[0].email, undefined);
  r = await call('manageUsers', USERS.sup, { action: 'list' });
  assert.ok(r.data.users[0].email);
  assert.equal(r.data.users.find((u) => u.id === USERS.noRole.id).app_role, 'VIEWER');

  assert.equal((await call('manageUsers', USERS.sup, { action: 'update', user_id: USERS.tech.id, app_role: 'ADMIN' })).status, 403);
  assert.equal((await call('manageUsers', USERS.admin, { action: 'update', user_id: USERS.admin.id, app_role: 'SUPERVISOR' })).status, 403);
  assert.equal((await call('manageUsers', USERS.admin, { action: 'update', user_id: USERS.admin.id, active: false })).status, 403);
  assert.equal((await call('manageUsers', USERS.admin, { action: 'update', user_id: USERS.tech.id, app_role: 'BOSS' })).status, 400);
  r = await call('manageUsers', USERS.admin, { action: 'update', user_id: USERS.tech2.id, app_role: 'SUPERVISOR', phone: '1155550000' });
  assert.equal(r.status, 200);
  const entry = store.AuditLog.at(-1);
  assert.equal(entry.action, 'user.update');
  assert.deepEqual(entry.changes.phone, { from: '***', to: '***' }, 'el teléfono no queda en la auditoría');
});

test('preventivos: el workflow corre sin sesión, registra JobRun y limita repeticiones', async () => {
  let r = await call('manageCatalog', USERS.sup, {
    entity: 'MaintenancePlan', action: 'create',
    data: { name: 'Mensual', asset_id: state.asset.id, frequency_type: 'MONTHLY', start_date: '2026-01-01', task_checklist: ['Engrasar'], assigned_to_id: USERS.tech.id },
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.record.next_run_at.slice(0, 10), '2026-02-01');

  r = await call('runMaintenancePlan', null, { mode: 'due' });
  assert.equal(r.status, 200);
  assert.equal(r.data.generated, 1);
  assert.equal((await call('runMaintenancePlan', null, { mode: 'due' })).data.status, 'SKIPPED');
  assert.equal(store.JobRun.length, 1);
  assert.equal(store.JobRun[0].status, 'OK');
});

test('observabilidad: salud solo para admins, logs JSON con request_id', async () => {
  assert.equal((await call('systemHealth', USERS.sup, {})).status, 403);
  const r = await call('systemHealth', USERS.admin, {});
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.ok(r.requestId);
  assert.ok(r.data.errors.denied >= 10, 'los accesos denegados quedan registrados');
  assert.equal(r.data.preventives.stale, false);

  const lines = logLines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  assert.ok(lines.length > 50);
  assert.ok(lines.every((l) => l.request_id && l.fn));
  assert.ok(lines.filter((l) => l.outcome).length > 50);
  assert.ok(!logLines.some((l) => String(l).includes('@planta.test')), 'sin emails en los logs');
});
