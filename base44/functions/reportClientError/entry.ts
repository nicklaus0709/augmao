import { defineFunction, roleOf, text, ROLE_RANK } from '../../shared/guards.ts';

// Errores del navegador (ErrorBoundary y errores no capturados).
export default defineFunction('reportClientError', async (ctx) => {
  const denied = await ctx.requireUser(ROLE_RANK.VIEWER);
  if (denied) return denied;

  await ctx.db.ErrorEvent.create({
    source: 'frontend',
    level: 'error',
    fn: text(ctx.body.kind, 'El tipo', { max: 40 }) || 'error',
    message: text(String(ctx.body.message || '').slice(0, 500), 'El mensaje', { max: 500 }) || 'Error sin mensaje',
    stack: String(ctx.body.stack || '').slice(0, 2000) || null,
    path: String(ctx.body.path || '').slice(0, 300) || null,
    release: String(ctx.body.release || '').slice(0, 40) || null,
    user_id: ctx.user.id,
    user_role: roleOf(ctx.user),
  });
  return Response.json({ ok: true });
});
