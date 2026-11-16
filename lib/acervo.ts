// Acervo técnico: leitura de CAT / CAO do CREA e de atestados com planilha,
// e comparação com as "parcelas de maior relevância" exigidas no edital.

export type TipoAcervo = "cat" | "cao" | "atestado" | "outro";
export const TIPOS_ACERVO: Record<TipoAcervo, { nome: string; dica: string }> = {
  cat: { nome: "CAT – Acervo Técnico (profissional)", dica: "Certidão do CREA com o acervo do engenheiro. Comprova a capacidade técnico-profissional." },
  cao: { nome: "CAO – Acervo Operacional (empresa)", dica: "Certidão do CREA com o acervo da empresa. Comprova a capacidade técnico-operacional." },
  atestado: { nome: "Atestado de capacidade técnica", dica: "Emitido pelo contratante da obra, normalmente com a planilha de serviços." },
  outro: { nome: "Outro comprovante", dica: "Termo de recebimento, contrato, ART etc." },
};

export type Servico = { descricao: string; unidade: string; quantidade: number; origem?: "CREA" | "Planilha" | "Manual"; codigo?: string };
export type Obra = { art?: string; contratante?: string; local?: string; valor?: number | null; inicio?: string; fim?: string; objeto?: string; servicos: Servico[] };
export type Acervo = {
  id: string; tipo: TipoAcervo; titulo: string; numero: string | null; profissional: string | null; observacao: string | null;
  obras: Obra[]; arquivo_path: string | null; arquivo_nome: string | null; criado_em?: string; atualizado_em?: string;
};

const num = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));
const numCrea = (s: string) => Number(s.replace(/,/g, "")); // CREA usa ponto decimal: 1518.55
const limpa = (s: string) => s.replace(/\s+/g, " ").trim();

export function unidade(u: string): string {
  const x = u.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").trim();
  if (/^(m2|metros? quadrados?)$/.test(x)) return "m²";
  if (/^(m3|metros? cubicos?)$/.test(x)) return "m³";
  if (/^(m|ml|metros?|metro linear)$/.test(x)) return "m";
  if (/^(un|und|unid|unidades?|cj|conjuntos?|pt|par|vb)$/.test(x)) return "un";
  if (/^(kg|quilogramas?)$/.test(x)) return "kg";
  if (/^(t|tonelada?s?)$/.test(x)) return "t";
  if (/^(l|litros?)$/.test(x)) return "L";
  if (/^(kva|quilovolt-ampere)$/.test(x)) return "kVA";
  if (/^(km|quilometros?)$/.test(x)) return "km";
  return u.trim();
}

