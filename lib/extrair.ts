import { extractText, getDocumentProxy } from "unpdf";
import { unzipSync } from "fflate";
import type { ArquivoTexto } from "./requisitos";

const LIMITE_TEXTO = 450_000; // caracteres por arquivo

function tipoArquivo(b: Uint8Array) {
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "pdf";
  if (b[0] === 0x50 && b[1] === 0x4b) return "zip";
  if (b[0] === 0x52 && b[1] === 0x61 && b[2] === 0x72 && b[3] === 0x21) return "rar";
  if (b[0] === 0x37 && b[1] === 0x7a) return "7z";
  return "outro";
}

async function textoPdf(nome: string, dados: Uint8Array): Promise<ArquivoTexto> {
  try {
    const pdf = await getDocumentProxy(dados);
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    const t = String(text || "");
    const aviso = t.trim().length < 200 ? "PDF sem texto (provavelmente digitalizado como imagem). Leia manualmente." : undefined;
    return { titulo: nome, paginas: totalPages, texto: t.slice(0, LIMITE_TEXTO), aviso };
  } catch {
    return { titulo: nome, paginas: 0, texto: "", aviso: "Não consegui abrir este PDF." };
  }
}

export async function extrairTextos(entradas: { nome: string; dados?: Uint8Array; erro?: string }[]): Promise<ArquivoTexto[]> {
  const saida: ArquivoTexto[] = [];
  for (const e of entradas) {
    if (!e.dados) { saida.push({ titulo: e.nome, paginas: 0, texto: "", aviso: e.erro || "Arquivo indisponível." }); continue; }
    const tipo = tipoArquivo(e.dados);
    if (tipo === "pdf") saida.push(await textoPdf(e.nome, e.dados));
    else if (tipo === "zip") {
      try {
        const arquivos = unzipSync(e.dados, { filter: f => /\.pdf$/i.test(f.name) && f.originalSize < 40 * 1024 * 1024 });
        const nomes = Object.keys(arquivos).slice(0, 12);
        if (!nomes.length) saida.push({ titulo: e.nome, paginas: 0, texto: "", aviso: "Arquivo compactado sem PDFs dentro." });
        for (const n of nomes) saida.push(await textoPdf(`${e.nome} › ${n.split("/").pop()}`, arquivos[n]));
      } catch { saida.push({ titulo: e.nome, paginas: 0, texto: "", aviso: "Não consegui abrir o arquivo compactado (ZIP)." }); }
    } else if (tipo === "rar" || tipo === "7z") {
      saida.push({ titulo: e.nome, paginas: 0, texto: "", aviso: `Arquivo compactado em ${tipo.toUpperCase()}: baixe, descompacte e envie o PDF do edital manualmente.` });
    } else {
      saida.push({ titulo: e.nome, paginas: 0, texto: "", aviso: "Formato não lido automaticamente (não é PDF)." });
    }
  }
  return saida;
}
