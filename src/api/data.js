import { base44 } from "@/api/base44Client";

const PAGE_SIZE = 5000;

// Lee todas las páginas de una consulta (hasta `max` registros). Devuelve el mismo
// formato que `filter` ({ items }) para que las pantallas no calculen sobre un recorte.
export async function fetchAll(entityName, query = {}, { sort, max = 20000 } = {}) {
  const items = [];
  let page = await base44.entities[entityName].filter(query, { sort, limit: PAGE_SIZE });
  items.push(...(page.items || []));
  while (page.has_more && page.next_cursor && items.length < max) {
    page = await base44.entities[entityName].filter(query, { cursor: page.next_cursor, limit: PAGE_SIZE });
    items.push(...(page.items || []));
  }
  return { items, truncated: Boolean(page.has_more) };
}

// Invoca una función de backend y devuelve su respuesta, o lanza un Error con el
// mensaje del servidor (que incluye el código de seguimiento si fue un error interno).
export async function callFunction(name, payload, fallbackMessage = "No se pudo completar la acción") {
  let response;
  try {
    response = await base44.functions.invoke(name, payload);
  } catch (e) {
    throw new Error(e?.response?.data?.error || fallbackMessage);
  }
  if (response?.data?.error) throw new Error(response.data.error);
  return response?.data || {};
}
