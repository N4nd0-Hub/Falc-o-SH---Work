"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import BudgetApp, { type BudgetRow } from "@/components/orca/budget-app";
import { carregarEmpresa } from "@/lib/dados";
import { sb, type Empresa } from "@/lib/supabase";

export default function Page() { return <Suspense><Orcamentos /></Suspense>; }

function Orcamentos() {
  const id = useSearchParams().get("id");
  const [rows, setRows] = useState<BudgetRow[] | null>(null), [empresa, setEmpresa] = useState<Empresa | null>(null), [erro, setErro] = useState("");
  useEffect(() => { (async () => {
    const [{ data, error }, e] = await Promise.all([sb().from("orcamentos").select("id,dados,arquivado,licitacao_id").order("atualizado_em", { ascending: false }), carregarEmpresa()]);
    if (error) { setErro(error.message); return; }
    setEmpresa(e); setRows((data || []) as BudgetRow[]);
  })(); }, []);
  if (erro) return <div className="loading">Erro ao carregar orçamentos: {erro}</div>;
  if (!rows) return <div className="loading"><LoaderCircle className="spin" /></div>;
  return <BudgetApp key={id || "lista"} rows={rows} openId={id} empresa={empresa} />;
}
