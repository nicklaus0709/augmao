// Exportaciones a PDF (grillas, fichas de detalle, KPIs y etiqueta QR).
import { jsPDF } from "jspdf";
import { formatDate, formatDateTime, formatMinutes, formatMoney } from "@/lib/format";
import { WO_STATUS, WO_PRIORITY, WO_TYPE, ASSET_CATEGORY, ASSET_STATUS } from "@/lib/constants";

const NAVY = [30, 38, 49];
const BRAND = [67, 119, 239];
const CREAM = [245, 242, 239];
const LINE = [219, 223, 230];
const MUTED = [96, 112, 133];
const WHITE = [255, 255, 255];
const ZEBRA = [250, 249, 248];

const PILLS = {
  OPEN: { bg: [254, 243, 199], fg: [146, 64, 14] },
  ASSIGNED: { bg: [219, 234, 254], fg: [30, 64, 175] },
  IN_PROGRESS: { bg: [243, 232, 255], fg: [107, 33, 168] },
  ON_HOLD: { bg: [243, 244, 246], fg: [55, 65, 81] },
  COMPLETED: { bg: [209, 250, 229], fg: [6, 95, 70] },
  CANCELLED: { bg: [254, 226, 226], fg: [185, 28, 28] },
  LOW: { bg: [243, 244, 246], fg: [75, 85, 99] },
  MEDIUM: { bg: [254, 243, 199], fg: [180, 83, 9] },
  HIGH: { bg: [255, 237, 213], fg: [194, 65, 12] },
  CRITICAL: { bg: [254, 226, 226], fg: [185, 28, 28] },
  OPERATIONAL: { bg: [209, 250, 229], fg: [6, 95, 70] },
  UNDER_MAINTENANCE: { bg: [254, 243, 199], fg: [146, 64, 14] },
  OUT_OF_SERVICE: { bg: [254, 226, 226], fg: [185, 28, 28] },
  RETIRED: { bg: [243, 244, 246], fg: [75, 85, 99] },
  CORRECTIVE: { bg: [255, 228, 230], fg: [159, 18, 57] },
  PREVENTIVE: { bg: [209, 250, 229], fg: [6, 95, 70] },
  PREDICTIVE: { bg: [237, 233, 254], fg: [91, 33, 182] },
  INSPECTION: { bg: [224, 242, 254], fg: [7, 89, 133] },
};

function fill(doc, rgb) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}

function stroke(doc, rgb) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

function ink(doc, rgb) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function badge(doc, label, x, y, key) {
  const pill = PILLS[key] || { bg: [243, 244, 246], fg: [55, 65, 81] };
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const width = doc.getTextWidth(label) + 6;
  fill(doc, pill.bg);
  doc.roundedRect(x, y - 3.6, width, 5.6, 2.8, 2.8, "F");
  ink(doc, pill.fg);
  doc.text(label, x + 3, y);
  return width;
}

