import { VERSAO, limpar, numero, pagina, regimeDe } from "@/lib/seinfra";

type Kind = "Material" | "Mão de obra" | "Equipamento" | "Serviço auxiliar";

// GET /api/seinfra/composicao?code=C1630&regime=desonerada → insumos e coeficientes
export async function GET(req: Request) {
  const u = new URL(req.url);
  const regime = regimeDe(u.searchParams.get("regime"));
  const code = (u.searchParams.get("code") || "").toUpperCase();
  if (!/^C\d{4}$/.test(code)) return Response.json({ erro: "Código inválido" }, { status: 400 });
  try {
    const html = await pagina(regime, `${code}.html`);
    const insumos: { id: string; tipo: Kind; codigo: string; descricao: string; fonte: string; unidade: string; coeficiente: number; preco: number }[] = [];
    let tipo: Kind = "Material";
    for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const c = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(x => limpar(x[1])).filter(Boolean);
      const titulo = (c[0] || "").toUpperCase();
      if (c.length <= 2 && !/^TOTAL/.test(titulo)) {
        if (/M[ÃA]O DE OBRA/.test(titulo)) tipo = "Mão de obra";
        else if (/EQUIPAMENTO/.test(titulo)) tipo = "Equipamento";
        else if (/SERVI[ÇC]O/.test(titulo)) tipo = "Serviço auxiliar";
        else if (/MATERIA/.test(titulo)) tipo = "Material";
        continue;
      }
      if (c.length >= 6 && /^[CI]\d{4}$/.test(c[0])) {
        const coeficiente = numero(c[3]), preco = numero(c[4]);
        if (Number.isFinite(coeficiente) && Number.isFinite(preco)) insumos.push({ id: `${code}-${insumos.length}`, tipo: c[0].startsWith("C") && tipo === "Material" ? "Serviço auxiliar" : tipo, codigo: c[0], descricao: c[1], fonte: VERSAO[regime], unidade: c[2], coeficiente, preco });
      }
    }
    const precoAdotado = numero(/Pre[çc]o Adotado:\s*([\d.,]+)/i.exec(limpar(html))?.[1] || "");
    return Response.json({ code, insumos, precoAdotado: Number.isFinite(precoAdotado) ? precoAdotado : null, versao: VERSAO[regime] }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } });
  } catch {
    return Response.json({ code, insumos: [], erro: "A SEINFRA não respondeu agora." }, { status: 502 });
  }
}
