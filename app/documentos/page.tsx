"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Eye, FilePlus2, FileUp, LoaderCircle, Pencil, Plus, Trash2, X } from "lucide-react";
import { Shell } from "@/components/Sidebar";
import { pillStatus } from "@/components/ui";
import { GRUPOS, TIPOS, statusDocumento, tipoPorId } from "@/lib/catalogo-docs";
import { carregarDocumentos, dataCurta } from "@/lib/dados";
import { sb, type Documento } from "@/lib/supabase";

type Filtro = "todos" | "problemas" | "faltando";


export default function Documentos() {
  const [docs, setDocs] = useState<Documento[] | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [editando, setEditando] = useState<Partial<Documento> | null>(null);
  const [toast, setToast] = useState("");
  const recarregar = () => carregarDocumentos().then(setDocs);
  useEffect(() => { recarregar(); }, []);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(""), 2800); return () => clearTimeout(t); } }, [toast]);

  const status = (d: Documento) => statusDocumento(d.validade, tipoPorId(d.tipo)?.temValidade ?? true);
  const contagem = useMemo(() => {
    if (!docs) return { problemas: 0, faltando: 0 };
    const problemas = docs.filter(d => ["vencido", "vence_logo"].includes(status(d)) || !d.arquivo_path).length;
    const faltando = TIPOS.filter(t => t.basico && !docs.some(d => d.tipo === t.id)).length;
    return { problemas, faltando };
  }, [docs]);

  async function abrir(d: Documento) {
    if (!d.arquivo_path) return;
    const { data, error } = await sb().storage.from("documentos").createSignedUrl(d.arquivo_path, 300);
    if (error || !data) { setToast("Não consegui abrir o arquivo."); return; }
    window.open(data.signedUrl, "_blank");
  }
  async function apagar(d: Documento) {
    if (!confirm(`Apagar "${d.titulo}" do cofre? O arquivo também será apagado e não dá para desfazer.`)) return;
    if (d.arquivo_path) await sb().storage.from("documentos").remove([d.arquivo_path]);
    await sb().from("documentos").delete().eq("id", d.id);
    setToast("Documento apagado."); recarregar();
  }

  return <Shell>
    <div className="page-head">
      <div><small>Cofre de documentos</small><h1>Documentos da empresa</h1><p>Guarde aqui as certidões e documentos de habilitação, com a data de validade. Eles ficam seguros e são usados para conferir cada edital.</p></div>
      <button className="btn primary big" onClick={() => setEditando({})}><FilePlus2 /> Adicionar documento</button>
    </div>
    {!docs ? <div className="loading"><LoaderCircle className="spin" /></div> : <>
      <div className="filters">
        <button className={`chip ${filtro === "todos" ? "active" : ""}`} onClick={() => setFiltro("todos")}>Todos <span className="count">{docs.length}</span></button>
        <button className={`chip ${filtro === "problemas" ? "active" : ""}`} onClick={() => setFiltro("problemas")}>Precisam de atenção <span className="count">{contagem.problemas}</span></button>
        <button className={`chip ${filtro === "faltando" ? "active" : ""}`} onClick={() => setFiltro("faltando")}>Faltando <span className="count">{contagem.faltando}</span></button>
      </div>
      {GRUPOS.map(g => {
        const tipos = TIPOS.filter(t => t.grupo === g);
        const linhas = tipos.flatMap(t => {
          const meus = docs.filter(d => d.tipo === t.id);
          if (filtro === "faltando") return meus.length || !t.basico ? [] : [{ t, d: null as Documento | null }];
          if (filtro === "problemas") return meus.filter(d => ["vencido", "vence_logo"].includes(status(d)) || !d.arquivo_path).map(d => ({ t, d }));
          if (!meus.length) return t.id === "outros" ? [] : [{ t, d: null as Documento | null }];
          return meus.map(d => ({ t, d }));
        });
        if (!linhas.length) return null;
        return <section className="doc-group" key={g}><h2>{g}</h2>
          {linhas.map(({ t, d }, i) => d ? <div className="doc-row" key={d.id}>
            <div>
              <h3>{d.titulo}</h3>
              <div className="meta">{pillStatus(status(d), d.validade)}{t.temValidade && <span>Validade: <b>{dataCurta(d.validade)}</b></span>}{d.numero && <span>Nº {d.numero}</span>}{!d.arquivo_path && <span className="pill warn">Sem arquivo anexado</span>}{d.arquivo_nome && <span>📎 {d.arquivo_nome}</span>}</div>
              {d.observacao && <div className="where">{d.observacao}</div>}
            </div>
            <div className="actions">
              {d.arquivo_path && <button className="btn small" onClick={() => abrir(d)}><Eye /> Ver</button>}
              <button className="btn small" onClick={() => setEditando(d)}><Pencil /> {status(d) === "vencido" ? "Renovar" : "Editar"}</button>
              <button className="btn small danger" onClick={() => apagar(d)} title="Apagar"><Trash2 /></button>
            </div>
          </div> : <div className="doc-row missing" key={t.id + i}>
            <div><h3>{t.nome}</h3><div className="meta">{t.basico ? <span className="pill warn">Ainda não cadastrado</span> : <span className="pill gray">Opcional (só alguns editais pedem)</span>}</div>
              <div className="where"><b>Onde tirar:</b> {t.ondeTirar} {t.link && <a href={t.link} target="_blank" rel="noreferrer">Abrir site</a>}</div></div>
            <div className="actions"><button className="btn small" onClick={() => setEditando({ tipo: t.id })}><Plus /> Adicionar</button></div>
          </div>)}
        </section>;
      })}
    </>}
    {editando && <DocModal inicial={editando} fechar={() => setEditando(null)} salvo={m => { setEditando(null); setToast(m); recarregar(); }} />}
    {toast && <div className="toast">{toast}</div>}
  </Shell>;
}

