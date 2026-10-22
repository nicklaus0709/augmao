// SDK de Base44 simulado en memoria para probar las funciones de backend en Node.
// Implementa solo lo que usan las funciones: entidades con filtros básicos,
// auth.me, asServiceRole e invitaciones. La identidad viene de la cabecera x-user.
export const store = {};
export const sentEmails = [];
let seq = 0;

const collection = (name) => (store[name] ||= []);

function matches(doc, query) {
  for (const [key, expected] of Object.entries(query || {})) {
    const value = doc[key];
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      for (const [op, arg] of Object.entries(expected)) {
        if (op === '$in' && !arg.includes(value)) return false;
        if (op === '$nin' && arg.includes(value)) return false;
        if (op === '$ne' && value === arg) return false;
        if (op === '$gte' && !(value >= arg)) return false;
        if (op === '$regex' && !new RegExp(arg).test(value || '')) return false;
      }
    } else if (expected === null) {
      if (value !== null && value !== undefined) return false;
    } else if (value !== expected) {
      return false;
    }
  }
  return true;
}

function sorted(list, sort) {
  if (!sort) return list;
  const desc = sort.startsWith('-');
  const field = sort.replace(/^-/, '');
  return [...list].sort((a, b) => (a[field] > b[field] ? 1 : a[field] < b[field] ? -1 : 0) * (desc ? -1 : 1));
}

function entity(name) {
  return {
    async get(id) {
      const doc = collection(name).find((d) => d.id === id);
      if (!doc) throw new Error(name + ' not found');
      return { ...doc };
    },
    async filter(query, options) {
      const found = sorted(collection(name).filter((d) => matches(d, query)), options && options.sort);
      if (options && typeof options === 'object') {
        return { items: found.slice(0, options.limit || 100).map((d) => ({ ...d })), has_more: false, next_cursor: null };
      }
      return found.map((d) => ({ ...d }));
    },
    async list() {
      return collection(name).map((d) => ({ ...d }));
    },
    async create(data) {
      seq += 1;
      const doc = { id: name + '_' + seq, created_date: new Date(Date.now() + seq).toISOString(), ...data };
      collection(name).push(doc);
      return { ...doc };
    },
    async update(id, data) {
      const doc = collection(name).find((d) => d.id === id);
      if (!doc) throw new Error(name + ' not found');
      Object.assign(doc, data);
      return { ...doc };
    },
    async delete(id) {
      store[name] = collection(name).filter((d) => d.id !== id);
      return { success: true };
    },
    async updateMany(query, update) {
      let updated = 0;
      for (const doc of collection(name)) {
        if (!matches(doc, query)) continue;
        updated += 1;
        for (const [key, inc] of Object.entries(update.$inc || {})) doc[key] = (doc[key] || 0) + inc;
        Object.assign(doc, update.$set || {});
      }
      return { success: true, updated, has_more: false };
    },
  };
}

const entities = new Proxy({}, { get: (_, name) => entity(name) });

export function createClientFromRequest(req) {
  const raw = req.headers.get('x-user');
  const session = raw ? JSON.parse(raw) : null;
  return {
    auth: {
      async me() {
        if (!session) throw new Error('Unauthorized');
        return { ...(collection('User').find((u) => u.id === session.id) || session) };
      },
    },
    entities,
    users: {
      async inviteUser(email) {
        return entities.User.create({ email, role: 'user' });
      },
    },
    asServiceRole: {
      entities,
      integrations: { Core: { async SendEmail(message) { sentEmails.push(message); } } },
    },
  };
}
