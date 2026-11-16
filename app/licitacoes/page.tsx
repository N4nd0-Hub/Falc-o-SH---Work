"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building, CalendarClock, ExternalLink, EyeOff, LoaderCircle, MapPin, RefreshCw, Search, Settings2, Star, X, Gavel, ChevronRight } from "lucide-react";
import { Shell } from "@/components/Sidebar";
import { brl, carregarConfig, carregarLicitacoes, dataCurta, dataHora, quantoFalta, SITUACOES } from "@/lib/dados";
import { sb, type ConfigBusca, type Licitacao } from "@/lib/supabase";
import type { ResultadoBusca } from "@/lib/pncp";

type Res = ResultadoBusca & { palavras: string[] };
const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

export default function Page() { return <Suspense><Licitacoes /></Suspense>; }

function Licitacoes() {
  const params = useSearchParams(), router = useRouter();
  const aba = params.get("aba") === "minhas" ? "minhas" : "novas";
  const [config, setConfig] = useState<ConfigBusca | null>(null);
  const [salvas, setSalvas] = useState<Licitacao[]>([]);
  const [res, setRes] = useState<Res[] | null>(null), [buscando, setBuscando] = useState(false), [falhas, setFalhas] = useState<string[]>([]);
  const [visitaAnterior, setVisitaAnterior] = useState<number>(0);
  const [extra, setExtra] = useState(""), [cfgAberta, setCfgAberta] = useState(false), [toast, setToast] = useState(""), [salvando, setSalvando] = useState<string | null>(null);
  const [filtroSit, setFiltroSit] = useState<string>("ativas");

  async function buscar(cfg: ConfigBusca, palavraExtra?: string) {
    const palavras = palavraExtra ? [palavraExtra] : cfg.palavras;
    if (!palavras.length) { setRes([]); return; }
    setBuscando(true);
    try {
      const r = await fetch(`/api/pncp/buscar?palavras=${encodeURIComponent(palavras.join("|"))}&ufs=${cfg.ufs.join(",")}`);
      const j = await r.json() as { itens: Res[]; falhas: string[] };
      setRes(j.itens || []); setFalhas(j.falhas || []);
      if (!palavraExtra) await sb().from("config_busca").update({ ultima_visita: new Date().toISOString() }).eq("id", 1);
    } catch { setRes([]); setFalhas(palavras); } finally { setBuscando(false); }
  }
  useEffect(() => { (async () => {
    const [c, l] = await Promise.all([carregarConfig(), carregarLicitacoes()]);
    setConfig(c); setSalvas(l); setVisitaAnterior(c.ultima_visita ? new Date(c.ultima_visita).getTime() : 0);
    buscar(c);
  })(); }, []); // eslint-disable-line
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(""), 2800); return () => clearTimeout(t); } }, [toast]);

  const salvasIds = useMemo(() => new Map(salvas.map(s => [s.pncp_id, s])), [salvas]);
  const visiveis = (res || []).filter(r => !salvasIds.has(r.pncp_id) && (config?.valor_min == null || (r.valor_estimado ?? Infinity) >= config.valor_min) && (config?.valor_max == null || (r.valor_estimado ?? 0) <= config.valor_max));

  async function guardar(r: Res, situacao: Licitacao["situacao"]) {
    setSalvando(r.pncp_id);
    let det: Record<string, unknown> = {};
    try { const d = await fetch(`/api/pncp/compra?cnpj=${r.orgao_cnpj}&ano=${r.ano}&seq=${r.sequencial}`); if (d.ok) det = await d.json(); } catch { /* segue com o que tem */ }
    const linha = {
      pncp_id: r.pncp_id, orgao_cnpj: r.orgao_cnpj, ano: r.ano, sequencial: r.sequencial, titulo: r.titulo,
      objeto: (det.objeto as string) || r.objeto, orgao_nome: (det.orgao_nome as string) || r.orgao_nome, unidade_nome: r.unidade_nome,
      municipio: r.municipio, uf: r.uf, modalidade: r.modalidade, valor_estimado: (det.valor_estimado as number) ?? r.valor_estimado,
      abertura: (det.encerramento as string) || null, encerramento: (det.encerramento as string) || null, link_origem: (det.link_origem as string) || null,
      situacao, dados: { busca: r, detalhes: det },
    };
    const { data, error } = await sb().from("licitacoes").upsert(linha, { onConflict: "pncp_id" }).select().single();
    setSalvando(null);
    if (error) { setToast("Não consegui salvar: " + error.message); return; }
    setSalvas(s => [...s.filter(x => x.pncp_id !== r.pncp_id), data as Licitacao]);
    if (situacao === "descartada") setToast("Escondida. Você pode ver de novo em Minhas licitações → Descartadas.");
    else router.push(`/licitacoes/${(data as Licitacao).id}`);
  }

  const contagem = (f: string) => salvas.filter(s => f === "ativas" ? !["descartada", "encerrada"].includes(s.situacao) : s.situacao === f).length;
  const minhas = salvas.filter(s => filtroSit === "ativas" ? !["descartada", "encerrada"].includes(s.situacao) : s.situacao === filtroSit)
    .sort((a, b) => (a.abertura || "9").localeCompare(b.abertura || "9"));

  return <Shell>
    <div className="page-head">
      <div><small>Portal Nacional de Contratações Públicas</small><h1>Licitações</h1><p>O sistema procura editais abertos com as palavras escolhidas. Marque as que interessam para analisar os documentos e montar o orçamento.</p></div>
      <div className="row"><Link href="/licitacoes" className={`btn ${aba === "novas" ? "primary" : ""}`}><Search /> Encontradas</Link><Link href="/licitacoes?aba=minhas" className={`btn ${aba === "minhas" ? "primary" : ""}`}><Star /> Minhas ({contagem("ativas")})</Link></div>
    </div>

    {aba === "novas" && <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div><h3>O que estou procurando</h3>
            <div className="row" style={{ gap: 6, marginTop: 6 }}>{config?.palavras.map(p => <span key={p} className="kw">{p}</span>)}</div>
            <p className="help" style={{ margin: "8px 0 0" }}>{config?.ufs.length ? `Estados: ${config.ufs.join(", ")}` : "Brasil inteiro"}{config?.valor_min != null ? ` • a partir de ${brl(config.valor_min)}` : ""}{config?.valor_max != null ? ` • até ${brl(config.valor_max)}` : ""} • só editais recebendo propostas</p></div>
          <div className="row"><button className="btn" onClick={() => setCfgAberta(true)}><Settings2 /> Mudar a busca</button><button className="btn" disabled={buscando || !config} onClick={() => config && buscar(config)}><RefreshCw className={buscando ? "spin" : ""} /> Atualizar</button></div>
        </div>
        <form className="row" style={{ marginTop: 14 }} onSubmit={e => { e.preventDefault(); if (config && extra.trim()) buscar(config, extra.trim()); }}>
          <div className="field" style={{ flex: 1, minWidth: 220 }}><input value={extra} onChange={e => setExtra(e.target.value)} placeholder="Procurar outra palavra só agora (ex.: praça, creche, pavimentação)" /></div>
          <button className="btn"><Search /> Procurar</button>
          {extra && <button type="button" className="btn" onClick={() => { setExtra(""); if (config) buscar(config); }}><X /> Limpar</button>}
        </form>
      </div>
      {falhas.length > 0 && <div className="notice warn" style={{ marginBottom: 12 }}>O PNCP não respondeu para: {falhas.join(", ")}. Tente atualizar em instantes.</div>}
      {buscando || res === null ? <div className="loading"><div style={{ textAlign: "center" }}><LoaderCircle className="spin" /><p>Procurando no PNCP…</p></div></div>
        : !visiveis.length ? <div className="empty"><Search /><h3>Nenhuma licitação nova encontrada</h3><p>Tente outras palavras ou mais estados em “Mudar a busca”.</p></div>
        : <>
          <p className="help">{visiveis.length} edita{visiveis.length > 1 ? "is" : "l"} recebendo propostas. Os marcados com <b>Nova</b> apareceram desde a sua última visita.</p>
          {visiveis.map(r => { const nova = new Date(r.publicado_em).getTime() > visitaAnterior; return <article key={r.pncp_id} className={`lic-card ${nova ? "new" : ""}`}>
            <div className="row" style={{ justifyContent: "space-between" }}><div className="row" style={{ gap: 6 }}>{nova && <span className="pill info">Nova</span>}<span className="pill gray">{r.modalidade}</span>{r.palavras.map(p => <span key={p} className="kw">{p}</span>)}</div><small className="muted">Publicado em {dataCurta(r.publicado_em)}</small></div>
            <h3>{r.titulo} — {r.orgao_nome}</h3>
            <div className="obj">{r.objeto}</div>
            <div className="meta"><span><MapPin /> {r.municipio}/{r.uf}</span><span><Building /> {r.unidade_nome}</span>{r.fim_vigencia && <span><CalendarClock /> Propostas até {dataHora(r.fim_vigencia)}</span>}</div>
            <div className="foot"><div className="valor">{brl(r.valor_estimado)}</div>
              <div className="row"><a className="btn small" href={r.url_pncp} target="_blank" rel="noreferrer"><ExternalLink /> Ver no PNCP</a><button className="btn small" disabled={!!salvando} onClick={() => guardar(r, "descartada")}><EyeOff /> Não interessa</button><button className="btn small primary" disabled={!!salvando} onClick={() => guardar(r, "interesse")}>{salvando === r.pncp_id ? <LoaderCircle className="spin" /> : <Star />} Tenho interesse</button></div></div>
          </article>; })}
        </>}
    </>}

    {aba === "minhas" && <>
      <div className="filters">{[["ativas", "Em andamento"], ["interesse", "Interessantes"], ["analisando", "Analisando"], ["participando", "Vamos participar"], ["descartada", "Descartadas"], ["encerrada", "Encerradas"]].map(([k, n]) => <button key={k} className={`chip ${filtroSit === k ? "active" : ""}`} onClick={() => setFiltroSit(k)}>{n} <span className="count">{contagem(k)}</span></button>)}</div>
      {!minhas.length ? <div className="empty"><Gavel /><h3>Nada por aqui ainda</h3><p>Na aba “Encontradas”, clique em <b>Tenho interesse</b> nas licitações que quiser acompanhar.</p></div>
        : minhas.map(l => { const q = quantoFalta(l.abertura); return <Link key={l.id} href={`/licitacoes/${l.id}`} className="lic-card" style={{ textDecoration: "none" }}>
          <div className="row" style={{ justifyContent: "space-between" }}><div className="row" style={{ gap: 6 }}><span className={`pill ${SITUACOES[l.situacao].cor}`}>{SITUACOES[l.situacao].nome}</span>{l.relatorio_em ? <span className="pill ok">Relatório gerado</span> : <span className="pill gray">Sem relatório</span>}</div>{q && <span className={`pill ${q.cor}`}><CalendarClock /> Propostas {q.texto}</span>}</div>
          <h3>{l.municipio}/{l.uf} — {l.orgao_nome}</h3>
          <div className="obj">{l.objeto}</div>
          <div className="foot"><div className="valor">{brl(l.valor_estimado)}</div><span className="row muted">Abrir <ChevronRight /></span></div>
        </Link>; })}
    </>}
    {cfgAberta && config && <ConfigModal config={config} fechar={() => setCfgAberta(false)} salvo={c => { setConfig(c); setCfgAberta(false); buscar(c); }} />}
    {toast && <div className="toast">{toast}</div>}
  </Shell>;
}

