// Catálogo dos documentos de habilitação usados em licitações de obras (Lei 14.133/2021, arts. 62 a 70).
// "validadeDias" é só uma sugestão para preencher a validade; o que vale é a data impressa no documento.

export type Grupo = "Jurídica" | "Fiscal e trabalhista" | "Econômico-financeira" | "Técnica" | "Cadastros" | "Outros";

export type TipoDoc = {
  id: string;
  nome: string;
  grupo: Grupo;
  ondeTirar: string;
  link?: string;
  validadeDias?: number;
  temValidade: boolean;
  multiplo?: boolean; // pode haver vários (ex.: atestados, CATs)
  basico: boolean; // costuma ser pedido em quase todo edital de obra
};

export const GRUPOS: Grupo[] = ["Jurídica", "Fiscal e trabalhista", "Econômico-financeira", "Técnica", "Cadastros", "Outros"];

export const TIPOS: TipoDoc[] = [
  { id: "contrato_social", nome: "Contrato social e alterações (ou consolidado)", grupo: "Jurídica", ondeTirar: "Junta Comercial do estado (JUCEC no Ceará) ou com o contador.", temValidade: false, basico: true },
  { id: "cnpj", nome: "Cartão CNPJ (comprovante de inscrição)", grupo: "Jurídica", ondeTirar: "Site da Receita Federal → Emissão de comprovante de inscrição CNPJ.", temValidade: false, basico: true },
  { id: "doc_socios", nome: "Documento de identidade dos sócios / representante", grupo: "Jurídica", ondeTirar: "RG ou CNH do representante legal.", temValidade: false, basico: true },
  { id: "procuracao", nome: "Procuração do representante (se outra pessoa assinar)", grupo: "Jurídica", ondeTirar: "Cartório ou procuração particular, conforme o edital.", temValidade: true, basico: false },

  { id: "cnd_federal", nome: "Certidão de débitos federais e Dívida Ativa da União (Receita/PGFN)", grupo: "Fiscal e trabalhista", ondeTirar: "Site da Receita Federal → Certidão de Débitos (pessoa jurídica). É gratuita e sai na hora.", validadeDias: 180, temValidade: true, basico: true },
  { id: "crf_fgts", nome: "Certificado de Regularidade do FGTS (CRF)", grupo: "Fiscal e trabalhista", ondeTirar: "Site da Caixa → Consulta Regularidade do Empregador.", link: "https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf", validadeDias: 30, temValidade: true, basico: true },
  { id: "cndt", nome: "Certidão Negativa de Débitos Trabalhistas (CNDT)", grupo: "Fiscal e trabalhista", ondeTirar: "Site do Tribunal Superior do Trabalho (TST) → Emitir certidão.", link: "https://cndt-certidao.tst.jus.br/inicio.faces", validadeDias: 180, temValidade: true, basico: true },
  { id: "cnd_estadual", nome: "Certidão de débitos estaduais (SEFAZ)", grupo: "Fiscal e trabalhista", ondeTirar: "Site da Secretaria da Fazenda do estado da sede (SEFAZ-CE).", validadeDias: 60, temValidade: true, basico: true },
  { id: "cnd_municipal", nome: "Certidão de débitos municipais", grupo: "Fiscal e trabalhista", ondeTirar: "Site ou setor de tributos da prefeitura da sede da empresa.", validadeDias: 90, temValidade: true, basico: true },
  { id: "inscricao_estadual", nome: "Comprovante de inscrição estadual", grupo: "Fiscal e trabalhista", ondeTirar: "SEFAZ do estado (consulta de contribuinte).", temValidade: false, basico: false },
  { id: "inscricao_municipal", nome: "Comprovante de inscrição municipal (alvará / FIC)", grupo: "Fiscal e trabalhista", ondeTirar: "Prefeitura da sede da empresa.", temValidade: false, basico: false },

  { id: "balanco", nome: "Balanço patrimonial e DRE do último exercício", grupo: "Econômico-financeira", ondeTirar: "Contador da empresa (registrado na Junta ou via SPED/ECD).", temValidade: true, basico: true },
  { id: "falencia", nome: "Certidão negativa de falência e recuperação judicial", grupo: "Econômico-financeira", ondeTirar: "Tribunal de Justiça do estado da sede (TJCE).", validadeDias: 90, temValidade: true, basico: true },

  { id: "crea_pj", nome: "Certidão de registro da empresa no CREA/CAU", grupo: "Técnica", ondeTirar: "Site do CREA do estado (CREA-CE) → certidão de registro de pessoa jurídica.", temValidade: true, basico: true },
  { id: "crea_rt", nome: "Certidão de registro do responsável técnico no CREA/CAU", grupo: "Técnica", ondeTirar: "Site do CREA-CE → certidão de pessoa física.", temValidade: true, basico: true },
  { id: "cat", nome: "CAT / Certidão de Acervo Técnico do responsável", grupo: "Técnica", ondeTirar: "CREA-CE (acervo das obras já executadas pelo engenheiro).", temValidade: false, multiplo: true, basico: true },
  { id: "atestado_capacidade", nome: "Atestados de capacidade técnica da empresa", grupo: "Técnica", ondeTirar: "Emitidos pelos contratantes de obras anteriores.", temValidade: false, multiplo: true, basico: true },
  { id: "vinculo_rt", nome: "Comprovante de vínculo do responsável técnico", grupo: "Técnica", ondeTirar: "Contrato social (se sócio), carteira de trabalho ou contrato de prestação de serviço.", temValidade: false, basico: false },

  { id: "sicaf", nome: "SICAF (cadastro federal de fornecedores)", grupo: "Cadastros", ondeTirar: "Portal Compras.gov.br → SICAF.", temValidade: true, basico: false },
  { id: "crc_estadual", nome: "Certificado de Registro Cadastral estadual (CRC)", grupo: "Cadastros", ondeTirar: "Portal de compras do estado (no Ceará, o cadastro de fornecedores do Governo do Estado).", temValidade: true, basico: false },

  { id: "garantia", nome: "Garantia da proposta (seguro-garantia, caução ou fiança)", grupo: "Outros", ondeTirar: "Seguradora ou banco, no valor e prazo pedidos pelo edital.", temValidade: true, basico: false },
  { id: "outros", nome: "Outro documento", grupo: "Outros", ondeTirar: "—", temValidade: true, multiplo: true, basico: false },
];

export const tipoPorId = (id: string) => TIPOS.find(t => t.id === id);

export type StatusDoc = "ok" | "vence_logo" | "vencido" | "sem_validade" | "falta";

export function diasAte(data: string | null | undefined, ref = new Date()) {
  if (!data) return null;
  const d = new Date(data + "T23:59:59");
  return Math.floor((d.getTime() - ref.getTime()) / 86400000);
}

export function statusDocumento(validade: string | null, temValidade: boolean): StatusDoc {
  if (!temValidade) return "sem_validade";
  const dias = diasAte(validade);
  if (dias === null) return "sem_validade";
  if (dias < 0) return "vencido";
  if (dias <= 15) return "vence_logo";
  return "ok";
}
