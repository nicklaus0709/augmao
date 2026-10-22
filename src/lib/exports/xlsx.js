// Exportación a Excel (.xlsx) generando el paquete OOXML directamente.
import { createZip, downloadBlob, xmlEscape } from "@/lib/exports/zip";

function colName(index) {
  let name = "";
  let n = index;
  while (n >= 0) {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  }
  return name;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="5"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="16"/><color rgb="FF1E2631"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FF607085"/><name val="Calibri"/></font><font><sz val="11"/><color rgb="FF1E2631"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1E2631"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF5F2EF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFDBDFE6"/></left><right style="thin"><color rgb="FFDBDFE6"/></right><top style="thin"><color rgb="FFDBDFE6"/></top><bottom style="thin"><color rgb="FFDBDFE6"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

function buildSheet({ sheetName, title, meta, columns, rows }) {
  const colCount = columns.length;
  const lastCol = colName(colCount - 1);
  const body = [];
  const merges = [`A1:${lastCol}1`];
  let row = 1;

  body.push(`<row r="1" ht="26" customHeight="1"><c r="A1" t="inlineStr" s="1"><is><t>${xmlEscape(title)}</t></is></c></row>`);
  row = 2;

  for (const [label, value] of meta) {
    body.push(
      `<row r="${row}"><c r="A${row}" t="inlineStr" s="2"><is><t>${xmlEscape(label)}</t></is></c><c r="B${row}" t="inlineStr" s="6"><is><t>${xmlEscape(value)}</t></is></c></row>`
    );
    row++;
  }

  body.push(`<row r="${row}"/>`);
  row++;

  const headerRow = row;
  body.push(
    `<row r="${headerRow}" ht="22" customHeight="1">` +
      columns
        .map((c, i) => `<c r="${colName(i)}${headerRow}" t="inlineStr" s="3"><is><t>${xmlEscape(c.label)}</t></is></c>`)
        .join("") +
      `</row>`
  );
  row++;

  for (const dataRow of rows) {
    const cells = columns
      .map((c, i) => {
        const ref = `${colName(i)}${row}`;
        const value = dataRow[i];
        if (typeof value === "number" && Number.isFinite(value)) return `<c r="${ref}" s="5"><v>${value}</v></c>`;
        return `<c r="${ref}" t="inlineStr" s="4"><is><t>${xmlEscape(value ?? "")}</t></is></c>`;
      })
      .join("");
    body.push(`<row r="${row}" ht="18" customHeight="1">${cells}</row>`);
    row++;
  }
  const lastDataRow = Math.max(headerRow, row - 1);

  const widths = columns.map((c, i) => {
    const lengths = rows.map((r) => String(r[i] ?? "").length).concat([String(c.label).length, 1]);
    return Math.min(50, Math.max(10, c.width || Math.max(...lengths) + 2));
  });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${widths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join("")}</cols><sheetData>${body.join("")}</sheetData><autoFilter ref="A${headerRow}:${lastCol}${lastDataRow}"/><mergeCells count="${merges.length}">${merges
    .map((m) => `<mergeCell ref="${m}"/>`)
    .join("")}</mergeCells></worksheet>`;
}

export function exportExcel({ sheetName, title, meta = [], columns, rows, filename }) {
  const safeSheet = String(sheetName || "Datos").replace(/[\\/?*[\]:]/g, "").slice(0, 31) || "Datos";

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(
    safeSheet
  )}" sheetId="1" r:id="rId1"/></sheets></workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

  const blob = createZip([
    { name: "[Content_Types].xml", data: CONTENT_TYPES },
    { name: "_rels/.rels", data: ROOT_RELS },
    { name: "xl/workbook.xml", data: workbook },
    { name: "xl/_rels/workbook.xml.rels", data: workbookRels },
    { name: "xl/styles.xml", data: STYLES },
    { name: "xl/worksheets/sheet1.xml", data: buildSheet({ sheetName: safeSheet, title, meta, columns, rows }) },
  ]);

  downloadBlob(blob, filename);
}