function ConfigModal({ config, fechar, salvo }: { config: ConfigBusca; fechar: () => void; salvo: (c: ConfigBusca) => void }) {
  const [palavras, setPalavras] = useState(config.palavras), [nova, setNova] = useState(""), [ufs, setUfs] = useState(config.ufs);
  const [vmin, setVmin] = useState(config.valor_min?.toString() || ""), [vmax, setVmax] = useState(config.valor_max?.toString() || ""), [busy, setBusy] = useState(false);
  const add = () => { const p = nova.trim().toLowerCase(); if (p && !palavras.includes(p)) setPalavras([...palavras, p]); setNova(""); };
  async function salvar() {
    setBusy(true);
    const c = { ...config, palavras, ufs, valor_min: vmin ? Number(vmin) : null, valor_max: vmax ? Number(vmax) : null };
    await sb().from("config_busca").update({ palavras: c.palavras, ufs: c.ufs, valor_min: c.valor_min, valor_max: c.valor_max, atualizado_em: new Date().toISOString() }).eq("id", 1);
    setBusy(false); salvo(c);
  }
  return <div className="modal-bg" onMouseDown={fechar}><div className="modal-box" onMouseDown={e => e.stopPropagation()}>
    <div className="row" style={{ justifyContent: "space-between" }}><h2>O que procurar</h2><button className="btn small" onClick={fechar}><X /></button></div>
    <div className="field">Palavras ou expressões<small>Digite e aperte Enter. Expressões com mais de uma palavra são buscadas juntas (ex.: “quadra poliesportiva”).</small>
      <div className="tag-input">{palavras.map(p => <span key={p}>{p}<button type="button" onClick={() => setPalavras(palavras.filter(x => x !== p))}><X /></button></span>)}
        <input value={nova} onChange={e => setNova(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }} onBlur={add} placeholder="nova palavra…" /></div></div>
    <div className="field">Estados<small>Nenhum marcado = Brasil inteiro.</small>
      <div className="uf-grid">{UFS.map(u => <button type="button" key={u} className={ufs.includes(u) ? "on" : ""} onClick={() => setUfs(ufs.includes(u) ? ufs.filter(x => x !== u) : [...ufs, u])}>{u}</button>)}</div>
      <div className="row" style={{ marginTop: 6 }}><button type="button" className="btn small" onClick={() => setUfs([])}>Brasil inteiro</button><button type="button" className="btn small" onClick={() => setUfs(["CE"])}>Só Ceará</button><button type="button" className="btn small" onClick={() => setUfs(["CE", "PI", "RN", "PB", "PE"])}>CE e vizinhos</button></div></div>
    <div className="form-grid"><label className="field">Valor mínimo (R$)<input type="number" min={0} value={vmin} onChange={e => setVmin(e.target.value)} placeholder="sem mínimo" /></label><label className="field">Valor máximo (R$)<input type="number" min={0} value={vmax} onChange={e => setVmax(e.target.value)} placeholder="sem máximo" /></label></div>
    <div className="row" style={{ justifyContent: "flex-end" }}><button className="btn" onClick={fechar}>Cancelar</button><button className="btn primary" disabled={busy || !palavras.length} onClick={salvar}>{busy ? <LoaderCircle className="spin" /> : <Search />} Salvar e procurar</button></div>
  </div></div>;
}
