import { arquivoUrl } from "@/lib/pncp";

export const maxDuration = 60;

// Repassa o download do arquivo do edital (o PNCP não exige login).
export async function GET(req: Request) {
  const u = new URL(req.url);
  const cnpj = (u.searchParams.get("cnpj") || "").replace(/\D/g, ""), ano = u.searchParams.get("ano") || "", seq = u.searchParams.get("seq") || "", n = u.searchParams.get("n") || "";
  if (cnpj.length !== 14 || !/^\d{4}$/.test(ano) || !/^\d+$/.test(seq) || !/^\d+$/.test(n)) return new Response("Parâmetros inválidos", { status: 400 });
  const r = await fetch(arquivoUrl(cnpj, ano, seq, n), { headers: { "user-agent": "FalcaoSHWork/1.0" } });
  if (!r.ok || !r.body) return new Response("Arquivo indisponível no PNCP", { status: 502 });
  const headers = new Headers();
  headers.set("content-type", r.headers.get("content-type") || "application/octet-stream");
  const cd = r.headers.get("content-disposition"); if (cd) headers.set("content-disposition", cd);
  const len = r.headers.get("content-length"); if (len) headers.set("content-length", len);
  return new Response(r.body, { headers });
}
