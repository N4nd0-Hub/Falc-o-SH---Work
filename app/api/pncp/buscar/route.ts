import { buscarPncp, type ResultadoBusca } from "@/lib/pncp";

export const maxDuration = 30;

// GET /api/pncp/buscar?palavras=quadra|areninha&ufs=CE
export async function GET(req: Request) {
  const u = new URL(req.url);
  const palavras = (u.searchParams.get("palavras") || "").split("|").map(s => s.trim()).filter(Boolean).slice(0, 15);
  const ufs = (u.searchParams.get("ufs") || "").split(",").map(s => s.trim().toUpperCase()).filter(s => /^[A-Z]{2}$/.test(s));
  if (!palavras.length) return Response.json({ erro: "Informe ao menos uma palavra." }, { status: 400 });
  const resultados = await Promise.allSettled(palavras.map(p => buscarPncp(p, ufs)));
  const mapa = new Map<string, ResultadoBusca & { palavras: string[] }>();
  const falhas: string[] = [];
  resultados.forEach((r, i) => {
    if (r.status === "rejected") { falhas.push(palavras[i]); return; }
    for (const it of r.value.itens) {
      const atual = mapa.get(it.pncp_id);
      if (atual) atual.palavras.push(it.palavra);
      else mapa.set(it.pncp_id, { ...it, palavras: [it.palavra] });
    }
  });
  const itens = [...mapa.values()].sort((a, b) => (b.publicado_em || "").localeCompare(a.publicado_em || ""));
  return Response.json({ itens, falhas, consultadoEm: new Date().toISOString() }, { headers: { "Cache-Control": "private, max-age=300" } });
}
