// Acesso ao Portal Nacional de Contratações Públicas (dados públicos, sem login).
export const PNCP = "https://pncp.gov.br";
const UA = { "user-agent": "FalcaoSHWork/1.0 (+monitor de licitacoes)", accept: "application/json" };

export type ResultadoBusca = {
  pncp_id: string;
  orgao_cnpj: string;
  ano: number;
  sequencial: number;
  titulo: string;
  objeto: string;
  orgao_nome: string;
  unidade_nome: string;
  municipio: string;
  uf: string;
  modalidade: string;
  valor_estimado: number | null;
  publicado_em: string;
  fim_vigencia: string | null;
  palavra: string;
  url_pncp: string;
};

type ItemBusca = Record<string, unknown> & {
  numero_controle_pncp: string; orgao_cnpj: string; ano: string; numero_sequencial: string;
  title: string; description: string; orgao_nome: string; unidade_nome: string; municipio_nome: string; uf: string;
  modalidade_licitacao_nome: string; valor_total_estimado: number | null; data_publicacao_pncp: string; data_fim_vigencia: string | null; cancelado: boolean;
};

export async function buscarPncp(palavra: string, ufs: string[], pagina = 1, tamanho = 50): Promise<{ total: number; itens: ResultadoBusca[] }> {
  const montar = (q: string) => {
    const p: [string, string][] = [["q", q], ["tipos_documento", "edital"], ["ordenacao", "-data"], ["pagina", String(pagina)], ["tam_pagina", String(tamanho)], ["status", "recebendo_proposta"]];
    if (ufs.length) p.push(["ufs", ufs.join("|")]);
    return `${PNCP}/api/search/?` + p.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  };
  const tentativas = palavra.includes(" ") ? [`"${palavra}"`, palavra] : [palavra];
  let r: Response | null = null;
  for (const q of tentativas) {
    for (let i = 0; i < 2; i++) {
      r = await fetch(montar(q), { headers: UA, next: { revalidate: 900 } }).catch(() => null);
      if (r?.ok) break;
    }
    if (r?.ok) break;
  }
  if (!r?.ok) throw new Error(`PNCP respondeu ${r?.status ?? "sem resposta"}`);
  const j = (await r.json()) as { total: number; items: ItemBusca[] };
  const itens = (j.items || []).filter(i => !i.cancelado).map(i => ({
    pncp_id: i.numero_controle_pncp,
    orgao_cnpj: i.orgao_cnpj,
    ano: Number(i.ano),
    sequencial: Number(i.numero_sequencial),
    titulo: i.title,
    objeto: i.description,
    orgao_nome: i.orgao_nome,
    unidade_nome: i.unidade_nome,
    municipio: i.municipio_nome,
    uf: i.uf,
    modalidade: i.modalidade_licitacao_nome,
    valor_estimado: i.valor_total_estimado ?? null,
    publicado_em: i.data_publicacao_pncp,
    fim_vigencia: i.data_fim_vigencia,
    palavra,
    url_pncp: `${PNCP}/app/editais/${i.orgao_cnpj}/${i.ano}/${i.numero_sequencial}`,
  }));
  return { total: j.total, itens };
}

export type Arquivo = { n: number; titulo: string; tipo: string; url: string };

export async function detalhesCompra(cnpj: string, ano: string | number, seq: string | number) {
  const [c, a] = await Promise.all([
    fetch(`${PNCP}/api/consulta/v1/orgaos/${cnpj}/compras/${ano}/${seq}`, { headers: UA, next: { revalidate: 900 } }),
    fetch(`${PNCP}/pncp-api/v1/orgaos/${cnpj}/compras/${ano}/${seq}/arquivos`, { headers: UA, next: { revalidate: 900 } }),
  ]);
  if (!c.ok) throw new Error(`PNCP respondeu ${c.status}`);
  const compra = await c.json() as Record<string, unknown> & {
    objetoCompra: string; informacaoComplementar: string | null; dataAberturaProposta: string | null; dataEncerramentoProposta: string | null;
    linkSistemaOrigem: string | null; valorTotalEstimado: number | null; modalidadeNome: string; numeroCompra: string; processo: string;
    orgaoEntidade: { razaoSocial: string }; unidadeOrgao: { municipioNome: string; ufSigla: string; nomeUnidade: string }; situacaoCompraNome: string;
    numeroControlePNCP: string; modoDisputaNome: string; amparoLegal?: { nome: string };
  };
  const lista = a.ok ? (await a.json() as { sequencialDocumento: number; titulo: string; tipoDocumentoNome: string; statusAtivo: boolean }[]) : [];
  const arquivos: Arquivo[] = lista.filter(x => x.statusAtivo !== false).map(x => ({
    n: x.sequencialDocumento, titulo: x.titulo, tipo: x.tipoDocumentoNome,
    url: `${PNCP}/pncp-api/v1/orgaos/${cnpj}/compras/${ano}/${seq}/arquivos/${x.sequencialDocumento}`,
  }));
  return {
    pncp_id: compra.numeroControlePNCP,
    objeto: compra.objetoCompra,
    complemento: compra.informacaoComplementar,
    abertura: compra.dataAberturaProposta,
    encerramento: compra.dataEncerramentoProposta,
    link_origem: compra.linkSistemaOrigem,
    valor_estimado: compra.valorTotalEstimado,
    modalidade: compra.modalidadeNome,
    modo_disputa: compra.modoDisputaNome,
    numero: compra.numeroCompra,
    processo: compra.processo,
    orgao_nome: compra.orgaoEntidade?.razaoSocial,
    unidade_nome: compra.unidadeOrgao?.nomeUnidade,
    municipio: compra.unidadeOrgao?.municipioNome,
    uf: compra.unidadeOrgao?.ufSigla,
    situacao: compra.situacaoCompraNome,
    amparo: compra.amparoLegal?.nome,
    arquivos,
  };
}

export function arquivoUrl(cnpj: string, ano: string | number, seq: string | number, n: string | number) {
  return `${PNCP}/pncp-api/v1/orgaos/${cnpj}/compras/${ano}/${seq}/arquivos/${n}`;
}

export const somenteDigitos = (s: string | null) => (s || "").replace(/\D/g, "");
