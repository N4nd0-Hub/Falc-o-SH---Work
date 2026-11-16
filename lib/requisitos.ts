// Lê o texto do edital e encontra as exigências de habilitação.
// É uma leitura automática por palavras-chave: o resultado é um checklist para conferência humana.

import { TIPOS, tipoPorId, diasAte } from "./catalogo-docs";
import type { Documento, Empresa } from "./supabase";

export type ArquivoTexto = { titulo: string; paginas: number; texto: string; aviso?: string };

type Regra = { id: string; doc: string; padroes: RegExp[] };

export const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");

const REGRAS: Regra[] = [
  { id: "contrato_social", doc: "contrato_social", padroes: [/ato constitutivo/, /contrato social/, /estatuto social/] },
  { id: "cnpj", doc: "cnpj", padroes: [/prova de inscricao no cadastro nacional d[ae] pessoa/, /inscricao no cnpj/, /cartao (do )?cnpj/] },
  { id: "cnd_federal", doc: "cnd_federal", padroes: [/divida ativa da uniao/, /tributos federais/, /creditos tributarios federais/, /fazenda federal/, /receita federal/] },
  { id: "crf_fgts", doc: "crf_fgts", padroes: [/\bfgts\b/, /fundo de garantia/] },
  { id: "cndt", doc: "cndt", padroes: [/debitos trabalhistas/, /\bcndt\b/, /inexistencia de debitos inadimplidos perante a justica do trabalho/] },
  { id: "cnd_estadual", doc: "cnd_estadual", padroes: [/fazenda (publica )?estadual/, /debitos estaduais/, /tributos estaduais/, /fazenda (publica )?do estado/] },
  { id: "cnd_municipal", doc: "cnd_municipal", padroes: [/fazenda (publica )?municipal/, /debitos municipais/, /tributos municipais/, /fazenda (publica )?do municipio/] },
  { id: "inscricao_estadual", doc: "inscricao_estadual", padroes: [/cadastro de contribuintes estadua/, /inscricao estadual/] },
  { id: "inscricao_municipal", doc: "inscricao_municipal", padroes: [/cadastro de contribuintes municipa/, /inscricao municipal/] },
  { id: "balanco", doc: "balanco", padroes: [/balanco patrimonial/, /demonstracoes contabeis/] },
  { id: "falencia", doc: "falencia", padroes: [/falencia/, /recuperacao judicial/] },
  { id: "crea_pj", doc: "crea_pj", padroes: [/(registro|inscricao|certidao)[^.;]{0,90}\b(crea|cau)\b/, /conselho regional de engenharia/, /entidade profissional competente/] },
  { id: "crea_rt", doc: "crea_rt", padroes: [/responsave(l|is) tecnico/] },
  { id: "cat", doc: "cat", padroes: [/acervo tecnico/, /\bcat\b/, /\bcats\b/] },
  { id: "atestado_capacidade", doc: "atestado_capacidade", padroes: [/capacidade tecnic[oa]/, /atestado(s)? de capacidade/] },
  { id: "vinculo_rt", doc: "vinculo_rt", padroes: [/quadro permanente/, /vinculo (profissional|com a (empresa|licitante))/] },
  { id: "sicaf", doc: "sicaf", padroes: [/\bsicaf\b/] },
  { id: "crc_estadual", doc: "crc_estadual", padroes: [/certificado de registro cadastral/, /\bcrc\b/] },
  { id: "garantia", doc: "garantia", padroes: [/garantia (da|de) proposta/] },
];

export type Situacao = "ok" | "vence_antes" | "vencido" | "falta" | "sem_arquivo" | "conferir";

export type ItemRelatorio = {
  id: string;
  doc: string;
  nome: string;
  grupo: string;
  detectado: boolean; // encontrado no edital (false = item padrão, edital não lido)
  trecho?: string;
  arquivoEdital?: string;
  situacao: Situacao;
  explicacao: string;
  documentoId?: string;
};

export type Alerta = { tipo: "atencao" | "info" | "problema"; titulo: string; texto: string; trecho?: string };

export type Relatorio = {
  geradoEm: string;
  arquivosLidos: { titulo: string; paginas: number; aviso?: string }[];
  editalLido: boolean;
  itens: ItemRelatorio[];
  alertas: Alerta[];
  resumo: { ok: number; pendentes: number; total: number };
};

function trechoEm(textoOriginal: string, textoNorm: string, idx: number, tam = 260) {
  // o texto normalizado tem o mesmo tamanho do original na maior parte dos casos;
  // usamos o normalizado para achar e o original para mostrar
  const ini = Math.max(0, idx - 90), fim = Math.min(textoNorm.length, idx + tam);
  const fonte = textoOriginal.length === textoNorm.length ? textoOriginal : textoNorm;
  return (ini > 0 ? "…" : "") + fonte.slice(ini, fim).replace(/\s+/g, " ").trim() + (fim < textoNorm.length ? "…" : "");
}

