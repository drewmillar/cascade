// Client-side exporters for the BOM (CSV + PDF) and the PFC (PDF).
// jsPDF is browser-only, so it's dynamically imported inside the handlers to
// keep it out of SSR. Exports reflect whatever the user currently sees.

import { STYLE_META } from "@/app/lib/design";
import { BOM_SECTIONS } from "@/app/lib/cascade";

export type BomExportRow = {
  section: string;
  partName: string;
  material: string;
  supplier: string;
  color: string;
};

export type PfcExportSection = {
  title: string;
  note: string;
  steps: string[];
};

function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Group rows in canonical section order.
function grouped(rows: BomExportRow[]) {
  return BOM_SECTIONS.map((section) => ({
    section,
    items: rows.filter((r) => r.section === section),
  })).filter((g) => g.items.length > 0);
}

export function exportBomCsv(rows: BomExportRow[]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    ["#", "Section", "Part name", "Material", "Supplier", "Color"]
      .map(esc)
      .join(","),
  ];
  let n = 0;
  for (const { section, items } of grouped(rows)) {
    for (const r of items) {
      n += 1;
      lines.push(
        [n, section, r.partName, r.material, r.supplier, r.color]
          .map(esc)
          .join(","),
      );
    }
  }
  download(
    `${STYLE_META.styleCode}_BOM.csv`,
    new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" }),
  );
}

export async function exportBomPdf(rows: BomExportRow[]) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  doc.setFontSize(15);
  doc.text("Bill of Materials", 40, 48);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    `${STYLE_META.styleName} · ${STYLE_META.styleCode} · ${STYLE_META.season}   |   Lead colorway: ${STYLE_META.leadColorway}`,
    40,
    64,
  );
  doc.setTextColor(20);

  type Cell =
    | string
    | number
    | { content: string; colSpan?: number; styles?: Record<string, unknown> };
  const body: Cell[][] = [];
  let n = 0;
  for (const { section, items } of grouped(rows)) {
    body.push([
      {
        content: `${section} (${items.length})`,
        colSpan: 5,
        styles: {
          fillColor: [234, 241, 253],
          textColor: [31, 111, 235],
          fontStyle: "bold",
        },
      },
    ]);
    for (const r of items) {
      n += 1;
      body.push([n, r.partName, r.material, r.supplier, r.color]);
    }
  }

  autoTable(doc, {
    startY: 80,
    head: [["#", "Part name", "Material", "Supplier", "Color"]],
    body,
    styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
    headStyles: { fillColor: [247, 246, 243], textColor: [60, 60, 60] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 120 },
      3: { cellWidth: 110 },
      4: { cellWidth: 70 },
    },
  });

  doc.save(`${STYLE_META.styleCode}_BOM.pdf`);
}

export async function exportPfcPdf(sections: PfcExportSection[]) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const M = 40;
  const W = doc.internal.pageSize.getWidth();
  const bottom = doc.internal.pageSize.getHeight() - 40;
  let y = 50;
  const ensure = (h: number) => {
    if (y + h > bottom) {
      doc.addPage();
      y = 50;
    }
  };

  doc.setFontSize(15);
  doc.text("Process Flow Chart", M, y);
  y += 16;
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    `${STYLE_META.styleName} · ${STYLE_META.styleCode} · Colorway 630780   |   Initial PFC — process parameters set by the factory`,
    M,
    y,
  );
  y += 22;
  doc.setTextColor(20);

  for (const sec of sections) {
    ensure(34);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(sec.title, M, y);
    y += 5;
    doc.setDrawColor(220);
    doc.line(M, y, W - M, y);
    y += 14;
    doc.setFont("helvetica", "normal");

    if (sec.note) {
      doc.setFontSize(8.5);
      doc.setTextColor(110);
      for (const l of doc.splitTextToSize(
        `Materials: ${sec.note}`,
        W - 2 * M,
      )) {
        ensure(12);
        doc.text(l, M, y);
        y += 11;
      }
      doc.setTextColor(20);
      y += 3;
    }

    doc.setFontSize(9);
    sec.steps.forEach((step, i) => {
      const lines: string[] = doc.splitTextToSize(
        `${i + 1}. ${step}`,
        W - 2 * M - 10,
      );
      ensure(lines.length * 12 + 2);
      lines.forEach((l, k) => {
        doc.text(l, M + (k === 0 ? 0 : 12), y);
        y += 12;
      });
      y += 2;
    });
    y += 12;
  }

  doc.save(`${STYLE_META.styleCode}_PFC.pdf`);
}
