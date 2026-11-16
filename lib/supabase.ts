"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Chave pública (publishable): pode ficar no navegador. O acesso aos dados é
// protegido pelas regras do banco (só e-mails cadastrados em "membros").
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yejmguxfbfdtuatpwufp.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY || "sb_publishable_YBmkNocT3Ibd4TCmfg-61g_LUFBmO3v";

let client: SupabaseClient | null = null;
export function sb() {
  if (!client) client = createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}

export type Empresa = {
  id: number;
  razao_social: string | null; nome_fantasia: string | null; cnpj: string | null;
  inscricao_estadual: string | null; inscricao_municipal: string | null;
  endereco: string | null; municipio: string | null; uf: string | null; telefone: string | null; email: string | null;
  representante_legal: string | null; cpf_representante: string | null; cargo_representante: string | null;
  responsavel_tecnico: string | null; crea_responsavel: string | null; profissao_responsavel: string | null;
  dados_bancarios: string | null;
  capital_social: number | null; patrimonio_liquido: number | null;
  liquidez_geral: number | null; liquidez_corrente: number | null; solvencia_geral: number | null;
  data_balanco: string | null;
};

export type Documento = {
  id: string; tipo: string; titulo: string; numero: string | null;
  emissao: string | null; validade: string | null;
  arquivo_path: string | null; arquivo_nome: string | null; observacao: string | null;
  criado_em: string; atualizado_em: string;
};

export type Licitacao = {
  id: string; pncp_id: string; orgao_cnpj: string | null; ano: number | null; sequencial: number | null;
  titulo: string | null; objeto: string | null; orgao_nome: string | null; unidade_nome: string | null;
  municipio: string | null; uf: string | null; modalidade: string | null; valor_estimado: number | null;
  abertura: string | null; encerramento: string | null; link_origem: string | null;
  situacao: "interesse" | "analisando" | "participando" | "descartada" | "encerrada";
  notas: string | null; relatorio: unknown; relatorio_em: string | null; dados: unknown;
  criado_em: string; atualizado_em: string;
};

export type ConfigBusca = { id: number; palavras: string[]; ufs: string[]; valor_min: number | null; valor_max: number | null; ultima_visita: string | null };
