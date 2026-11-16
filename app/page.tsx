"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, Calculator, CalendarClock, ChevronRight, FileWarning, FolderLock, LoaderCircle, Search, Sparkles } from "lucide-react";
import { Shell } from "@/components/Sidebar";
import { useAuth } from "@/components/Auth";
import { TIPOS, statusDocumento, tipoPorId, diasAte } from "@/lib/catalogo-docs";
import { carregarConfig, carregarDocumentos, carregarEmpresa, carregarLicitacoes, dataCurta, quantoFalta } from "@/lib/dados";
import { sb, type ConfigBusca, type Documento, type Empresa, type Licitacao } from "@/lib/supabase";

type Todo = { href: string; cor: "bad" | "warn" | "info" | "ok"; titulo: string; texto: string };

export default function Inicio() {
  const { email } = useAuth();
  const [docs, setDocs] = useState<Documento[] | null>(null);
  const [lics, setLics] = useState<Licitacao[]>([]);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [config, setConfig] = useState<ConfigBusca | null>(null);
  const [novas, setNovas] = useState<number | null>(null);
  const [orcs, setOrcs] = useState(0);

  useEffect(() => {
    (async () => {
      const [d, l, e, c, o] = await Promise.all([carregarDocumentos(), carregarLicitacoes(), carregarEmpresa(), carregarConfig(), sb().from("orcamentos").select("id", { count: "exact", head: true }).eq("arquivado", false)]);
      setDocs(d); setLics(l); setEmpresa(e); setConfig(c); setOrcs(o.count || 0);
      if (c.palavras.length) {
        try {
          const r = await fetch(`/api/pncp/buscar?palavras=${encodeURIComponent(c.palavras.join("|"))}&ufs=${c.ufs.join(",")}`);
          const j = await r.json() as { itens: { pncp_id: string; publicado_em: string; valor_estimado: number | null }[] };
          const salvas = new Set(l.map(x => x.pncp_id));
          const desde = c.ultima_visita ? new Date(c.ultima_visita).getTime() : 0;
          setNovas((j.itens || []).filter(x => !salvas.has(x.pncp_id) && new Date(x.publicado_em).getTime() > desde && (c.valor_min == null || (x.valor_estimado ?? Infinity) >= c.valor_min) && (c.valor_max == null || (x.valor_estimado ?? 0) <= c.valor_max)).length);
        } catch { setNovas(null); }
      } else setNovas(0);
    })();
  }, []);

  if (!docs) return <Shell><div className="loading"><LoaderCircle className="spin" /></div></Shell>;

  const comStatus = docs.map(d => ({ d, s: statusDocumento(d.validade, tipoPorId(d.tipo)?.temValidade ?? true) }));
  const vencidos = comStatus.filter(x => x.s === "vencido");
  const vencendo = comStatus.filter(x => x.s === "vence_logo");
  const temTipo = new Set(docs.filter(d => statusDocumento(d.validade, tipoPorId(d.tipo)?.temValidade ?? true) !== "vencido").map(d => d.tipo));
  const faltando = TIPOS.filter(t => t.basico && !temTipo.has(t.id));
  const ativas = lics.filter(l => l.situacao !== "descartada" && l.situacao !== "encerrada");
  const proximas = ativas.filter(l => { const q = quantoFalta(l.abertura); return q && q.dias >= 0 && q.dias <= 10; });

  const todos: Todo[] = [];
  vencidos.forEach(({ d }) => todos.push({ href: "/documentos", cor: "bad", titulo: `Renovar: ${tipoPorId(d.tipo)?.nome || d.titulo}`, texto: `Venceu em ${dataCurta(d.validade)}.` }));
  vencendo.forEach(({ d }) => todos.push({ href: "/documentos", cor: "warn", titulo: `Vence logo: ${tipoPorId(d.tipo)?.nome || d.titulo}`, texto: `Vale até ${dataCurta(d.validade)} (${diasAte(d.validade)} dias).` }));
  proximas.forEach(l => todos.push({ href: `/licitacoes/${l.id}`, cor: l.relatorio_em ? "info" : "warn", titulo: `Licitação ${quantoFalta(l.abertura)!.texto}: ${l.municipio || l.orgao_nome}`, texto: l.relatorio_em ? "Relatório de documentos já gerado. Confira as pendências." : "Ainda não foi gerado o relatório do que falta." }));
  if (faltando.length) todos.push({ href: "/documentos", cor: "info", titulo: `Cadastrar ${faltando.length} documento${faltando.length > 1 ? "s" : ""} básico${faltando.length > 1 ? "s" : ""}`, texto: "Com tudo no cofre, o sistema consegue dizer na hora se a empresa está apta para cada edital." });
  if (empresa && (empresa.capital_social == null || empresa.liquidez_geral == null)) todos.push({ href: "/empresa", cor: "info", titulo: "Completar dados financeiros da empresa", texto: "Capital social e índices contábeis servem para conferir as exigências do edital." });

  const nome = email.split("@")[0];
  const hora = new Date().getHours();
  const saud = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  return <Shell>
    <div className="page-head"><div><small>Falcão SH Construções</small><h1>{saud}!</h1><p>Aqui está o resumo de hoje: licitações, documentos e orçamentos.</p></div></div>

    <div className="hello">
      <div><h2>{novas == null ? "Procurando licitações…" : novas > 0 ? `${novas} licitaç${novas > 1 ? "ões novas" : "ão nova"} para olhar` : "Nenhuma licitação nova desde a última olhada"}</h2>
        <p>Busca automática no Portal Nacional de Contratações Públicas{config?.ufs.length ? ` (${config.ufs.join(", ")})` : ""} com as palavras: {config?.palavras.slice(0, 6).join(", ") || "nenhuma configurada"}{(config?.palavras.length || 0) > 6 ? "…" : ""}.</p></div>
      <Link href="/licitacoes" className="btn big"><Search /> Ver licitações</Link>
    </div>

    <div className="big-cards">
      <Link href="/licitacoes?aba=minhas" className="big-card info"><div className="ic"><CalendarClock /></div><strong>{ativas.length}</strong><span>Licitações acompanhadas</span><small>{proximas.length ? `${proximas.length} abrem nos próximos 10 dias` : "Nenhuma abre nos próximos 10 dias"}</small></Link>
      <Link href="/documentos" className={`big-card ${vencidos.length ? "bad" : "ok"}`}><div className="ic"><FileWarning /></div><strong>{vencidos.length}</strong><span>Documentos vencidos</span><small>{vencendo.length ? `${vencendo.length} vencem em até 15 dias` : "Nenhum vencendo nos próximos 15 dias"}</small></Link>
      <Link href="/documentos" className={`big-card ${faltando.length ? "warn" : "ok"}`}><div className="ic"><FolderLock /></div><strong>{docs.length}</strong><span>Documentos no cofre</span><small>{faltando.length ? `Faltam ${faltando.length} dos básicos` : "Todos os básicos cadastrados"}</small></Link>
      <Link href="/orcamentos" className="big-card"><div className="ic"><Calculator /></div><strong>{orcs}</strong><span>Orçamentos</span><small>Abrir o orçamentador</small></Link>
    </div>

    <div className="grid2">
      <div className="card">
        <h2>O que fazer agora</h2>
        <p className="muted" style={{ marginTop: 0 }}>Lista montada automaticamente, do mais urgente para o menos urgente.</p>
        {todos.length ? <div className="todo">{todos.slice(0, 8).map((t, i) => <Link key={i} href={t.href}><span className={`dot ${t.cor}`} /><div><b>{t.titulo}</b><small>{t.texto}</small></div><ChevronRight /></Link>)}</div>
          : <div className="notice ok"><Sparkles /><div><b>Tudo em dia!</b>Nenhuma pendência no momento.</div></div>}
      </div>
      <div className="card">
        <h2>Como o sistema funciona</h2>
        <div className="todo">
          <div className="todo-item"><span className="dot ok" /><div><b>1. Guarde os documentos no cofre</b><small>Certidões, balanço, CATs, atestados… com a data de validade.</small></div></div>
          <div className="todo-item"><span className="dot ok" /><div><b>2. O sistema procura as licitações</b><small>Todo dia, no Brasil todo ou só nos estados escolhidos.</small></div></div>
          <div className="todo-item"><span className="dot ok" /><div><b>3. Gere o relatório do que falta</b><small>Ele lê o edital e compara com o que está no cofre.</small></div></div>
          <div className="todo-item"><span className="dot ok" /><div><b>4. Monte o orçamento</b><small>Com a tabela SEINFRA, BDI, cronograma e carta proposta.</small></div></div>
        </div>
        {!docs.length && <Link href="/documentos" className="btn primary" style={{ marginTop: 14 }}><FolderLock /> Começar pelos documentos</Link>}
      </div>
    </div>
    {vencidos.length > 0 && <div className="notice bad" style={{ marginTop: 16 }}><AlertTriangle /><div><b>Atenção: há documento vencido.</b>Com documento vencido a empresa pode ser inabilitada. Renove antes da próxima licitação.</div></div>}
  </Shell>;
}