function somarDias(data: string, dias: number) { const d = new Date(data + "T12:00:00"); d.setDate(d.getDate() + dias); return d.toISOString().slice(0, 10); }
const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Fortaleza" });

function DocModal({ inicial, fechar, salvo }: { inicial: Partial<Documento>; fechar: () => void; salvo: (msg: string) => void }) {
  const novo = !inicial.id;
  const [f, setF] = useState({ tipo: inicial.tipo || "", titulo: inicial.titulo || "", numero: inicial.numero || "", emissao: inicial.emissao || (novo ? hoje() : ""), validade: inicial.validade || "", observacao: inicial.observacao || "" });
  const [arquivo, setArquivo] = useState<File | null>(null), [over, setOver] = useState(false), [busy, setBusy] = useState(false), [erro, setErro] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const tipo = tipoPorId(f.tipo);
  useEffect(() => { if (tipo && novo && !f.titulo) setF(x => ({ ...x, titulo: tipo.nome })); }, [f.tipo]); // eslint-disable-line
  useEffect(() => { if (tipo?.validadeDias && f.emissao && !f.validade && novo) setF(x => ({ ...x, validade: somarDias(x.emissao, tipo.validadeDias!) })); }, [f.tipo, f.emissao]); // eslint-disable-line

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro("");
    if (!f.tipo) { setErro("Escolha o tipo de documento."); return; }
    if (!arquivo && !inicial.arquivo_path && !confirm("Salvar sem anexar o arquivo? Você pode anexar depois.")) return;
    setBusy(true);
    try {
      let arquivo_path = inicial.arquivo_path || null, arquivo_nome = inicial.arquivo_nome || null;
      if (arquivo) {
        const limpo = arquivo.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-]+/g, "_").slice(-90);
        const caminho = `docs/${f.tipo}/${crypto.randomUUID()}-${limpo}`;
        const up = await sb().storage.from("documentos").upload(caminho, arquivo, { contentType: arquivo.type || "application/octet-stream" });
        if (up.error) throw new Error("Falha ao enviar o arquivo: " + up.error.message);
        if (inicial.arquivo_path) await sb().storage.from("documentos").remove([inicial.arquivo_path]);
        arquivo_path = caminho; arquivo_nome = arquivo.name;
      }
      const linha = { tipo: f.tipo, titulo: f.titulo.trim() || tipo?.nome || "Documento", numero: f.numero || null, emissao: f.emissao || null, validade: tipo?.temValidade === false ? null : (f.validade || null), observacao: f.observacao || null, arquivo_path, arquivo_nome, atualizado_em: new Date().toISOString() };
      const r = novo ? await sb().from("documentos").insert(linha) : await sb().from("documentos").update(linha).eq("id", inicial.id!);
      if (r.error) throw new Error(r.error.message);
      salvo(novo ? "Documento guardado no cofre." : "Documento atualizado.");
    } catch (er) { setErro(er instanceof Error ? er.message : "Erro ao salvar."); } finally { setBusy(false); }
  }

  return <div className="modal-bg" onMouseDown={fechar}><form className="modal-box" onMouseDown={e => e.stopPropagation()} onSubmit={salvar}>
    <div className="row" style={{ justifyContent: "space-between" }}><h2>{novo ? "Adicionar documento" : "Editar documento"}</h2><button type="button" className="btn small" onClick={fechar}><X /></button></div>
    <label className="field">Que documento é este?
      <select value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value, titulo: novo ? "" : f.titulo, validade: novo ? "" : f.validade })} required>
        <option value="">Escolha…</option>
        {GRUPOS.map(g => <optgroup key={g} label={g}>{TIPOS.filter(t => t.grupo === g).map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}</optgroup>)}
      </select>
    </label>
    {tipo && <div className="help"><b>Onde tirar:</b> {tipo.ondeTirar} {tipo.link && <a href={tipo.link} target="_blank" rel="noreferrer">Abrir site</a>}</div>}
    <label className="field">Nome (como vai aparecer)<input value={f.titulo} onChange={e => setF({ ...f, titulo: e.target.value })} placeholder={tipo?.nome} /></label>
    <div className="form-grid">
      <label className="field">Data de emissão<input type="date" value={f.emissao} onChange={e => setF({ ...f, emissao: e.target.value })} /></label>
      {tipo?.temValidade !== false && <label className="field">Válido até<input type="date" value={f.validade} onChange={e => setF({ ...f, validade: e.target.value })} />{tipo?.validadeDias && <small>Costuma valer {tipo.validadeDias} dias. Confira a data impressa no documento.</small>}</label>}
      <label className="field">Número / código (opcional)<input value={f.numero} onChange={e => setF({ ...f, numero: e.target.value })} /></label>
    </div>
    <div className={`dropzone ${over ? "over" : ""}`} onClick={() => input.current?.click()} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); const file = e.dataTransfer.files?.[0]; if (file) setArquivo(file); }}>
      <FileUp /><b>{arquivo ? arquivo.name : inicial.arquivo_nome ? `Arquivo atual: ${inicial.arquivo_nome}` : "Clique ou arraste o arquivo aqui"}</b>
      <span className="help">{arquivo || inicial.arquivo_nome ? "Clique para trocar o arquivo" : "PDF ou foto do documento (até 50 MB)"}</span>
      <input ref={input} type="file" hidden accept=".pdf,image/*,.doc,.docx,.zip" onChange={e => setArquivo(e.target.files?.[0] || null)} />
    </div>
    <label className="field">Observação (opcional)<textarea value={f.observacao} onChange={e => setF({ ...f, observacao: e.target.value })} placeholder="Ex.: CAT da quadra de Milhã, 450 m² de cobertura metálica" /></label>
    {erro && <div className="notice bad">{erro}</div>}
    <div className="row" style={{ justifyContent: "flex-end" }}><button type="button" className="btn" onClick={fechar}>Cancelar</button><button className="btn primary" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <CheckCircle2 />} Salvar</button></div>
  </form></div>;
}
