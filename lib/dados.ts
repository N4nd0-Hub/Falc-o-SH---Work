"use client";
import { sb, type ConfigBusca, type Documento, type Empresa, type Licitacao } from "./supabase";

export async function carregarEmpresa(): Promise<Empresa | null> {
  const { data } = await sb().from("empresa").select("*").eq("id", 1).maybeSingle();
  return data as Empresa | null;
}
export async function carregarDocumentos(): Promise<Documento[]> {
  const { data } = await sb().from("documentos").select("*").order("tipo").order("validade", { ascending: false });
  return (data || []) as Documento[];
}
export async function carregarLicitacoes(): Promise<Licitacao[]> {
  const { data } = await sb().from("licitacoes").select("id,pncp_id,orgao_cnpj,ano,sequencial,titulo,objeto,orgao_nome,unidade_nome,municipio,uf,modalidade,valor_estimado,abertura,encerramento,link_origem,situacao,notas,relatorio_em,criado_em,atualizado_em").order("abertura", { ascending: true, nullsFirst: false });
  return (data || []) as Licitacao[];
}
export async function carregarConfig(): Promise<ConfigBusca> {
  const { data } = await sb().from("config_busca").select("*").eq("id", 1).maybeSingle();
  return (data || { id: 1, palavras: [], ufs: ["CE"], valor_min: null, valor_max: null, ultima_visita: null }) as ConfigBusca;
}

export const brl = (v: number | null | undefined) => v == null ? "Valor não informado" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const dataHora = (d: string | null | undefined) => d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
export const dataCurta = (d: string | null | undefined) => d ? new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("pt-BR") : "—";
export function quantoFalta(d: string | null | undefined) {
  if (!d) return null;
  const dias = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  if (dias < 0) return { dias, texto: "já passou", cor: "gray" as const };
  if (dias === 0) return { dias, texto: "é hoje", cor: "bad" as const };
  if (dias === 1) return { dias, texto: "é amanhã", cor: "bad" as const };
  return { dias, texto: `em ${dias} dias`, cor: dias <= 5 ? "bad" as const : dias <= 12 ? "warn" as const : "ok" as const };
}
export const SITUACOES: Record<Licitacao["situacao"], { nome: string; cor: "info" | "warn" | "ok" | "gray" | "bad" }> = {
  interesse: { nome: "Interessante", cor: "info" },
  analisando: { nome: "Analisando documentos", cor: "warn" },
  participando: { nome: "Vamos participar", cor: "ok" },
  descartada: { nome: "Descartada", cor: "gray" },
  encerrada: { nome: "Encerrada", cor: "gray" },
};
