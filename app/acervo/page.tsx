"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Award, ChevronDown, ChevronUp, Eye, FilePlus2, FileUp, LoaderCircle, Pencil, Plus, Search, Trash2, X, CheckCircle2 } from "lucide-react";
import { Shell } from "@/components/Sidebar";
import { sb } from "@/lib/supabase";
import { lerAcervo, raizes, fmtQ, TIPOS_ACERVO, type Acervo, type Obra, type Servico, type TipoAcervo } from "@/lib/acervo";
import { lerLinhasPdf } from "@/lib/pdf-cliente";
import { brl } from "@/lib/dados";

export default function AcervoPage() {
  const [lista, setLista] = useState<Acervo[] | null>(null);
  const [busca, setBusca] = useState(""), [aberto, setAberto] = useState<string | null>(null), [editando, setEditando] = useState<Partial<Acervo> | null>(null), [toast, setToast] = useState("");
  const carregar = () => sb().from("acervos").select("*").order("criado_em", { ascending: false }).then(({ data }) => setLista((data || []) as Acervo[]));
  useEffect(() => { carregar(); }, []);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(""), 2800); return () => clearTimeout(t); } }, [toast]);

  const resultados = useMemo(() => {
    const r = raizes(busca);
    if (!lista || !r.length) return [];
    return lista.flatMap(a => a.obras.flatMap(o => o.servicos.filter(s => { const rs = raizes(s.descricao); return r.every(x => rs.some(y => y.startsWith(x) || x.startsWith(y))); }).map(s => ({ a, o, s }))));
  }, [busca, lista]);
  const totais = useMemo(() => { const m = new Map<string, number>(); resultados.forEach(r => m.set(r.s.unidade, (m.get(r.s.unidade) || 0) + r.s.quantidade)); return [...m.entries()]; }, [resultados]);

  async function abrirArquivo(a: Acervo) {
    if (!a.arquivo_path) return;
    const { data } = await sb().storage.from("documentos").createSignedUrl(a.arquivo_path, 300);
    if (data) window.open(data.signedUrl, "_blank"); else setToast("Não consegui abrir o arquivo.");
  }
  async function apagar(a: Acervo) {
    if (!confirm(`Apagar "${a.titulo}" do acervo? O PDF também será apagado e não dá para desfazer.`)) return;
    if (a.arquivo_path) await sb().storage.from("documentos").remove([a.arquivo_path]);
    await sb().from("acervos").delete().eq("id", a.id); setToast("Acervo apagado."); carregar();
  }
  const nServ = (a: Acervo) => a.obras.reduce((s, o) => s + o.servicos.length, 0);

  return <Shell>
    <div className="page-head">
      <div><small>Capacidade técnica</small><h1>Acervo técnico</h1><p>CATs, CAOs e atestados que provam as obras já feitas. O sistema lê os serviços e quantidades de cada um e usa isso para conferir as <b>parcelas de maior relevância</b> dos editais.</p></div>
      <button className="btn primary big" onClick={() => setEditando({})}><FilePlus2 /> Adicionar acervo</button>
    </div>
    {!lista ? <div className="loading"><LoaderCircle className="spin" /></div> : <>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Já fizemos isso antes?</h2>
        <p className="muted" style={{ marginTop: 0 }}>Digite um serviço para ver em quais acervos ele aparece e a quantidade total.</p>
        <div className="big-search"><Search /><input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Ex.: alambrado, grama sintética, cobertura metálica, alvenaria" />{busca && <button className="btn small" onClick={() => setBusca("")}><X /></button>}</div>
        {busca && raizes(busca).length > 0 && <div style={{ marginTop: 12 }}>
          {!resultados.length ? <div className="notice warn">Nada encontrado com “{busca}”. Tente outra palavra (ex.: “telha” em vez de “telhado”).</div> : <>
            <div className="row" style={{ gap: 8 }}>{totais.map(([u, q]) => <span key={u} className="pill ok" style={{ fontSize: 14 }}>Total: {fmtQ(q, u)}</span>)}<span className="help">em {resultados.length} linha{resultados.length > 1 ? "s" : ""}</span></div>
            <div style={{ marginTop: 6 }}>{resultados.slice(0, 40).map((r, i) => <div className="match-row" key={i}><div><b>{r.s.descricao}</b><div className="help">{r.a.titulo}{r.o.local ? ` • ${r.o.local}` : ""}{r.s.origem ? ` • ${r.s.origem === "CREA" ? "atividade registrada no CREA" : "planilha do atestado"}` : ""}</div></div><b style={{ whiteSpace: "nowrap" }}>{fmtQ(r.s.quantidade, r.s.unidade)}</b></div>)}</div>
          </>}
        </div>}
      </div>

      {!lista.length ? <div className="empty"><Award /><h3>Nenhum acervo cadastrado</h3><p>Envie os PDFs das CATs, CAOs e atestados.</p></div> : lista.map(a => <div className="acervo-card" key={a.id}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="row" style={{ gap: 6 }}><span className={`pill ${a.tipo === "cat" ? "info" : a.tipo === "cao" ? "ok" : a.tipo === "atestado" ? "warn" : "gray"}`}>{TIPOS_ACERVO[a.tipo].nome}</span><span className="pill gray">{nServ(a)} serviços</span></div>
          <div className="row">{a.arquivo_path && <button className="btn small" onClick={() => abrirArquivo(a)}><Eye /> Ver PDF</button>}<button className="btn small" onClick={() => setEditando(a)}><Pencil /> Editar</button><button className="btn small danger" onClick={() => apagar(a)}><Trash2 /></button></div>
        </div>
        <h3>{a.titulo}</h3>
        {a.profissional && <div className="help">Responsável técnico: <b>{a.profissional}</b></div>}
        {a.observacao && <div className="where">{a.observacao}</div>}
        {a.obras.map((o, i) => <div className="obra-box" key={i}>
          <b>{o.contratante || "Contratante não informado"}{o.local ? ` — ${o.local}` : ""}</b>
          <div className="meta">{o.art && <span>{/^\d|^CE/.test(o.art) ? `ART ${o.art}` : o.art}</span>}{(o.inicio || o.fim) && <span>{o.inicio || "?"} a {o.fim || "?"}</span>}{o.valor ? <span>{brl(o.valor)}</span> : null}<span>{o.servicos.length} serviços</span></div>
          {o.objeto && <div className="help" style={{ marginTop: 4 }}>{o.objeto}</div>}
        </div>)}
        {nServ(a) > 0 && <button className="btn small" style={{ marginTop: 10 }} onClick={() => setAberto(aberto === a.id ? null : a.id)}>{aberto === a.id ? <><ChevronUp /> Esconder serviços</> : <><ChevronDown /> Ver serviços e quantidades</>}</button>}
        {aberto === a.id && a.obras.map((o, i) => o.servicos.length > 0 && <table className="serv-table" key={i}><thead><tr><th>{o.contratante || "Serviços"}{o.local ? ` — ${o.local}` : ""}</th><th style={{ textAlign: "right" }}>Quantidade</th></tr></thead><tbody>{o.servicos.map((s, j) => <tr key={j}><td>{s.descricao}{s.codigo && <span className="help"> ({s.codigo})</span>}</td><td className="q">{fmtQ(s.quantidade, s.unidade)}</td></tr>)}</tbody></table>)}
      </div>)}
    </>}
    {editando && <AcervoModal inicial={editando} fechar={() => setEditando(null)} salvo={m => { setEditando(null); setToast(m); carregar(); }} />}
    {toast && <div className="toast">{toast}</div>}
  </Shell>;
}

