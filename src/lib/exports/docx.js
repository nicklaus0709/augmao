// Nota de pedido en Word (.docx) generando el paquete OOXML directamente.
import { createZip, downloadBlob, xmlEscape } from "@/lib/exports/zip";

const FONT = `Calibri`;

function run(text, opts = {}) {
  const rpr = [
    opts.bold ? "<w:b/>" : "",
    opts.italic ? "<w:i/>" : "",
    opts.size ? `<w:sz w:val="${opts.size}"/><w:szCs w:val="${opts.size}"/>` : "",
    opts.color ? `<w:color w:val="${opts.color}"/>` : "",
    `<w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}"/>`,
  ]
    .filter(Boolean)
    .join("");
  return `<w:r><w:rPr>${rpr}</w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

function para(runs, opts = {}) {
  const ppr = [opts.align ? `<w:jc w:val="${opts.align}"/>` : ""]
    .concat(opts.border !== false ? [] : [])
    .filter(Boolean)
    .join("");
  return `<w:p><w:pPr>${ppr}</w:pPr>${runs.join("")}</w:p>`;
}

function linePara() {
  return `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="1" w:color="1E2631"/></w:pBdr></w:pPr></w:p>`;
}

function cell(content, opts = {}) {
  const width = opts.width || 2000;
  const shade = opts.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${opts.fill}"/>` : "";
  const runs = opts.runs || [run(content, opts.runOpts || {})];
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${shade}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="${opts.align || "left"}"/></w:pPr>${runs.join(
    ""
  )}</w:p></w:tc>`;
}

function table(headerCells, bodyRows) {
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="single" w:sz="6" w:color="DBDFE6"/><w:left w:val="single" w:sz="6" w:color="DBDFE6"/><w:bottom w:val="single" w:sz="6" w:color="DBDFE6"/><w:right w:val="single" w:sz="6" w:color="DBDFE6"/><w:insideH w:val="single" w:sz="6" w:color="DBDFE6"/><w:insideV w:val="single" w:sz="6" w:color="DBDFE6"/></w:tblBorders></w:tblPr><w:tblGrid>${headerCells
    .map((c) => `<w:gridCol w:w="${c.width || 2000}"/>`)
    .join("")}</w:tblGrid><w:tr><w:trPr><w:tblHeader/></w:trPr>${headerCells
    .map((c) => cell(c.label, { width: c.width, fill: "1E2631", align: c.align, runOpts: { bold: true, color: "FFFFFF", size: 20 } }))
    .join("")}</w:tr>${bodyRows
    .map((row) => `<w:tr>${row.map((value, i) => cell(value, { width: headerCells[i]?.width, align: headerCells[i]?.align, runOpts: { size: 20 } })).join("")}</w:tr>`)
    .join("")}</w:tbl>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

// Nota de pedido para un repuesto.
export function exportPurchaseNoteDocx({ part, quantity, supplier, notes, userName, number, date, filename }) {
  const unitLabel = part.unit_label || part.unit || "-";
  const unitCost = Number(part.unit_cost || 0);
  const subtotal = unitCost * Number(quantity || 0);

  const header = `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="none" w:sz="0"/><w:left w:val="none" w:sz="0"/><w:bottom w:val="none" w:sz="0"/><w:right w:val="none" w:sz="0"/><w:insideH w:val="none" w:sz="0"/><w:insideV w:val="none" w:sz="0"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="5000"/><w:gridCol w:w="4000"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="5000" w:type="dxa"/></w:tcPr><w:p><w:pPr/></w:p>${para(
    [run("AuGmao", { bold: true, size: 32, color: "1E2631" }), run("· Gestión de Mantenimiento", { size: 20, color: "607085" })]
  )}</w:tc><w:tc><w:tcPr><w:tcW w:w="4000" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/></w:pPr>${run("NOTA DE PEDIDO", {
    bold: true,
    size: 30,
    color: "1E2631",
  })}</w:p><w:p><w:pPr><w:jc w:val="right"/></w:pPr>${run("N° " + number, { size: 20, color: "607085" })}</w:p><w:p><w:pPr><w:jc w:val="right"/></w:pPr>${run(
    "Fecha de emisión: " + date,
    { size: 20, color: "607085" }
  )}</w:p>${linePara()}</w:tc></w:tr></w:tbl>`;

  const body = [
    header,
    para([]),
    para([run("Proveedor: " + (supplier || ""), { bold: true, size: 22 })]),
    para([run("Solicitado por: " + (userName || ""), { size: 22 })]),
    para([]),
    para([run("De nuestra consideración:", { size: 22 })]),
    para([
      run("Por medio de la presente solicitamos la provisión del siguiente producto, indicando precio, condiciones de pago y plazo de entrega:", {
        size: 22,
      }),
    ]),
    para([]),
    table(
      [
        { label: "Código", width: 1500 },
        { label: "Descripción", width: 3500 },
        { label: "Unidad", width: 1500 },
        { label: "Cantidad", width: 1500, align: "right" },
        { label: "Precio unit. ref.", width: 2000, align: "right" },
        { label: "Subtotal ref.", width: 2000, align: "right" },
      ],
      [
        [
          part.code,
          part.name,
          unitLabel,
          String(quantity),
          unitCost ? formatMoneyDoc(unitCost) : "-",
          unitCost ? formatMoneyDoc(subtotal) : "-",
        ],
      ]
    ),
    para([]),
    para([
      run(
        `Stock actual: ${part.stock_current ?? 0} · Stock mínimo: ${part.stock_minimum ?? 0} · Ubicación: ${part.location || "-"}`,
        { size: 20, color: "607085" }
      ),
    ]),
  ];

  if (notes) body.push(para([run("Observaciones: " + notes, { size: 20 })]));

  body.push(
    para([run("Los precios de referencia son orientativos y corresponden al último costo registrado.", { italic: true, size: 19, color: "607085" })]),
    para([]),
    para([run("Sin otro particular, saludamos atentamente.", { size: 22 })]),
    para([]),
    linePara(),
    para([run("Solicitado por: " + (userName || ""), { size: 20, color: "607085" })]),
    para([]),
    linePara(),
    para([run("Autorizado por", { size: 20, color: "607085" })])
  );

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join(
    ""
  )}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;

  const blob = createZip([
    { name: "[Content_Types].xml", data: CONTENT_TYPES },
    { name: "_rels/.rels", data: ROOT_RELS },
    { name: "word/document.xml", data: document },
  ]);

  downloadBlob(blob, filename);
}

function formatMoneyDoc(value) {
  const [int, dec] = Number(value || 0).toFixed(2).split(".");
  return "$ " + int.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + dec;
}