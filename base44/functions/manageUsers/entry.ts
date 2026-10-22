import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireUser, errorResponse, teamDirectory } from '../../shared/guards.ts';

const ROLES = ['ADMIN', 'SUPERVISOR', 'TECHNICIAN', 'VIEWER'];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'list';

    // Listar el equipo: cualquier operario nivel 2 o superior.
    if (action === 'list') {
      const { denied } = await requireUser(base44, 2);
      if (denied) return denied;
      return Response.json({ users: await teamDirectory(base44) });
    }

    // Administrar usuarios: solo el administrador.
    const { user, denied } = await requireUser(base44, 4);
    if (denied) return denied;

    if (action === 'invite') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!email) return errorResponse('El email es obligatorio');
      const directory = await teamDirectory(base44);
      if (directory.some((u) => (u.email || '').toLowerCase() === email)) {
        return errorResponse('Ya existe un usuario con ese email');
      }
      const invited = await base44.users.inviteUser(email, 'user');
      let created = invited && invited.id ? invited : null;
      if (!created) {
        const found = await base44.asServiceRole.entities.User.filter({ email });
        created = Array.isArray(found) ? found[0] : null;
      }
      if (created && created.id) {
        await base44.asServiceRole.entities.User.update(created.id, {
          full_name: String(body.full_name || '').trim() || created.full_name || email,
          app_role: ROLES.includes(body.app_role) ? body.app_role : 'TECHNICIAN',
          phone: String(body.phone || '').trim(),
          active: true,
        });
        return Response.json({ invited: true, applied: true });
      }
      return Response.json({ invited: true, applied: false });
    }

    if (action === 'update') {
      if (!body.user_id) return errorResponse('Falta el usuario');
      if (body.user_id === user.id && body.active === false) {
        return errorResponse('No podés desactivar tu propio usuario');
      }
      const patch = {};
      if (body.full_name !== undefined) patch.full_name = String(body.full_name).trim();
      if (body.app_role && ROLES.includes(body.app_role)) patch.app_role = body.app_role;
      if (body.phone !== undefined) patch.phone = String(body.phone).trim();
      if (body.active !== undefined) patch.active = Boolean(body.active);
      const updated = await base44.asServiceRole.entities.User.update(body.user_id, patch);
      return Response.json({ user: updated });
    }

    return errorResponse('Acción desconocida');
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}