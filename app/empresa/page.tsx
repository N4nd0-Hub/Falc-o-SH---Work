"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, Save, Trash2, UserPlus, Users } from "lucide-react";
import { Shell } from "@/components/Sidebar";
import { useAuth } from "@/components/Auth";
import { carregarEmpresa } from "@/lib/dados";
import { sb, type Empresa } from "@/lib/supabase";

type Campo = { k: keyof Empresa; label: string; dica?: string; tipo?: "text" | "number" | "date"; full?: boolean };
const DADOS: Campo[] = [
  { k: "razao_social", label: "Razão social" }, { k: "nome_fantasia", label: "Nome fantasia" },
  { k: "cnpj", label: "CNPJ" }, { k: "inscricao_estadual", label: "Inscrição estadual" },
  { k: "inscricao_municipal", label: "Inscrição municipal" }, { k: "telefone", label: "Telefone" },
  { k: "email", label: "E-mail da empresa" }, { k: "endereco", label: "Endereço completo", full: true },
  { k: "municipio", label: "Município da sede" }, { k: "uf", label: "UF" },
  { k: "representante_legal", label: "Representante legal (quem assina)" }, { k: "cpf_representante", label: "CPF do representante" },
  { k: "cargo_representante", label: "Cargo do representante", dica: "Ex.: Sócio-administrador" },
  { k: "responsavel_tecnico", label: "Responsável técnico" }, { k: "crea_responsavel", label: "CREA/CAU do responsável" },
  { k: "profissao_responsavel", label: "Profissão do responsável", dica: "Ex.: Engenheiro civil" },
  { k: "dados_bancarios", label: "Dados bancários (para a carta proposta)", full: true, dica: "Banco, agência e conta" },
];
const FIN: Campo[] = [
  { k: "capital_social", label: "Capital social (R$)", tipo: "number", dica: "Está no contrato social." },
  { k: "patrimonio_liquido", label: "Patrimônio líquido (R$)", tipo: "number", dica: "Está no balanço." },
  { k: "liquidez_geral", label: "Liquidez Geral (LG)", tipo: "number", dica: "O contador informa. Editais costumam pedir ≥ 1,00." },
  { k: "liquidez_corrente", label: "Liquidez Corrente (LC)", tipo: "number" },
  { k: "solvencia_geral", label: "Solvência Geral (SG)", tipo: "number" },
  { k: "data_balanco", label: "Data do balanço", tipo: "date", dica: "Fim do exercício (ex.: 31/12/2025)" },
];

export default function EmpresaPage() {
  const { email } = useAuth();
  const [e, setE] = useState<Empresa | null>(null), [busy, setBusy] = useState(false), [ok, setOk] = useState(false);
  const [membros, setMembros] = useState<{ email: string; nome: string | null }[]>([]), [novo, setNovo] = useState(""), [nomeNovo, setNomeNovo] = useState(""), [msg, setMsg] = useState("");
  const carregarMembros = () => sb().from("membros").select("email,nome").order("criado_em").then(({ data }) => setMembros(data || []));
  useEffect(() => { carregarEmpresa().then(setE); carregarMembros(); }, []);

  async function salvar() {
    if (!e) return; setBusy(true);
    const { id: _id, ...resto } = e; void _id;
    await sb().from("empresa").update({ ...resto, atualizado_em: new Date().toISOString() }).eq("id", 1);
    setBusy(false); setOk(true); setTimeout(() => setOk(false), 2500);
  }
  async function adicionar(ev: React.FormEvent) {
    ev.preventDefault(); setMsg("");
    const em = novo.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(em)) { setMsg("Digite um e-mail válido."); return; }
    const { error } = await sb().from("membros").insert({ email: em, nome: nomeNovo.trim() || null });
    if (error) { setMsg(/duplicate/.test(error.message) ? "Este e-mail já tem acesso." : error.message); return; }
    setNovo(""); setNomeNovo(""); setMsg(`Pronto! Peça para a pessoa abrir o site, clicar em “Primeiro acesso” e criar a senha com ${em}.`); carregarMembros();
  }
  async function remover(em: string) {
    if (em.toLowerCase() === email.toLowerCase()) return;
    if (!confirm(`Tirar o acesso de ${em}?`)) return;
    await sb().from("membros").delete().eq("email", em); carregarMembros();
  }

  const input = (c: Campo) => <label key={c.k} className={`field ${c.full ? "full" : ""}`}>{c.label}
    <input type={c.tipo || "text"} step={c.tipo === "number" ? "any" : undefined} value={(e?.[c.k] as string | number | null) ?? ""} onChange={ev => setE(x => x && ({ ...x, [c.k]: c.tipo === "number" ? (ev.target.value === "" ? null : Number(ev.target.value)) : (ev.target.value || null) }))} />
    {c.dica && <small>{c.dica}</small>}</label>;

  return <Shell>
    <div className="page-head">
      <div><small>Cadastro</small><h1>Empresa</h1><p>Esses dados entram automaticamente na carta proposta e no orçamento, e servem para conferir exigências do edital (capital social, índices).</p></div>
      <button className="btn primary big" disabled={busy || !e} onClick={salvar}>{busy ? <LoaderCircle className="spin" /> : ok ? <CheckCircle2 /> : <Save />} {ok ? "Salvo!" : "Salvar"}</button>
    </div>
    {!e ? <div className="loading"><LoaderCircle className="spin" /></div> : <div className="stack">
      <div className="card"><h2>Dados da empresa</h2><div className="form-grid" style={{ marginTop: 12 }}>{DADOS.map(input)}</div></div>
      <div className="card"><h2>Dados financeiros</h2><p className="muted">Usados para conferir se a empresa atende ao capital mínimo e aos índices pedidos no edital. Atualize a cada novo balanço.</p><div className="form-grid">{FIN.map(input)}</div></div>
      <div className="card" id="acesso"><h2><Users style={{ verticalAlign: "-3px" }} /> Pessoas com acesso</h2><p className="muted">Só esses e-mails conseguem entrar no sistema.</p>
        <div className="todo" style={{ margin: "12px 0" }}>{membros.map(m => <div className="todo-item" key={m.email}><span className="dot ok" /><div><b>{m.nome || m.email}</b><small>{m.email}{m.email.toLowerCase() === email.toLowerCase() ? " (você)" : ""}</small></div>{m.email.toLowerCase() !== email.toLowerCase() && <button className="btn small danger" style={{ marginLeft: "auto" }} onClick={() => remover(m.email)}><Trash2 /></button>}</div>)}</div>
        <form className="form-grid" onSubmit={adicionar}><label className="field">E-mail da pessoa<input type="email" value={novo} onChange={ev => setNovo(ev.target.value)} placeholder="nome@exemplo.com" /></label><label className="field">Nome (opcional)<input value={nomeNovo} onChange={ev => setNomeNovo(ev.target.value)} placeholder="Ex.: Fernando" /></label><div className="full"><button className="btn"><UserPlus /> Dar acesso</button></div></form>
        {msg && <div className="notice info" style={{ marginTop: 10 }}>{msg}</div>}
      </div>
    </div>}
  </Shell>;
}