const obraVazia = (): Obra => ({ contratante: "", local: "", servicos: [] });

function AcervoModal({ inicial, fechar, salvo }: { inicial: Partial<Acervo>; fechar: () => void; salvo: (m: string) => void }) {
  const novo = !inicial.id;
  const [a, setA] = useState<Partial<Acervo>>({ tipo: "cat", titulo: "", numero: "", profissional: "", observacao: "", obras: [], ...inicial });
  const [arquivo, setArquivo] = useState<File | null>(null), [lendo, setLendo] = useState(false), [aviso, setAviso] = useState(""), [busy, setBusy] = useState(false), [erro, setErro] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const obras = a.obras || [];
  const setObra = (i: number, o: Partial<Obra>) => setA(x => ({ ...x, obras: (x.obras || []).map((y, k) => k === i ? { ...y, ...o } : y) }));
  const setServ = (i: number, j: number, s: Partial<Servico>) => setObra(i, { servicos: obras[i].servicos.map((y, k) => k === j ? { ...y, ...s } : y) });

  async function escolher(f: File | null) {
    setArquivo(f); setAviso("");
    if (!f || !/\.pdf$/i.test(f.name)) return;
    setLendo(true);
    try {
      const { linhas } = await lerLinhasPdf(f);
      const lido = lerAcervo(linhas);
      const total = lido.obras.reduce((s, o) => s + o.servicos.length, 0);
      if (linhas.join("").trim().length < 200) setAviso("Este PDF parece ser escaneado (só imagem): preencha os serviços principais à mão abaixo.");
      else setAviso(total ? `Li ${lido.obras.length} obra(s) e ${total} serviço(s). Confira as descrições e quantidades antes de salvar.` : "Não encontrei serviços com quantidade no texto. Preencha os principais à mão.");
      setA(x => ({ ...x, ...lido, titulo: lido.titulo || x.titulo, obras: lido.obras.length ? lido.obras : x.obras }));
    } catch { setAviso("Não consegui ler o PDF automaticamente. Preencha à mão."); } finally { setLendo(false); }
  }

  async function salvar() {
    setErro(""); if (!a.titulo?.trim()) { setErro("Dê um nome para o acervo."); return; }
    setBusy(true);
    try {
      let arquivo_path = inicial.arquivo_path || null, arquivo_nome = inicial.arquivo_nome || null;
      if (arquivo) {
        const limpo = arquivo.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-]+/g, "_").slice(-90);
        const caminho = `acervo/${crypto.randomUUID()}-${limpo}`;
        const up = await sb().storage.from("documentos").upload(caminho, arquivo, { contentType: arquivo.type || "application/pdf" });
        if (up.error) throw new Error("Falha ao enviar o arquivo: " + up.error.message);
        if (inicial.arquivo_path) await sb().storage.from("documentos").remove([inicial.arquivo_path]);
        arquivo_path = caminho; arquivo_nome = arquivo.name;
      }
      const limpas = obras.map(o => ({ ...o, servicos: o.servicos.filter(s => s.descricao.trim() && s.quantidade > 0) }));
      const linha = { tipo: a.tipo, titulo: a.titulo!.trim(), numero: a.numero || null, profissional: a.profissional || null, observacao: a.observacao || null, obras: limpas, arquivo_path, arquivo_nome, atualizado_em: new Date().toISOString() };
      const r = novo ? await sb().from("acervos").insert(linha) : await sb().from("acervos").update(linha).eq("id", inicial.id!);
      if (r.error) throw new Error(r.error.message);
      salvo(novo ? "Acervo guardado." : "Acervo atualizado.");
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao salvar."); } finally { setBusy(false); }
  }

  return <div className="modal-bg" onMouseDown={fechar}><div className="modal-box" style={{ width: "min(960px,100%)" }} onMouseDown={e => e.stopPropagation()}>
    <div className="row" style={{ justifyContent: "space-between" }}><h2>{novo ? "Adicionar acervo" : "Editar acervo"}</h2><button className="btn small" onClick={fechar}><X /></button></div>
    <div className="dropzone" onClick={() => input.current?.click()}>
      {lendo ? <LoaderCircle className="spin" /> : <FileUp />}<b>{lendo ? "Lendo o PDF…" : arquivo ? arquivo.name : inicial.arquivo_nome ? `Arquivo atual: ${inicial.arquivo_nome}` : "Clique para escolher o PDF da CAT, CAO ou atestado"}</b>
      <span className="help">O sistema tenta ler sozinho os serviços e as quantidades.</span>
      <input ref={input} type="file" hidden accept="application/pdf,image/*" onChange={e => escolher(e.target.files?.[0] || null)} />
    </div>
    {aviso && <div className="notice info"><CheckCircle2 /><div>{aviso}</div></div>}
    <div className="form-grid">
      <label className="field">Tipo<select value={a.tipo} onChange={e => setA({ ...a, tipo: e.target.value as TipoAcervo })}>{(Object.keys(TIPOS_ACERVO) as TipoAcervo[]).map(t => <option key={t} value={t}>{TIPOS_ACERVO[t].nome}</option>)}</select><small>{TIPOS_ACERVO[a.tipo as TipoAcervo]?.dica}</small></label>
      <label className="field">Número (CAT/CAO)<input value={a.numero || ""} onChange={e => setA({ ...a, numero: e.target.value })} /></label>
      <label className="field full">Nome (como vai aparecer)<input value={a.titulo || ""} onChange={e => setA({ ...a, titulo: e.target.value })} placeholder="Ex.: CAT — Areninha de Chaval" /></label>
      <label className="field">Responsável técnico<input value={a.profissional || ""} onChange={e => setA({ ...a, profissional: e.target.value })} /></label>
      <label className="field">Observação<input value={a.observacao || ""} onChange={e => setA({ ...a, observacao: e.target.value })} /></label>
    </div>
    <div className="row" style={{ justifyContent: "space-between" }}><h3 style={{ margin: 0 }}>Obras e serviços</h3><button className="btn small" onClick={() => setA({ ...a, obras: [...obras, obraVazia()] })}><Plus /> Adicionar obra</button></div>
    {!obras.length && <p className="help">Nenhuma obra ainda. Envie o PDF ou clique em “Adicionar obra”.</p>}
    {obras.map((o, i) => <div className="obra-box" key={i}>
      <div className="form-grid">
        <label className="field">Contratante<input value={o.contratante || ""} onChange={e => setObra(i, { contratante: e.target.value })} /></label>
        <label className="field">Cidade/UF<input value={o.local || ""} onChange={e => setObra(i, { local: e.target.value })} placeholder="Chaval/CE" /></label>
        <label className="field">Início<input value={o.inicio || ""} onChange={e => setObra(i, { inicio: e.target.value })} placeholder="dd/mm/aaaa" /></label>
        <label className="field">Fim<input value={o.fim || ""} onChange={e => setObra(i, { fim: e.target.value })} placeholder="dd/mm/aaaa" /></label>
        <label className="field full">Objeto / descrição da obra<input value={o.objeto || ""} onChange={e => setObra(i, { objeto: e.target.value })} /></label>
      </div>
      <table className="serv-table"><thead><tr><th>Serviço</th><th>Quantidade</th><th>Unid.</th><th /></tr></thead><tbody>
        {o.servicos.map((s, j) => <tr key={j}><td><input value={s.descricao} onChange={e => setServ(i, j, { descricao: e.target.value })} /></td><td><input className="qn" type="number" step="any" value={s.quantidade} onChange={e => setServ(i, j, { quantidade: Number(e.target.value) })} /></td><td><input className="un" value={s.unidade} onChange={e => setServ(i, j, { unidade: e.target.value })} /></td><td><button className="btn small danger" onClick={() => setObra(i, { servicos: o.servicos.filter((_, k) => k !== j) })}><Trash2 /></button></td></tr>)}
      </tbody></table>
      <div className="row" style={{ marginTop: 8 }}><button className="btn small" onClick={() => setObra(i, { servicos: [...o.servicos, { descricao: "", quantidade: 0, unidade: "m²", origem: "Manual" }] })}><Plus /> Serviço</button><button className="btn small danger" onClick={() => setA({ ...a, obras: obras.filter((_, k) => k !== i) })}><Trash2 /> Remover obra</button></div>
    </div>)}
    {erro && <div className="notice bad">{erro}</div>}
    <div className="row" style={{ justifyContent: "flex-end" }}><button className="btn" onClick={fechar}>Cancelar</button><button className="btn primary" disabled={busy || lendo} onClick={salvar}>{busy ? <LoaderCircle className="spin" /> : <CheckCircle2 />} Salvar</button></div>
  </div></div>;
}
