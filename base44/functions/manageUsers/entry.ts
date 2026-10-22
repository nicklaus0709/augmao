import {
  defineFunction, teamDirectory, getTeamMember, audit, diff, deny, displayName,
  text, oneOf, id, isActive, roleOf, ROLES, ROLE_RANK, rankOf, ValidationError,
} from '../../shared/guards.ts';

async function activeAdmins(base44) {
  const team = await teamDirectory(base44);
  return team.filter((u) => u.active && u.app_role === 'ADMIN');
}

export default defineFunction('manageUsers', async (ctx) => {
  const action = ctx.body.action || 'list';

  // Listar el equipo: operarios nivel 2 o más. Contacto solo para jefes y admins.
  if (action === 'list') {
    const denied = await ctx.requireUser(ROLE_RANK.TECHNICIAN);
    if (denied) return denied;
    const includeContact = rankOf(ctx.user) >= ROLE_RANK.SUPERVISOR;
    return Response.json({ users: await teamDirectory(ctx.base44, { includeContact }) });
  }

  // Administrar usuarios: solo el administrador.
  const denied = await ctx.requireUser(ROLE_RANK.ADMIN);
  if (denied) return denied;

  if (action === 'invite') {
    const email = text(ctx.body.email, 'El email', { max: 200, required: true }).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError('El email no es válido');
    const fullName = text(ctx.body.full_name, 'El nombre', { max: 120 });
    const appRole = oneOf(ctx.body.app_role, ROLES, 'El rol', 'VIEWER');
    const phone = text(ctx.body.phone, 'El teléfono', { max: 40 });

    const existing = await ctx.db.User.filter({ email });
    if ((Array.isArray(existing) ? existing : existing?.items || []).length) {
      return Response.json({ error: 'Ya existe un usuario con ese email' }, { status: 409 });
    }
    const invited = await ctx.base44.users.inviteUser(email, 'user');
    let created = invited && invited.id ? invited : null;
    if (!created) {
      const found = await ctx.db.User.filter({ email });
      created = (Array.isArray(found) ? found : found?.items || [])[0] || null;
    }
    if (!created) return Response.json({ invited: true, applied: false });

    await ctx.db.User.update(created.id, {
      full_name: fullName || created.full_name || email,
      app_role: appRole,
      phone,
      active: true,
    });
    await audit(ctx, {
      action: 'user.invite',
      entity: 'User',
      entityId: created.id,
      summary: 'Invitó a ' + (fullName || 'un usuario nuevo') + ' como ' + appRole,
    });
    return Response.json({ invited: true, applied: true });
  }

  if (action === 'update') {
    const userId = id(ctx.body.user_id, 'El usuario');
    const target = await getTeamMember(ctx.base44, userId);
    if (!target) return Response.json({ error: 'No se encontró el usuario' }, { status: 404 });

    const patch = {};
    if (ctx.body.full_name !== undefined) patch.full_name = text(ctx.body.full_name, 'El nombre', { max: 120, required: true });
    if (ctx.body.app_role !== undefined) patch.app_role = oneOf(ctx.body.app_role, ROLES, 'El rol');
    if (ctx.body.phone !== undefined) patch.phone = text(ctx.body.phone, 'El teléfono', { max: 40 });
    if (ctx.body.active !== undefined) patch.active = Boolean(ctx.body.active);

    const self = userId === ctx.user.id;
    if (self && patch.active === false) return deny(ctx, 'Autodesactivación', 'No podés desactivar tu propio usuario');
    if (self && patch.app_role && patch.app_role !== 'ADMIN') {
      return deny(ctx, 'Autodegradación', 'No podés quitarte el rol de administrador');
    }
    // Nunca dejar la app sin un administrador activo.
    const losesAdmin = roleOf(target) === 'ADMIN' && isActive(target) &&
      ((patch.app_role && patch.app_role !== 'ADMIN') || patch.active === false);
    if (losesAdmin && (await activeAdmins(ctx.base44)).length <= 1) {
      return Response.json({ error: 'Tiene que quedar al menos un administrador activo' }, { status: 409 });
    }

    const before = { full_name: target.full_name, app_role: roleOf(target), phone: target.phone, active: isActive(target) };
    const updated = await ctx.db.User.update(userId, patch);
    const changes = diff(before, { ...before, ...patch }, ['full_name', 'app_role', 'phone', 'active']);
    if (changes.phone) changes.phone = { from: '***', to: '***' };
    await audit(ctx, {
      action: 'user.update',
      entity: 'User',
      entityId: userId,
      summary: 'Actualizó a ' + (patch.full_name || displayName(target) || 'un usuario'),
      changes,
    });
    return Response.json({
      user: { id: updated.id, full_name: updated.full_name, app_role: roleOf(updated), active: isActive(updated) },
    });
  }

  return Response.json({ error: 'Acción desconocida' }, { status: 400 });
});