/** Lê o texto (já em linhas) de uma CAT/CAO/atestado e tenta montar o acervo. */
export function lerAcervo(linhas: string[]): Omit<Acervo, "id" | "arquivo_path" | "arquivo_nome"> {
  const texto = limpa(linhas.join(" "));
  const tipo: TipoAcervo = /Acervo Operacional/i.test(texto) ? "cao" : /Acervo T[ée]cnico/i.test(texto) ? "cat" : /ATESTADO DE CAPACIDADE/i.test(texto) ? "atestado" : "outro";
  const numero = /Certid[ãa]o de Acervo (?:T[ée]cnico|Operacional)\s*[–-]?\s*(?:CAT|CAO)?\s*n[ºo°]\s*([\d/]+)/i.exec(texto)?.[1] || null;
  const profissional = /Profissional:\s*(.+?)\s+Registro:/i.exec(texto)?.[1] || /Respons[áa]vel T[ée]cnico:\s*([A-ZÀ-Ú][A-Za-zÀ-ú ]+?)[,\n]/.exec(texto)?.[1] || null;
  const obras: Obra[] = [];

  // Blocos de ART (CAT/CAO do CREA)
  const blocos = texto.split(/N[úu]mero da ART:/i).slice(1);
  for (const b of blocos) {
    const art = /^\s*(\S+)/.exec(b)?.[1];
    const contratante = /Contratante\.?:\s*(.+?)\s+CPF\/CNPJ/i.exec(b)?.[1];
    const obraEnd = b.split(/Endere[çc]o da obra/i)[1] || b;
    const cidade = /Cidade:\s*([A-ZÀ-Úa-zà-ú' ]+?)\s+UF:\s*([A-Z]{2})/.exec(obraEnd);
    const valor = /Valor do contrato:\s*R\$\s*([\d.,]+)/i.exec(b)?.[1];
    const inicio = /Data de in[íi]cio:\s*([\d/]+)/i.exec(b)?.[1];
    const fim = /(?:Conclus[ãa]o efetiva|Previs[ãa]o de t[ée]rmino):\s*([\d/]+)/i.exec(b)?.[1];
    const objeto = /Observa[çc][õo]es\s+(.+?)\s+Informa[çc][õo]es Complementares/i.exec(b)?.[1];
    const servicos: Servico[] = [];
    const ativ = b.split(/Atividade T[ée]cnica:/i).slice(1).join(" ");
    const re = /(?:^|;)\s*([^;#]*?)#([\d.]+)\s*-\s*([^;#]+?)\s+\d{1,3}\s*-\s*[A-Za-zÀ-ú ]+?\s+(\d+(?:\.\d+)?)\s+([a-zà-ú\- ]+?)\s*(?=;|$)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(ativ))) {
      const caminho = m[1].replace(/^\s*\d+\s*-\s*\S+\s*/, "").split(">").map(s => s.trim()).filter(Boolean);
      const contexto = caminho.slice(-2).join(" › ");
      servicos.push({ descricao: limpa(`${contexto ? contexto + " › " : ""}${m[3]}`), unidade: unidade(m[5]), quantidade: numCrea(m[4]), origem: "CREA", codigo: m[2] });
    }
    // formato antigo (migração): "EDF. DE ALVENARIA ... 66 - RESPONSAVEL TECNICO 1450 METRO QUADRADO;"
    if (!servicos.length) {
      const antigo = /> *[\dA-Z]+ *- *([^;]+?)\s+\d{2}\s*-\s*[A-ZÀ-Ú ]+?\s+([\d.,]+)\s+(METRO QUADRADO|METRO CUBICO|METRO|UNIDADE)/i.exec(ativ);
      if (antigo) servicos.push({ descricao: limpa(antigo[1]), unidade: unidade(antigo[3]), quantidade: numCrea(antigo[2].replace(",", ".")), origem: "CREA" });
    }
    obras.push({ art, contratante: contratante && limpa(contratante), local: cidade ? `${limpa(cidade[1])}/${cidade[2]}` : undefined, valor: valor ? num(valor) : null, inicio, fim, objeto: objeto && limpa(objeto), servicos });
  }

  // Planilha de atestado (linhas com item, código, fonte, unidade e quantidade)
  const plan = lerPlanilha(linhas);
  if (plan.length) {
    const contratante = /CONTRATANTE:\s*Nome:\s*(.+?)\s+CNPJ/i.exec(texto)?.[1];
    const objeto = /Objeto:\s*(.+?)\s+(?:PLANILHA|Per[íi]odo|$)/i.exec(texto)?.[1];
    const contrato = /Contrato n[ºo°]:\s*(\S+)/i.exec(texto)?.[1];
    obras.push({ art: contrato ? `Contrato ${contrato}` : undefined, contratante: contratante && limpa(contratante), objeto: objeto && limpa(objeto).slice(0, 400), servicos: plan });
  }
  if (!obras.length && tipo === "atestado") {
    const contratante = /CONTRATANTE:\s*Nome:\s*(.+?)\s+CNPJ/i.exec(texto)?.[1];
    const objeto = /Objeto:\s*(.+?)\s+(?:PLANILHA|Per[íi]odo|$)/i.exec(texto)?.[1];
    obras.push({ contratante: contratante && limpa(contratante), objeto: objeto && limpa(objeto).slice(0, 400), servicos: [] });
  }

  const primeiro = obras.find(o => o.contratante);
  const titulo = limpa(`${TIPOS_ACERVO[tipo].nome.split(" (")[0].split(" –")[0]}${numero ? " nº " + numero : ""}${primeiro?.contratante ? " — " + primeiro.contratante : ""}`).slice(0, 160);
  return { tipo, titulo, numero, profissional: profissional && limpa(profissional), observacao: null, obras };
}

const RE_ITEM = /^\s*(\d+(?:\.\d+){1,3})\.?\s+([A-Z]{0,3}\d{3,6}[A-Z]?)\s*(.*?)\s*(SEINFRA|SINAPI|ORSE|SICRO\s*\d?|COMPOSI[ÇC][ÕO]ES PR[ÓO]PRIAS|PR[ÓO]PRIA)?\s+(M2|M3|M²|M³|M|ML|UN|UND|KG|CJ|VB|H|L|T|PT|PAR|m2|m3|m²|m³|m|ml|un|und|kg)\s+([\d.]+,\d{2,3})\s*$/;
const RE_TITULO = /^\s*\d+(?:\.\d+)*\.?\s+[A-ZÀ-Ú][A-ZÀ-Ú0-9 ,/()\-–]+$/;
const RUIDO = /CNPJ|CEP|P[áa]gina|Tecnicamente atestamos|atendem as|especifica[çc][õo]es e exig|Prefeitura Municipal de .+ –|ITEM\s+C[ÓO]DIGO/i;

/** Planilhas em layout de colunas: a descrição costuma quebrar acima e abaixo da linha do item. */
export function lerPlanilha(linhas: string[]): Servico[] {
  type L = { tipo: "item" | "titulo" | "livre"; texto: string; m?: RegExpExecArray };
  const ls: L[] = linhas.map(l => l.replace(/\s+/g, " ").trim()).filter(l => l && !RUIDO.test(l)).map(l => {
    const m = RE_ITEM.exec(l);
    if (m) return { tipo: "item", texto: l, m };
    if (RE_TITULO.test(l)) return { tipo: "titulo", texto: l };
    return { tipo: "livre", texto: l };
  });
  const itens: { m: RegExpExecArray; acima: string[]; meio: string; abaixo: string[] }[] = [];
  let livres: string[] = [], ultimoItem: (typeof itens)[number] | null = null, aposTitulo = true;
  for (const l of ls) {
    if (l.tipo === "livre") { livres.push(l.texto); continue; }
    if (l.tipo === "titulo") { if (ultimoItem && !aposTitulo) ultimoItem.abaixo.push(...livres); livres = []; aposTitulo = true; ultimoItem = null; continue; }
    // item
    let acima = livres;
    if (ultimoItem && !aposTitulo) { const metade = Math.ceil(livres.length / 2); ultimoItem.abaixo.push(...livres.slice(0, metade)); acima = livres.slice(metade); }
    const novo = { m: l.m!, acima, meio: l.m![3], abaixo: [] as string[] };
    itens.push(novo); ultimoItem = novo; livres = []; aposTitulo = false;
  }
  if (ultimoItem && livres.length) ultimoItem.abaixo.push(...livres.slice(0, 3));
  return itens.map(i => ({
    codigo: i.m[2],
    descricao: limpa([...i.acima, i.meio, ...i.abaixo].join(" ")).replace(/\s+(SEINFRA|SINAPI|ORSE)\b.*$/i, "").slice(0, 220) || i.m[2],
    unidade: unidade(i.m[5]),
    quantidade: num(i.m[6]),
    origem: "Planilha" as const,
  })).filter(s => s.quantidade > 0);
}

// ---------- comparação com o edital ----------
const STOP = new Set("execucao executar servico servicos obra obras para com tipo inclusive inclusao incluso conforme deste desta sendo cada item area total minimo minima quantidade quantidades metros metro quadrados quadrado cubicos cubico unidade unidades parcela parcelas relevancia maior sobre entre outros outras forma mediante acima abaixo dentro onde pelo pela pelos pelas aquela aquele qualquer nas nos das dos sob ate edificacao edificacoes construcao civil fins".split(" "));
const normT = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
// palavras que querem dizer a mesma coisa em editais e planilhas
const SINONIMOS: Record<string, string[]> = {
  cobert: ["cobert", "telha", "telham", "telhad"], telha: ["telha", "telham", "cobert", "telhad"], telhad: ["telhad", "telha", "telham", "cobert"],
  alambr: ["alambr", "gradil", "grades", "cercam"], gradil: ["gradil", "alambr", "grades"], cercam: ["cercam", "alambr", "gradil", "muro"],
  meiofi: ["meiofi", "meio", "banque"], pavime: ["pavime", "piso", "calcam"], calcad: ["calcad", "passei", "piso"],
  alvena: ["alvena", "tijolo"], quadra: ["quadra", "polies"], polies: ["polies", "quadra"], areninh: ["areninh", "campo", "grama"],
};
const NEGATIVOS = ["desmon", "demoli", "remoca", "retira", "andaim"];
const variantes = (r: string) => SINONIMOS[r] || [r];
export const raizes = (s: string) => [...new Set(normT(s).replace(/meio[\s-]+fio/g, "meiofio").split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !STOP.has(w) && !/^\d+$/.test(w)).map(w => w.slice(0, 6)))];

export type Exigencia = { descricao: string; quantidade: number; unidade: string; trecho: string };

export function extrairParcelas(texto: string): Exigencia[] {
  const t = normT(texto).replace(/\s+/g, " ");
  const saida: Exigencia[] = [];
  let pos = 0;
  while (true) {
    const i = t.indexOf("maior relevancia", pos);
    if (i < 0) break;
    const janela = t.slice(i, i + 2800);
    const re = /([a-z][a-z0-9 ,/()ºo.°\-]{8,170}?)[\s:;–\-]*(?:com |de |no minimo |minimo de |igual ou superior a |quantidade minima de )*(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)\s*(m2|m3|m²|m³|metros? quadrados?|metros? cubicos?|metros? lineares|metros?|ml|m|kg|un|und|unidades?|kva)(?![a-z0-9²³])/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(janela))) {
      const desc = m[1].split(/(?:\b[a-z]\)|\d+\.\d+(?:\.\d+)?|;|:)\s*/).pop()!.replace(/^(e|de|da|do|em|a|o)\s+/, "").trim();
      const q = num(m[2]);
      if (!q || raizes(desc).length === 0) continue;
      const ex = { descricao: desc.slice(0, 160), quantidade: q, unidade: unidade(m[3]), trecho: janela.slice(Math.max(0, m.index - 20), m.index + m[0].length + 10) };
      if (!saida.some(s => s.descricao === ex.descricao && s.quantidade === ex.quantidade)) saida.push(ex);
    }
    pos = i + 2800;
    if (saida.length > 25) break;
  }
  return saida.slice(0, 20);
}

