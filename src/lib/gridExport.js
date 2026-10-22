import { exportGridPdf } from "@/lib/exports/pdf";
import { exportExcel } from "@/lib/exports/xlsx";
import { fileStamp, formatDateTime } from "@/lib/format";

const MAX_EXPORT = 1000;

// Exportación de grillas filtradas (Órdenes de trabajo, Activos, Inventario).
export function exportGridList({ format, title, fileBase, columns, rows, filters = [], userName }) {
  const limited = rows.slice(0, MAX_EXPORT);
  const filterList = [...filters];
  if (rows.length > MAX_EXPORT) {
    filterList.push(`Se exportan las primeras ${limited.length} de ${rows.length}`);
  }
  const stamp = fileStamp();

  if (format === "pdf") {
    exportGridPdf({
      title,
      columns,
      rows: limited,
      filters: filterList,
      userName,
      filename: `${fileBase}-${stamp}.pdf`,
    });
    return;
  }

  exportExcel({
    sheetName: title,
    title,
    meta: [
      ["Fecha de emisión", formatDateTime(new Date().toISOString())],
      ["Usuario de emisión", userName || "-"],
      ["Registros", String(limited.length)],
      ...(filterList.length ? [["Filtros", filterList.join(" · ")]] : []),
    ],
    columns,
    rows: limited,
    filename: `${fileBase}-${stamp}.xlsx`,
  });
}