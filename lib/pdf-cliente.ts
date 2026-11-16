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