export type Comparacao = {
  exigencia: Exigencia;
  situacao: "atende" | "atende_somando" | "insuficiente" | "nao_encontrado";
  melhor?: { acervo: string; obra?: string; servico: string; quantidade: number };
  soma: number;
  achados: { acervo: string; obra?: string; servico: string; quantidade: number; nota: number }[];
};

export function compararAcervo(exigencias: Exigencia[], acervos: Acervo[]): Comparacao[] {
  const servs = acervos.flatMap(a => a.obras.flatMap(o => o.servicos.map(s => ({ acervo: a.titulo, obra: [o.contratante, o.local].filter(Boolean).join(" – "), s, r: raizes(s.descricao) }))));
  return exigencias.map(ex => {
    const re = raizes(ex.descricao);
    const neg = NEGATIVOS.filter(n => re.includes(n));
    const temRaiz = (lista: string[], r: string) => variantes(r).some(v => lista.includes(v));
    const achados = servs.filter(x => x.s.unidade === ex.unidade).map(x => {
      const comuns = re.filter(r => temRaiz(x.r, r)).length;
      const principal = re.length ? temRaiz(x.r, re[0]) : false; // a palavra principal (ex.: "alambrado", "cobertura") precisa aparecer
      const contra = NEGATIVOS.some(n => x.r.includes(n) && !neg.includes(n)); // desmontagem/demolição não comprova execução
      return { acervo: x.acervo, obra: x.obra, servico: x.s.descricao, quantidade: x.s.quantidade, nota: re.length ? comuns / Math.min(re.length, 4) : 0, comuns, ok: principal && !contra };
    }).filter(x => x.ok).sort((a, b) => b.nota - a.nota || b.quantidade - a.quantidade).slice(0, 8);
    const melhor = [...achados].sort((a, b) => b.quantidade - a.quantidade)[0];
    const soma = achados.reduce((s, x) => s + x.quantidade, 0);
    const situacao: Comparacao["situacao"] = !achados.length ? "nao_encontrado" : melhor.quantidade >= ex.quantidade ? "atende" : soma >= ex.quantidade ? "atende_somando" : "insuficiente";
    return { exigencia: ex, situacao, melhor: melhor && { acervo: melhor.acervo, obra: melhor.obra, servico: melhor.servico, quantidade: melhor.quantidade }, soma, achados: achados.map(({ comuns: _c, ok: _o, ...r }) => { void _c; void _o; return r; }) };
  });
}

export const fmtQ = (q: number, u: string) => `${q.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${u}`;