function band(doc, title, userName) {
  const width = doc.internal.pageSize.getWidth();
  fill(doc, NAVY);
  doc.rect(0, 0, width, 24, "F");
  ink(doc, WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("AuGmao · Gestión de Mantenimiento", 12, 9);
  doc.setFontSize(15);
  doc.text(title, 12, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Fecha de emisión: " + formatDateTime(new Date().toISOString()), width - 12, 9, { align: "right" });
  doc.text("Emitido por: " + (userName || "-"), width - 12, 15, { align: "right" });
  return 24;
}

function footers(doc, leftLabel, rightLabel) {
  const pages = doc.getNumberOfPages();
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    stroke(doc, LINE);
    doc.setLineWidth(0.2);
    doc.line(12, height - 12, width - 12, height - 12);
    ink(doc, MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(leftLabel, 12, height - 7);
    doc.text(rightLabel ? rightLabel(p, pages) : "Página " + p + " de " + pages, width - 12, height - 7, { align: "right" });
  }
}

function clip(doc, value, maxWidth) {
  let text = String(value ?? "");
  if (doc.getTextWidth(text) <= maxWidth) return text;
  while (text.length > 1 && doc.getTextWidth(text + "...") > maxWidth) text = text.slice(0, -1);
  return text + "...";
}

function sectionTitle(doc, text, x, y) {
  ink(doc, NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(text, x, y);
  stroke(doc, LINE);
  doc.setLineWidth(0.3);
  doc.line(x, y + 1.6, doc.internal.pageSize.getWidth() - 12, y + 1.6);
  return y + 7;
}

function field(doc, label, value, x, y, labelWidth = 42) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  ink(doc, MUTED);
  doc.text(label, x, y);
  ink(doc, NAVY);
  doc.setFont("helvetica", "bold");
  doc.text(String(value ?? "-"), x + labelWidth, y);
  return y + 5.2;
}

// ---------- Grillas ----------

export function exportGridPdf({ title, columns, rows, filters, userName, filename }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const x0 = 12;
  const totalWidth = width - 24;
  const weights = columns.reduce((sum, c) => sum + (c.weight || 1), 0);
  const widths = columns.map((c) => ((c.weight || 1) / weights) * totalWidth);
  const rowH = 7;
  const headerH = 7;

  const renderHeaderRow = (y) => {
    fill(doc, CREAM);
    doc.rect(x0, y, totalWidth, headerH, "F");
    ink(doc, NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    let x = x0;
    columns.forEach((c, i) => {
      if (c.align === "right") {
        doc.text(clip(doc, c.label, widths[i] - 4), x + widths[i] - 2, y + 4.8, { align: "right" });
      } else {
        doc.text(clip(doc, c.label, widths[i] - 4), x + 2, y + 4.8);
      }
      x += widths[i];
    });
    stroke(doc, LINE);
    doc.setLineWidth(0.2);
    doc.line(x0, y + headerH, x0 + totalWidth, y + headerH);
    return y + headerH;
  };

  let y = band(doc, title, userName) + 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  ink(doc, MUTED);
  const filterText = filters && filters.length ? "Filtros: " + filters.join(" · ") : "Sin filtros";
  doc.text(rows.length + " registros · " + filterText, x0, y + 3);
  y += 9;
  y = renderHeaderRow(y);

  rows.forEach((row, index) => {
    if (y + rowH > height - 18) {
      doc.addPage();
      y = band(doc, title, userName) + 4;
      y = renderHeaderRow(y);
    }
    if (index % 2 === 1) {
      fill(doc, ZEBRA);
      doc.rect(x0, y, totalWidth, rowH, "F");
    }
    ink(doc, NAVY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    let x = x0;
    columns.forEach((c, i) => {
      const value = row[i];
      const text = value === null || value === undefined || value === "" ? "-" : String(value);
      if (c.align === "right") {
        doc.text(clip(doc, text, widths[i] - 4), x + widths[i] - 2, y + 4.8, { align: "right" });
      } else {
        doc.text(clip(doc, text, widths[i] - 4), x + 2, y + 4.8);
      }
      x += widths[i];
    });
    stroke(doc, LINE);
    doc.setLineWidth(0.2);
    doc.line(x0, y + rowH, x0 + totalWidth, y + rowH);
    y += rowH;
  });

  footers(doc, "AuGmao · " + title);
  doc.save(filename);
}

// ---------- Orden de trabajo ----------

export function exportWorkOrderPdf({ workOrder, asset, parts, comments, userName, filename }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const x = 12;
  const width = doc.internal.pageSize.getWidth();
  let y = band(doc, "Orden de trabajo " + workOrder.code, userName) + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  ink(doc, NAVY);
  doc.text(doc.splitTextToSize(workOrder.title, width - 24), x, y);
  y += 8;
  let bx = x;
  bx += badge(doc, WO_STATUS[workOrder.status]?.label || "-", bx, y, workOrder.status) + 2;
  bx += badge(doc, WO_PRIORITY[workOrder.priority]?.label || "-", bx, y, workOrder.priority) + 2;
  badge(doc, WO_TYPE[workOrder.type]?.label || "-", bx, y, workOrder.type);
  y += 10;

  y = sectionTitle(doc, "Información general", x, y);
  y = field(doc, "Código", workOrder.code, x, y);
  y = field(doc, "Activo", asset ? asset.code + " - " + asset.name : "-", x, y);
  y = field(doc, "Ubicación", asset?.location || "-", x, y);
  y = field(doc, "Creada por", workOrder.created_by || "-", x, y);
  y = field(doc, "Técnico asignado", workOrder.assigned_to_name || "-", x, y);
  y = field(doc, "Fecha programada", workOrder.scheduled_at ? formatDateTime(workOrder.scheduled_at) : "-", x, y);
  y = field(doc, "Fecha inicio", workOrder.started_at ? formatDateTime(workOrder.started_at) : "-", x, y);
  y = field(doc, "Fecha cierre", workOrder.completed_at ? formatDateTime(workOrder.completed_at) : "-", x, y);

  y = sectionTitle(doc, "Tiempos", x, y + 3);
  y = field(doc, "Tiempo estimado", formatMinutes(workOrder.estimated_minutes), x, y);
  y = field(doc, "Tiempo real", formatMinutes(workOrder.actual_minutes), x, y);

  y = sectionTitle(doc, "Descripción", x, y + 3);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  ink(doc, NAVY);
  const description = workOrder.description ? doc.splitTextToSize(workOrder.description, width - 24) : ["-"];
  doc.text(description, x, y);
  y += description.length * 4.6 + 6;

  if (y > 230) {
    doc.addPage();
    y = 20;
  }
  y = sectionTitle(doc, "Repuestos utilizados", x, y);
  const partRows = (parts || []).map((p) => [
    p.name || "-",
    p.code || "-",
    String(p.quantity_used ?? 0) + " " + (p.unit_label || ""),
    p.unit_cost ? formatMoney(p.unit_cost) : "-",
  ]);
  y = simpleTable(doc, x, y, width - 24, [
    { label: "Repuesto", weight: 4 },
    { label: "Código", weight: 2 },
    { label: "Cantidad", weight: 2, align: "right" },
    { label: "Costo unitario", weight: 2, align: "right" },
  ], partRows);

  y = sectionTitle(doc, "Notas de cierre", x, y + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  ink(doc, NAVY);
  doc.text("Causa de falla: " + (workOrder.failure_cause || "-"), x, y);
  y += 5;
  const notes = workOrder.closing_notes ? doc.splitTextToSize(workOrder.closing_notes, width - 24) : ["-"];
  doc.text(notes, x, y);
  y += notes.length * 4.6 + 6;

  if (y > 240) {
    doc.addPage();
    y = 20;
  }
  y = sectionTitle(doc, "Comentarios (" + (comments || []).length + ")", x, y);
  (comments || []).forEach((comment) => {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    ink(doc, NAVY);
    doc.text((comment.user_name || "Usuario") + " · " + formatDateTime(comment.created_date), x, y);
    doc.setFont("helvetica", "normal");
    ink(doc, MUTED);
    const lines = doc.splitTextToSize(comment.content, width - 24);
    doc.text(lines, x, y + 4.4);
    y += 4.4 + lines.length * 4.4 + 4;
  });

  const signY = Math.max(y + 14, doc.internal.pageSize.getHeight() - 34);
  const safeSignY = Math.min(signY, doc.internal.pageSize.getHeight() - 24);
  stroke(doc, NAVY);
  doc.setLineWidth(0.4);
  doc.line(x, safeSignY, x + 70, safeSignY);
  doc.line(width - 82, safeSignY, width - 12, safeSignY);
  ink(doc, MUTED);
  doc.setFontSize(8);
  doc.text("Tecnico responsable", x, safeSignY + 4);
  doc.text("Supervisor / Aprobación", width - 82, safeSignY + 4);

  footers(doc, "AuGmao - Gestion de Mantenimiento");
  doc.save(filename);
}

function simpleTable(doc, x0, y0, totalWidth, columns, rows) {
  const weights = columns.reduce((sum, c) => sum + (c.weight || 1), 0);
  const widths = columns.map((c) => ((c.weight || 1) / weights) * totalWidth);
  const rowH = 6.5;
  let y = y0;
  fill(doc, CREAM);
  doc.rect(x0, y, totalWidth, rowH, "F");
  ink(doc, NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  let x = x0;
  columns.forEach((c, i) => {
    doc.text(clip(doc, c.label, widths[i] - 4), c.align === "right" ? x + widths[i] - 2 : x + 2, y + 4.4, c.align === "right" ? { align: "right" } : undefined);
    x += widths[i];
  });
  stroke(doc, LINE);
  doc.setLineWidth(0.2);
  doc.line(x0, y + rowH, x0 + totalWidth, y + rowH);
  y += rowH;

  if (!rows.length) {
    doc.setFont("helvetica", "normal");
    ink(doc, MUTED);
    doc.text("-", x0 + 2, y + 4.4);
    return y + rowH + 2;
  }

  rows.forEach((row) => {
    if (y + rowH > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 20;
    }
    ink(doc, NAVY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    let cx = x0;
    columns.forEach((c, i) => {
      const text = row[i] === null || row[i] === undefined || row[i] === "" ? "-" : String(row[i]);
      doc.text(clip(doc, text, widths[i] - 4), c.align === "right" ? cx + widths[i] - 2 : cx + 2, y + 4.4, c.align === "right" ? { align: "right" } : undefined);
      cx += widths[i];
    });
    stroke(doc, LINE);
    doc.line(x0, y + rowH, x0 + totalWidth, y + rowH);
    y += rowH;
  });
  return y + 2;
}

// ---------- Activo ----------

export function exportAssetPdf({ asset, parent, plans, workOrders, stats, userName, filename }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const x = 12;
  const width = doc.internal.pageSize.getWidth();
  let y = band(doc, "Activo " + asset.code, userName) + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  ink(doc, NAVY);
  doc.text(asset.name || "-", x, y);
  y += 8;
  badge(doc, ASSET_STATUS[asset.status]?.label || "-", x, y, asset.status);
  y += 10;

  y = sectionTitle(doc, "Información del activo", x, y);
  y = field(doc, "Código", asset.code, x, y);
  y = field(doc, "Categoría", ASSET_CATEGORY[asset.category] || "-", x, y);
  y = field(doc, "Nombre", asset.name, x, y);
  y = field(doc, "Ubicación", asset.location, x, y);
  y = field(doc, "Fabricante", asset.manufacturer, x, y);
  y = field(doc, "Modelo", asset.model, x, y);
  y = field(doc, "N° de serie", asset.serial_number, x, y);
  y = field(doc, "Garantía hasta", asset.warranty_expires ? formatDate(asset.warranty_expires) : "-", x, y);
  y = field(doc, "Activo padre", parent ? parent.code + " - " + parent.name : "-", x, y);

  const attributes = Object.entries(asset.attributes || {});
  if (attributes.length) {
    y = sectionTitle(doc, "Atributos técnicos", x, y + 3);
    attributes.forEach(([key, value]) => {
      y = field(doc, key, String(value), x, y);
    });
  }

  y = sectionTitle(doc, "Estadísticas de mantenimiento", x, y + 3);
  y = field(doc, "Total de OTs", stats.total, x, y);
  y = field(doc, "Completadas", stats.completed, x, y);
  y = field(doc, "MTTR promedio", formatMinutes(stats.mttr), x, y);

  y = sectionTitle(doc, "Historial de órdenes de trabajo", x, y + 3);
  y = simpleTable(doc, x, y, width - 24, [
    { label: "Código", weight: 2 },
    { label: "Título", weight: 4 },
    { label: "Tipo", weight: 2 },
    { label: "Estado", weight: 2 },
    { label: "Fecha de cierre", weight: 2, align: "right" },
  ], workOrders.map((wo) => [
    wo.code,
    wo.title,
    WO_TYPE[wo.type]?.label || "-",
    WO_STATUS[wo.status]?.label || "-",
    wo.completed_at ? formatDate(wo.completed_at) : "-",
  ]));

  if (plans && plans.length) {
    if (y > 240) {
      doc.addPage();
      y = 20;
    }
    y = sectionTitle(doc, "Planes de mantenimiento activos", x, y + 4);
    plans.forEach((plan) => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      ink(doc, NAVY);
      doc.text(plan.name, x, y);
      doc.setFont("helvetica", "normal");
      ink(doc, MUTED);
      doc.text("Próxima ejecución: " + (plan.next_run_at ? formatDate(plan.next_run_at) : "-"), x + 90, y);
      y += 5.4;
    });
  }

  footers(doc, "AuGmao - Gestion de Mantenimiento");
  doc.save(filename);
}

// ---------- KPIs ----------

export function exportKpisPdf({ kpis, statusCounts, typeCounts, lowStockCount, userName, filename }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const x = 12;
  const width = doc.internal.pageSize.getWidth();
  let y = band(doc, "Informe de KPIs", userName) + 12;

  y = sectionTitle(doc, "Indicadores clave de mantenimiento (KPIs)", x, y);
  const boxes = [
    { label: "MTBF", value: kpis.mtbf ? kpis.mtbf.toFixed(1) + "h" : "0h", bg: [237, 233, 254], fg: [91, 33, 182] },
    { label: "MTTR", value: formatMinutes(kpis.mttr), bg: [254, 243, 199], fg: [180, 83, 9] },
    { label: "Disponibilidad", value: kpis.availability.toFixed(2) + "%", bg: [209, 250, 229], fg: [6, 95, 70] },
    { label: "Total OTs", value: String(kpis.total), bg: [219, 234, 254], fg: [30, 64, 175] },
  ];
  const boxWidth = (width - 24 - 9) / 4;
  boxes.forEach((box, i) => {
    const bx = x + i * (boxWidth + 3);
    fill(doc, box.bg);
    doc.roundedRect(bx, y, boxWidth, 20, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    ink(doc, box.fg);
    doc.text(box.value, bx + 4, y + 9);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(box.label, bx + 4, y + 15.5);
  });
  y += 28;

  y = sectionTitle(doc, "Distribución por estado", x, y);
  y = bars(doc, x, y, width - 24, statusCounts, WO_STATUS);
  y = sectionTitle(doc, "Distribución por tipo", x, y + 3);
  y = bars(doc, x, y, width - 24, typeCounts, WO_TYPE);

  y = sectionTitle(doc, "Alertas de inventario", x, y + 3);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  if (lowStockCount > 0) {
    ink(doc, [185, 28, 28]);
    doc.text("ATENCIÓN: " + lowStockCount + " repuesto(s) con stock por debajo del mínimo", x, y);
  } else {
    ink(doc, [6, 95, 70]);
    doc.text("Sin repuestos por debajo del stock mínimo", x, y);
  }
  y += 9;

  y = sectionTitle(doc, "Resumen ejecutivo", x, y + 3);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  ink(doc, NAVY);
  const summary =
    "En el período analizado se registraron " + kpis.total + " órdenes de trabajo, con una tasa de cierre del " +
    kpis.closureRate.toFixed(2) + "% (" + kpis.completed + " completadas). El MTTR es de " + formatMinutes(kpis.mttr) +
    " y el MTBF de " + (kpis.mtbf ? kpis.mtbf.toFixed(1) : "0") + " horas, lo que arroja una disponibilidad del sistema del " +
    kpis.availability.toFixed(2) + "%.";
  doc.text(doc.splitTextToSize(summary, width - 24), x, y);

  footers(doc, "AuGmao - Gestion de Mantenimiento");
  doc.save(filename);
}

function bars(doc, x0, y0, totalWidth, counts, labels) {
  const entries = Object.entries(counts || {});
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  let y = y0 + 2;
  if (!total) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    ink(doc, MUTED);
    doc.text("Sin datos", x0, y + 4);
    return y + 10;
  }
  entries.forEach(([key, value]) => {
    const share = value / total;
    ink(doc, NAVY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text((labels[key]?.label || key) + " (" + value + ")", x0, y + 3.4);
    fill(doc, LINE);
    doc.roundedRect(x0 + 70, y, totalWidth - 100, 5, 2.5, 2.5, "F");
    fill(doc, BRAND);
    if (share > 0) doc.roundedRect(x0 + 70, y, Math.max(2, (totalWidth - 100) * share), 5, 2.5, 2.5, "F");
    ink(doc, MUTED);
    doc.setFontSize(8);
    doc.text((share * 100).toFixed(1) + "%", x0 + totalWidth - 24, y + 3.6, { align: "right" });
    y += 7.5;
  });
  return y + 3;
}

// ---------- Etiqueta QR ----------

async function qrImageDataUrl(text) {
  try {
    const response = await fetch(
      "https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=0&data=" + encodeURIComponent(text),
      { signal: AbortSignal.timeout(10000) }
    );
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return null;
  }
}

export async function exportQrLabelPdf({ asset, url, filename }) {
  const doc = new jsPDF({ unit: "mm", format: [80, 100], orientation: "portrait" });

  fill(doc, NAVY);
  doc.rect(0, 0, 80, 18, "F");
  ink(doc, WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("AuGmao", 40, 8, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Gestion de Mantenimiento", 40, 13.5, { align: "center" });

  const dataUrl = await qrImageDataUrl(url);
  if (dataUrl) {
    doc.addImage(dataUrl, "PNG", 10, 24, 60, 60);
  } else {
    stroke(doc, LINE);
    doc.setLineWidth(0.4);
    doc.rect(10, 24, 60, 60);
    ink(doc, MUTED);
    doc.setFontSize(7);
    doc.text(doc.splitTextToSize(url, 54), 40, 54, { align: "center" });
  }

  ink(doc, NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(asset.code, 40, 90, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(doc.splitTextToSize(asset.name || "", 70)[0], 40, 94, { align: "center" });
  ink(doc, MUTED);
  doc.setFontSize(6.5);
  doc.text("Escanear desde la app AuGmao", 40, 98, { align: "center" });

  doc.save(filename);
}