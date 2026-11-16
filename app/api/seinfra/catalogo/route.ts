import { GRUPOS_SEINFRA, VERSAO, limpar, numero, pagina, regimeDe } from "@/lib/seinfra";

export const maxDuration = 30;

// GET /api/seinfra/catalogo?grupo=11&regime=desonerada → serviços do grupo com preço
export async function GET(req: Request) {
  const u = new URL(req.url);
  const regime = regimeDe(u.searchParams.get("regime"));
  const grupo = Number(u.searchParams.get("grupo") || 0);
  if (!grupo) return Response.json({ grupos: GRUPOS_SEINFRA.map(([id, nome]) => ({ id, nome })) });
  if (!GRUPOS_SEINFRA.some(([id]) => id === grupo)) return Response.json({ erro: "Grupo inválido" }, { status: 400 });
  try {
    const indice = await pagina(regime, `${grupo}.html`);
    const subs = [...new Set([...indice.matchAll(new RegExp(`href="(${grupo}\\.\\d+)\\.html`, "g"))].map(m => m[1]))];
    const nomes = new Map<string, string>();
    for (const m of indice.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const c = [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(x => limpar(x[1]));
      if (c.length >= 2 && /^\d+\.\d+$/.test(c[0])) nomes.set(c[0], c[1]);
    }
    const paginas = await Promise.allSettled(subs.map(async s => ({ s, html: await pagina(regime, `${s}.html`) })));
    const itens: unknown[] = [];
    for (const p of paginas) {
      if (p.status !== "fulfilled") continue;
      const etapa = `${p.value.s} ${nomes.get(p.value.s) || ""}`.trim();
      for (const row of p.value.html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
        const c = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(x => limpar(x[1]));
        const i = c.findIndex(x => /^C\d{4}$/i.test(x));
        if (i < 0) continue;
        const preco = numero(c[i + 3] || "");
        if (!c[i + 1] || !Number.isFinite(preco) || preco <= 0) continue;
        const codigo = c[i].toUpperCase();
        itens.push({ id: `seinfra-${regime}-${codigo}`, etapa, codigo, descricao: c[i + 1], unidade: c[i + 2] || "UN", quantidade: 1, preco, fonte: VERSAO[regime], referencia: "Consulta oficial SEINFRA", url: `https://sin.seinfra.ce.gov.br/site-seinfra/siproce/${regime}/html/${codigo}.html`, online: true });
      }
    }
    return Response.json({ itens, versao: VERSAO[regime], atualizado: new Date().toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" }) }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } });
  } catch {
    return Response.json({ erro: "A SEINFRA não respondeu agora. Tente de novo em alguns minutos." }, { status: 502 });
  }
}