function achar(arquivos: { titulo: string; orig: string; n: string }[], padroes: RegExp[]) {
  for (const a of arquivos) for (const p of padroes) {
    const m = p.exec(a.n);
    if (m) return { arquivo: a.titulo, trecho: trechoEm(a.orig, a.n, m.index) };
  }
  return null;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const numBr = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));

export function gerarRelatorio(opts: {
  arquivos: ArquivoTexto[];
  documentos: Documento[];
  empresa: Empresa | null;
  abertura: string | null; // data limite das propostas
  valorEstimado: number | null;
}): Relatorio {
  const { documentos, empresa, abertura, valorEstimado } = opts;
  const arquivos = opts.arquivos.filter(a => a.texto && a.texto.trim().length > 200).map(a => {
    const orig = a.texto.replace(/\s+/g, " ");
    return { titulo: a.titulo, orig, n: norm(orig) };
  });
  const editalLido = arquivos.length > 0;
  const dataRef = abertura ? abertura.slice(0, 10) : null;
  const itens: ItemRelatorio[] = [];
  const alertas: Alerta[] = [];

  const usados = new Set<string>();
  const regrasAplicaveis = editalLido ? REGRAS : REGRAS.filter(r => tipoPorId(r.doc)?.basico);

  for (const r of regrasAplicaveis) {
    const tipo = tipoPorId(r.doc)!;
    const achado = editalLido ? achar(arquivos, r.padroes) : null;
    if (editalLido && !achado) continue;
    usados.add(r.doc);
    const docs = documentos.filter(d => d.tipo === r.doc);
    let situacao: Situacao = "falta", explicacao = "Não há este documento no cofre. Providencie e cadastre em Documentos.", documentoId: string | undefined;
    if (docs.length) {
      // escolhe o documento com validade mais longa
      const melhor = [...docs].sort((a, b) => (b.validade || "9999").localeCompare(a.validade || "9999"))[0];
      documentoId = melhor.id;
      const diasHoje = diasAte(melhor.validade);
      const diasAbertura = dataRef && melhor.validade ? diasAte(melhor.validade, new Date(dataRef + "T12:00:00")) : null;
      if (!melhor.arquivo_path) { situacao = "sem_arquivo"; explicacao = "Cadastrado, mas sem o arquivo (PDF) anexado."; }
      else if (tipo.temValidade && diasHoje !== null && diasHoje < 0) { situacao = "vencido"; explicacao = `Vencido desde ${fmtData(melhor.validade)}. Tire uma nova via.`; }
      else if (tipo.temValidade && diasAbertura !== null && diasAbertura < 0) { situacao = "vence_antes"; explicacao = `Vale até ${fmtData(melhor.validade)}, antes da data da licitação (${fmtData(dataRef)}). Renove antes de enviar.`; }
      else if (tipo.temValidade && !melhor.validade) { situacao = "conferir"; explicacao = "Cadastrado sem data de validade. Confira a data no documento."; }
      else { situacao = "ok"; explicacao = tipo.temValidade && melhor.validade ? `Válido até ${fmtData(melhor.validade)}.` : "Documento no cofre."; }
      if (tipo.multiplo && (r.doc === "cat" || r.doc === "atestado_capacidade")) {
        situacao = situacao === "ok" ? "conferir" : situacao;
        explicacao = `${docs.length} no cofre. Confira se algum comprova serviço parecido e com a quantidade mínima pedida no edital (veja o trecho).`;
      }
    }
    itens.push({ id: r.id, doc: r.doc, nome: tipo.nome, grupo: tipo.grupo, detectado: !!achado, trecho: achado?.trecho, arquivoEdital: achado?.arquivo, situacao, explicacao, documentoId });
  }

  if (editalLido) {
    const tudo = arquivos.map(a => ({ titulo: a.titulo, orig: a.orig, n: a.n }));

    const visita = achar(tudo, [/visita tecnica/, /vistoria (tecnica|previa|ao local)/]);
    if (visita) alertas.push({ tipo: "atencao", titulo: "Visita técnica / vistoria", texto: "O edital fala em visita técnica ou vistoria. Veja se é obrigatória e qual o prazo para agendar.", trecho: visita.trecho });

    const relevancia = achar(tudo, [/parcela(s)? de maior relevancia/, /quantitativos? minimos?/]);
    if (relevancia) alertas.push({ tipo: "atencao", titulo: "Parcelas de maior relevância", texto: "O edital exige experiência em serviços específicos com quantidade mínima. Compare com as CATs e atestados.", trecho: relevancia.trecho });

    // capital social / patrimônio líquido mínimo
    for (const a of tudo) {
      const m = /(capital social|patrimonio liquido)[^.;]{0,160}?(\d{1,2}(?:,\d+)?)\s?%/.exec(a.n);
      if (m) {
        const pct = numBr(m[2]);
        const qual = m[1] === "capital social" ? "capital social" : "patrimônio líquido";
        let texto = `O edital pede ${qual} mínimo de ${m[2]}% do valor estimado.`;
        let tipo: Alerta["tipo"] = "atencao";
        if (valorEstimado) {
          const exigido = valorEstimado * pct / 100;
          const temos = qual === "capital social" ? empresa?.capital_social : (empresa?.patrimonio_liquido ?? empresa?.capital_social);
          texto += ` Isso dá ${brl(exigido)}.`;
          if (temos != null) {
            if (temos >= exigido) { texto += ` A empresa tem ${brl(temos)}: atende.`; tipo = "info"; }
            else { texto += ` A empresa tem ${brl(temos)}: NÃO atende.`; tipo = "problema"; }
          } else texto += " Cadastre o capital social / patrimônio em Empresa para o sistema conferir.";
        }
        alertas.push({ tipo, titulo: `${qual[0].toUpperCase()}${qual.slice(1)} mínimo`, texto, trecho: trechoEm(a.orig, a.n, m.index) });
        break;
      }
    }

    // índices contábeis
    const indices: { nome: string; campo: keyof Empresa; re: RegExp }[] = [
      { nome: "Liquidez Geral", campo: "liquidez_geral", re: /liquidez geral[^.;]{0,120}?(igual ou )?(superior|maior)[^0-9]{0,30}(\d+,\d+|\d+)/ },
      { nome: "Liquidez Corrente", campo: "liquidez_corrente", re: /liquidez corrente[^.;]{0,120}?(igual ou )?(superior|maior)[^0-9]{0,30}(\d+,\d+|\d+)/ },
      { nome: "Solvência Geral", campo: "solvencia_geral", re: /solvencia geral[^.;]{0,120}?(igual ou )?(superior|maior)[^0-9]{0,30}(\d+,\d+|\d+)/ },
    ];
    const achados: string[] = [];
    let problema = false;
    for (const ind of indices) {
      for (const a of tudo) {
        const m = ind.re.exec(a.n);
        if (!m) continue;
        const minimo = numBr(m[3]);
        const temos = empresa?.[ind.campo] as number | null | undefined;
        if (temos == null) achados.push(`${ind.nome} ≥ ${m[3]} (cadastre o índice em Empresa)`);
        else if (temos >= minimo) achados.push(`${ind.nome} ≥ ${m[3]}: empresa tem ${temos.toLocaleString("pt-BR")} ✓`);
        else { achados.push(`${ind.nome} ≥ ${m[3]}: empresa tem ${temos.toLocaleString("pt-BR")} ✗`); problema = true; }
        break;
      }
    }
    if (achados.length) alertas.push({ tipo: problema ? "problema" : "atencao", titulo: "Índices contábeis", texto: achados.join(" • ") });

    const garantia = achar(tudo, [/garantia (da|de) proposta[^.;]{0,120}?(\d(?:,\d+)?)\s?%/]);
    if (garantia) alertas.push({ tipo: "atencao", titulo: "Garantia da proposta", texto: "O edital pede garantia junto com a proposta. Providencie com antecedência (seguradora/banco).", trecho: garantia.trecho });

    const declaracoes = achar(tudo, [/declaracao (de que|que)/, /declaracoes/]);
    if (declaracoes) alertas.push({ tipo: "info", titulo: "Declarações", texto: "O edital pede declarações da empresa (por exemplo, sobre menores de idade, ME/EPP e cumprimento de requisitos). Elas são preenchidas e assinadas na hora do envio." });

    const plataforma = achar(tudo, [/(licitacoes-e|comprasnet|compras\.gov\.br|bll|portal de compras publicas|licitanet|bnc|bolsa nacional de compras)/]);
    if (plataforma) alertas.push({ tipo: "info", titulo: "Plataforma de disputa", texto: "O edital indica em qual plataforma eletrônica a disputa acontece. Verifique se a empresa já tem cadastro nela.", trecho: plataforma.trecho });
  } else {
    alertas.push({ tipo: "atencao", titulo: "Edital não foi lido automaticamente", texto: "Não consegui ler o texto do edital (arquivo ausente, compactado em RAR ou digitalizado como imagem). A lista abaixo mostra os documentos que quase todo edital de obra pede. Envie o PDF do edital para uma análise completa." });
  }

  // documentos básicos que não apareceram no texto
  if (editalLido) {
    const faltandoNoTexto = TIPOS.filter(t => t.basico && !usados.has(t.id) && REGRAS.some(r => r.doc === t.id)).map(t => t.nome);
    if (faltandoNoTexto.length) alertas.push({ tipo: "info", titulo: "Não encontrados no texto do edital", texto: `Não achei menção a: ${faltandoNoTexto.join("; ")}. Pode ser que o edital use outras palavras. Vale conferir.` });
  }

  const ok = itens.filter(i => i.situacao === "ok").length;
  return {
    geradoEm: new Date().toISOString(),
    arquivosLidos: opts.arquivos.map(a => ({ titulo: a.titulo, paginas: a.paginas, aviso: a.aviso })),
    editalLido,
    itens,
    alertas,
    resumo: { ok, pendentes: itens.length - ok, total: itens.length },
  };
}

export function fmtData(d: string | null | undefined) {
  if (!d) return "—";
  const s = d.slice(0, 10).split("-");
  return s.length === 3 ? `${s[2]}/${s[1]}/${s[0]}` : d;
}
