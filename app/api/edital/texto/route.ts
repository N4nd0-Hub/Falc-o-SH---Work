import { arquivoUrl, detalhesCompra } from "@/lib/pncp";
import { extrairTextos } from "@/lib/extrair";

export const maxDuration = 60;

// POST { cnpj, ano, seq } → baixa os arquivos do edital no PNCP e devolve o texto de cada PDF
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { cnpj?: string; ano?: string | number; seq?: string | number };
  const cnpj = String(body.cnpj || "").replace(/\D/g, ""), ano = String(body.ano || ""), seq = String(body.seq || "");
  if (cnpj.length !== 14 || !/^\d{4}$/.test(ano) || !/^\d+$/.test(seq)) return Response.json({ erro: "Parâmetros inválidos" }, { status: 400 });
  let det;
  try { det = await detalhesCompra(cnpj, ano, seq); } catch { return Response.json({ erro: "Não consegui consultar o PNCP agora." }, { status: 502 }); }
  const lista = det.arquivos.slice(0, 8);
  const baixados = await Promise.all(lista.map(async a => {
    try {
      const r = await fetch(arquivoUrl(cnpj, ano, seq, a.n), { headers: { "user-agent": "FalcaoSHWork/1.0" } });
      if (!r.ok) return { nome: a.titulo, erro: `download falhou (${r.status})` };
      const tam = Number(r.headers.get("content-length") || 0);
      if (tam > 40 * 1024 * 1024) return { nome: a.titulo, erro: "arquivo grande demais para leitura automática" };
      return { nome: a.titulo, dados: new Uint8Array(await r.arrayBuffer()) };
    } catch { return { nome: a.titulo, erro: "download falhou" }; }
  }));
  const arquivos = await extrairTextos(baixados);
  return Response.json({ arquivos, totalArquivos: det.arquivos.length });
}
