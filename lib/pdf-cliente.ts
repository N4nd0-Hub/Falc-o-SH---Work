"use client";
import type { ArquivoTexto } from "./requisitos";

// Lê o texto de um PDF no próprio navegador (para editais enviados manualmente).
export async function lerPdfNoNavegador(file: File): Promise<ArquivoTexto> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const partes: string[] = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const c = await page.getTextContent();
      partes.push((c.items as { str?: string }[]).map(i => i.str || "").join(" "));
    }
  } finally { await doc.destroy(); }
  const texto = partes.join("\n");
  return { titulo: file.name, paginas: doc.numPages, texto, aviso: texto.trim().length < 200 ? "PDF sem texto (provavelmente digitalizado). Leia manualmente." : undefined };
}

/** Lê o PDF mantendo as linhas (agrupa os textos pela altura na página), como o "pdftotext -layout". */
export async function lerLinhasPdf(file: File): Promise<{ linhas: string[]; paginas: number }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const linhas: string[] = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const c = await page.getTextContent();
      const grupos = new Map<number, { x: number; s: string }[]>();
      for (const raw of c.items as { str?: string; transform?: number[] }[]) {
        if (!raw.str) continue;
        const y = Math.round(raw.transform?.[5] || 0), x = raw.transform?.[4] || 0;
        const perto = [...grupos.keys()].find(k => Math.abs(k - y) <= 2);
        const k = perto ?? y;
        grupos.set(k, [...(grupos.get(k) || []), { x, s: raw.str }]);
      }
      for (const [, row] of [...grupos.entries()].sort((a, b) => b[0] - a[0])) linhas.push(row.sort((a, b) => a.x - b.x).map(r => r.s).join("  ").replace(/\s+/g, " ").trim());
    }
  } finally { await doc.destroy(); }
  return { linhas, paginas: doc.numPages };
}
