// Cálculo de indicadores de mantenimiento (KPIs).
const DAY = 86400000;

function countBy(list, key) {
  const out = {};
  for (const item of list) {
    const value = item[key] || "SIN_DATO";
    out[value] = (out[value] || 0) + 1;
  }
  return out;
}

export function isOpen(workOrder) {
  return workOrder.status !== "COMPLETED" && workOrder.status !== "CANCELLED";
}

export function computeKpis(workOrders, periodDays = 90) {
  const from = Date.now() - periodDays * DAY;
  const inPeriod = workOrders.filter((wo) => {
    const created = new Date(wo.created_date || 0).getTime();
    return created >= from;
  });

  const completed = inPeriod.filter((wo) => wo.status === "COMPLETED");
  const totalMinutes = completed.reduce((sum, wo) => sum + Number(wo.actual_minutes || 0), 0);
  const mttr = completed.length ? totalMinutes / completed.length : 0;
  const correctiveCompleted = completed.filter((wo) => wo.type === "CORRECTIVE").length;
  const mtbf = correctiveCompleted ? (periodDays * 24) / correctiveCompleted : 0;
  const availability = mtbf > 0 ? Math.round((mtbf / (mtbf + mttr / 60)) * 10000) / 100 : 100;
  const total = inPeriod.length;
  const closureRate = total ? Math.round((completed.length / total) * 10000) / 100 : 0;

  return {
    periodDays,
    total,
    completed: completed.length,
    openCount: workOrders.filter(isOpen).length,
    mttr,
    mtbf,
    availability,
    closureRate,
    statusCounts: countBy(inPeriod, "status"),
    typeCounts: countBy(inPeriod, "type"),
    inPeriod,
  };
}

export function kpisByAsset(workOrders, assets) {
  return assets
    .map((asset) => {
      const list = workOrders.filter((wo) => wo.asset_id === asset.id);
      const completed = list.filter((wo) => wo.status === "COMPLETED");
      const minutes = completed.reduce((sum, wo) => sum + Number(wo.actual_minutes || 0), 0);
      return {
        id: asset.id,
        name: asset.code + " - " + asset.name,
        total: list.length,
        completed: completed.length,
        corrective: list.filter((wo) => wo.type === "CORRECTIVE").length,
        preventive: list.filter((wo) => wo.type === "PREVENTIVE").length,
        mttr: completed.length ? minutes / completed.length : 0,
      };
    })
    .filter((row) => row.total > 0);
}

export function kpisByTechnician(workOrders, users) {
  return users
    .map((user) => {
      const list = workOrders.filter((wo) => wo.assigned_to_id === user.id);
      const completed = list.filter((wo) => wo.status === "COMPLETED");
      const minutes = completed.reduce((sum, wo) => sum + Number(wo.actual_minutes || 0), 0);
      return {
        id: user.id,
        name: user.full_name || user.email,
        assigned: list.length,
        completed: completed.length,
        closureRate: list.length ? Math.round((completed.length / list.length) * 10000) / 100 : 0,
        avgMinutes: completed.length ? minutes / completed.length : 0,
      };
    })
    .filter((row) => row.assigned > 0);
}