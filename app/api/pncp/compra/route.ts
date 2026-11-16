import { detalhesCompra } from "@/lib/pncp";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const cnpj = (u.searchParams.get("cnpj") || "").replace(/\D/g, ""), ano = u.searchParams.get("ano") || "", seq = u.searchParams.get("seq") || "";
  if (cnpj.length !== 14 || !/^\d{4}$/.test(ano) || !/^\d+$/.test(seq)) return Response.json({ erro: "Parâmetros inválidos" }, { status: 400 });
  try {
    return Response.json(await detalhesCompra(cnpj, ano, seq));
  } catch (e) {
    return Response.json({ erro: e instanceof Error ? e.message : "Falha ao consultar o PNCP" }, { status: 502 });
  }
}
