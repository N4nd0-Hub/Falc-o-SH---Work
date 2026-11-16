// Tabela de custos SEINFRA-CE. "desonerada" = versão 028.1 (encargos 84,44%); "onerada" = versão 028 (encargos 114,15%).
export type Regime = "desonerada" | "onerada";
export const BASE = "https://sin.seinfra.ce.gov.br/site-seinfra/siproce";
export const VERSAO: Record<Regime, string> = { desonerada: "SEINFRA 028.1 desonerada (encargos 84,44%)", onerada: "SEINFRA 028 onerada (encargos 114,15%)" };
export const regimeDe = (v: string | null): Regime => (v === "onerada" ? "onerada" : "desonerada");

export const GRUPOS_SEINFRA: [number, string][] = [
  [1, "Serviços preliminares"], [2, "Movimento de terra"], [3, "Serviços preparatórios / escoramentos"], [4, "Drenagem e esgotamento"],
  [5, "Argamassas e concretos"], [6, "Fundações e estruturas"], [7, "Contenções"], [8, "Paredes e painéis"], [9, "Esquadrias e mobiliário"],
  [10, "Vidros"], [11, "Cobertura"], [12, "Impermeabilização"], [13, "Isolamento"], [14, "Revestimentos"], [15, "Pisos"],
  [16, "Instalações hidrossanitárias"], [17, "Ligações e hidrômetros"], [18, "Instalações elétricas"], [19, "Pintura"],
  [20, "Pavimentação"], [21, "Sinalização ferroviária/rodoviária/urbana"], [22, "Obras portuárias"], [23, "Transportes"],
  [24, "Sinalização viária"], [25, "Urbanização e paisagismo"], [26, "Muros, cercas e alambrados"], [27, "Climatização"],
  [28, "Gás"], [29, "Reformas e manutenção"], [30, "Indenizações e limpeza final"],
];

export const limpar = (v: string) => v.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
export const numero = (v: string) => Number(v.replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(",", "."));

export async function pagina(regime: Regime, nome: string) {
  const r = await fetch(`${BASE}/${regime}/html/${nome}`, { headers: { "user-agent": "FalcaoSHWork/1.0" }, next: { revalidate: 86400 } });
  if (!r.ok) throw new Error(`SEINFRA respondeu ${r.status}`);
  return r.text();
}
