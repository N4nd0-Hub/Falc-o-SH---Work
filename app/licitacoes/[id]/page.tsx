"use client";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Calculator, CheckCircle2, Clock, Download, ExternalLink, FileSearch, FileText, FileUp, Info, LoaderCircle, Plus, Printer, ShieldAlert, XCircle } from "lucide-react";
import { Shell } from "@/components/Sidebar";
import { brl, carregarDocumentos, carregarEmpresa, dataHora, quantoFalta, SITUACOES } from "@/lib/dados";
import { sb, type Licitacao } from "@/lib/supabase";
import { gerarRelatorio, type ArquivoTexto, type Relatorio, type Situacao } from "@/lib/requisitos";
import { lerPdfNoNavegador } from "@/lib/pdf-cliente";
import type { Arquivo } from "@/lib/pncp";

type Detalhes = { objeto?: string; complemento?: string | null; abertura?: string | null; encerramento?: string | null; link_origem?: string | null; modalidade?: string; modo_disputa?: string; numero?: string; processo?: string; amparo?: string; situacao?: string; arquivos?: Arquivo[] };
type Orc = { id: string; titulo: string; valor_proposta: number | null; atualizado_em: string };

const VISUAL: Record<Situacao, { cls: "ok" | "warn" | "bad"; nome: string; Icon: typeof CheckCircle2 }> = {
  ok: { cls: "ok", nome: "OK", Icon: CheckCircle2 },
  conferir: { cls: "warn", nome: "Conferir", Icon: Info },
  sem_arquivo: { cls: "warn", nome: "Falta o arquivo", Icon: AlertTriangle },
  vence_antes: { cls: "warn", nome: "Vence antes", Icon: Clock },
  vencido: { cls: "bad", nome: "Vencido", Icon: XCircle },
  falta: { cls: "bad", nome: "Falta", Icon: XCircle },
};

export default function LicitacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [lic, setLic] = useState<Licitacao | null | undefined>(undefined);
  const [det, setDet] = useState<Detalhes | null>(null), [detErro, setDetErro] = useState(false);
  const [rel, setRel] = useState<Relatorio | null>(null), [gerando, setGerando] = useState<string>(""), [erro, setErro] = useState("");
  const [orcs, setOrcs] = useState<Orc[]>([]), [notas, setNotas] = useState("");
  const upload = useRef<HTMLInputElement>(null);

  useEffect(() => { (async () => {
    const { data } = await sb().from("licitacoes").select("*").eq("id", id).maybeSingle();
    const l = data as Licitacao | null; setLic(l);
    if (!l) return;
    setRel((l.relatorio as Relatorio) || null); setNotas(l.notas || "");
    const o = await sb().from("orcamentos").select("id,titulo,valor_proposta,atualizado_em").eq("licitacao_id", id).order("atualizado_em", { ascending: false });
    setOrcs((o.data || []) as Orc[]);
    try {
      const r = await fetch(`/api/pncp/compra?cnpj=${l.orgao_cnpj}&ano=${l.ano}&seq=${l.sequencial}`);
      if (!r.ok) throw 0;
      const d = await r.json() as Detalhes; setDet(d);
      // mantém a data atualizada (órgãos às vezes adiam a licitação)
      if (d.encerramento && d.encerramento !== l.abertura) { await sb().from("licitacoes").update({ abertura: d.encerramento, encerramento: d.encerramento, link_origem: d.link_origem ?? l.link_origem }).eq("id", id); setLic({ ...l, abertura: d.encerramento }); }
    } catch { setDetErro(true); }
  })(); }, [id]);

  useEffect(() => { if (lic === undefined || lic === null || notas === (lic.notas || "")) return; const t = setTimeout(() => { sb().from("licitacoes").update({ notas }).eq("id", id); }, 800); return () => clearTimeout(t); }, [notas]); // eslint-disable-line

  async function mudarSituacao(s: Licitacao["situacao"]) { if (!lic) return; setLic({ ...lic, situacao: s }); await sb().from("licitacoes").update({ situacao: s, atualizado_em: new Date().toISOString() }).eq("id", id); }

  async function relatorioCom(arquivos: ArquivoTexto[]) {
    setGerando("Comparando com os documentos do cofre…");
    const [documentos, empresa] = await Promise.all([carregarDocumentos(), carregarEmpresa()]);
    const r = gerarRelatorio({ arquivos, documentos, empresa, abertura: lic?.abertura || null, valorEstimado: lic?.valor_estimado ?? null });
    setRel(r);
    await sb().from("licitacoes").update({ relatorio: r, relatorio_em: r.geradoEm, situacao: lic?.situacao === "interesse" ? "analisando" : lic?.situacao }).eq("id", id);
    if (lic?.situacao === "interesse") setLic({ ...lic, situacao: "analisando" });
    setGerando("");
  }
  async function gerarAutomatico() {
    if (!lic) return; setErro(""); setGerando("Baixando e lendo o edital no PNCP… (pode levar até 1 minuto)");
    try {
      const r = await fetch("/api/edital/texto", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cnpj: lic.orgao_cnpj, ano: lic.ano, seq: lic.sequencial }) });
      const j = await r.json() as { arquivos?: ArquivoTexto[]; erro?: string };
      await relatorioCom(j.arquivos || []);
      if (j.erro) setErro(j.erro);
    } catch { setErro("Não consegui ler o edital agora. Você pode enviar o PDF manualmente."); await relatorioCom([]); }
  }
  async function gerarComArquivos(files: FileList | null) {
    if (!files?.length) return; setErro(""); setGerando("Lendo o PDF enviado…");
    try { const lidos = await Promise.all([...files].map(lerPdfNoNavegador)); await relatorioCom(lidos); }
    catch { setGerando(""); setErro("Não consegui ler este arquivo. Envie um PDF."); }
  }
  async function novoOrcamento() {
    if (!lic) return;
    const oid = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const titulo = (lic.objeto || "Novo orçamento").replace(/\s+/g, " ").slice(0, 140);
    const dados = { id: oid, titulo, cliente: lic.orgao_nome || "Cliente a definir", municipio: `${lic.municipio || ""} / ${lic.uf || ""}`, modalidade: lic.modalidade || "A definir", bdi: 22.07, desconto: 0, itens: [], atualizadoEm: "Agora", meta: { processo: det?.processo || "", numero: det?.numero || "" } };
    const { error } = await sb().from("orcamentos").insert({ id: oid, titulo, cliente: dados.cliente, municipio: dados.municipio, dados, licitacao_id: lic.id, valor_proposta: 0 });
    if (error) { setErro("Não consegui criar o orçamento: " + error.message); return; }
    router.push(`/orcamentos?id=${oid}`);
  }

  if (lic === undefined) return <Shell><div className="loading"><LoaderCircle className="spin" /></div></Shell>;
  if (lic === null) return <Shell><div className="empty" style={{ marginTop: 40 }}><h3>Licitação não encontrada</h3><Link className="btn" href="/licitacoes?aba=minhas">Voltar</Link></div></Shell>;
  const q = quantoFalta(lic.abertura);
  const urlPncp = `https://pncp.gov.br/app/editais/${lic.orgao_cnpj}/${lic.ano}/${lic.sequencial}`;
  const pct = rel && rel.resumo.total ? Math.round(rel.resumo.ok / rel.resumo.total * 100) : 0;
  const problemas = rel ? rel.itens.filter(i => VISUAL[i.situacao].cls === "bad").length + rel.alertas.filter(a => a.tipo === "problema").length : 0;

  return <Shell>
    <div className="page-head">
      <div><Link href="/licitacoes?aba=minhas" className="row muted no-print" style={{ textDecoration: "none", gap: 6, fontSize: 14 }}><ArrowLeft style={{ width: 16 }} /> Minhas licitações</Link>
        <h1>{lic.municipio}/{lic.uf}</h1><p>{lic.orgao_nome}</p></div>
      <div className="row no-print">{q && <span className={`pill ${q.cor}`} style={{ fontSize: 14, padding: "8px 14px" }}><Clock /> Propostas {q.texto}</span>}</div>
    </div>

    <div className="filters no-print">{(Object.keys(SITUACOES) as Licitacao["situacao"][]).map(s => <button key={s} className={`chip ${lic.situacao === s ? "active" : ""}`} onClick={() => mudarSituacao(s)}>{SITUACOES[s].nome}</button>)}</div>

    <div className="grid2">
      <div className="card">
        <h2>Sobre a licitação</h2>
        <p style={{ lineHeight: 1.5 }}>{det?.objeto || lic.objeto}</p>
        <dl className="kv">
          <dt>Valor estimado</dt><dd>{brl(lic.valor_estimado)}</dd>
          <dt>Propostas até</dt><dd>{dataHora(det?.encerramento || lic.abertura)}</dd>
          <dt>Modalidade</dt><dd>{det?.modalidade || lic.modalidade}{det?.modo_disputa ? ` • ${det.modo_disputa}` : ""}</dd>
          <dt>Órgão / unidade</dt><dd>{lic.orgao_nome}{lic.unidade_nome ? ` — ${lic.unidade_nome}` : ""}</dd>
          {det?.processo && <><dt>Processo</dt><dd>{det.processo}{det.numero ? ` (nº ${det.numero})` : ""}</dd></>}
          {det?.situacao && <><dt>Situação no PNCP</dt><dd>{det.situacao}</dd></>}
        </dl>
        {det?.complemento && <p className="help" style={{ marginTop: 12 }}>{det.complemento}</p>}
        <div className="row no-print" style={{ marginTop: 14 }}>
          <a className="btn small" href={urlPncp} target="_blank" rel="noreferrer"><ExternalLink /> Ver no PNCP</a>
          {(det?.link_origem || lic.link_origem) && <a className="btn small" href={(det?.link_origem || lic.link_origem)!} target="_blank" rel="noreferrer"><ExternalLink /> Sistema da disputa</a>}
        </div>
      </div>
      <div className="card no-print">
        <h2>Arquivos do edital</h2>
        {detErro && <div className="notice warn">O PNCP não respondeu agora. Os arquivos aparecem quando ele voltar.</div>}
        {!det && !detErro ? <LoaderCircle className="spin" /> : det?.arquivos?.length ? <div className="files">{det.arquivos.map(a => <a key={a.n} href={`/api/pncp/arquivo?cnpj=${lic.orgao_cnpj}&ano=${lic.ano}&seq=${lic.sequencial}&n=${a.n}`} target="_blank" rel="noreferrer"><FileText /> <span>{a.titulo}</span><small>{a.tipo}</small><Download style={{ width: 16 }} /></a>)}</div>
          : !detErro && <div className="notice warn"><AlertTriangle /><div><b>Nenhum arquivo publicado no PNCP.</b>Baixe o edital no site do órgão e envie aqui embaixo para analisar.</div></div>}
        <h3 style={{ marginTop: 18 }}>Anotações</h3>
        <div className="field"><textarea value={notas} onChange={e => setNotas(e.target.value)} placeholder="Ex.: visita técnica agendada dia 20, falar com o contador sobre o balanço…" /><small>Salva sozinho.</small></div>
      </div>
    </div>

    <div className="card" style={{ marginTop: 16 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div><h2>Relatório: a empresa está habilitada?</h2><p className="muted" style={{ margin: 0 }}>O sistema lê o edital, encontra os documentos pedidos e confere com o que está no cofre.</p></div>
        <div className="row no-print">
          <button className="btn primary big" disabled={!!gerando} onClick={gerarAutomatico}>{gerando ? <LoaderCircle className="spin" /> : <FileSearch />} {rel ? "Gerar de novo" : "Gerar relatório do que falta"}</button>
          <button className="btn" disabled={!!gerando} onClick={() => upload.current?.click()}><FileUp /> Usar PDF que eu tenho</button>
          {rel && <button className="btn" onClick={() => window.print()}><Printer /> Imprimir</button>}
          <input ref={upload} type="file" accept="application/pdf" multiple hidden onChange={e => { gerarComArquivos(e.target.files); e.currentTarget.value = ""; }} />
        </div>
      </div>
      {gerando && <div className="notice info" style={{ marginTop: 14 }}><LoaderCircle className="spin" /><div>{gerando}</div></div>}
      {erro && <div className="notice warn" style={{ marginTop: 14 }}>{erro}</div>}
      {!rel && !gerando && <div className="empty" style={{ marginTop: 16 }}><FileSearch /><h3>Nenhum relatório ainda</h3><p>Clique em <b>Gerar relatório do que falta</b>. Leva até um minuto.</p></div>}
      {rel && !gerando && <>
        <div className="score" style={{ marginTop: 18 }}>
          <div className="score-ring" style={{ background: `conic-gradient(${problemas ? "#b42318" : "#1f7a4d"} ${pct * 3.6}deg, #eee 0)` }}><div style={{ background: "#fff", width: 76, height: 76, borderRadius: "50%", display: "grid", placeItems: "center" }}>{pct}%</div></div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h3 style={{ fontSize: 20 }}>{problemas ? `${problemas} pendência${problemas > 1 ? "s" : ""} que pode${problemas > 1 ? "m" : ""} inabilitar` : rel.resumo.pendentes ? "Quase lá: alguns itens para conferir" : "Tudo certo com os documentos!"}</h3>
            <p className="muted" style={{ margin: "4px 0 0" }}>{rel.resumo.ok} de {rel.resumo.total} itens OK • gerado em {dataHora(rel.geradoEm)} • {rel.editalLido ? `${rel.arquivosLidos.filter(a => !a.aviso).length} arquivo(s) lido(s)` : "edital não lido"}</p>
          </div>
        </div>
        {rel.arquivosLidos.some(a => a.aviso) && <details className="help" style={{ marginTop: 10 }}><summary>Arquivos com aviso ({rel.arquivosLidos.filter(a => a.aviso).length})</summary>{rel.arquivosLidos.filter(a => a.aviso).map(a => <div key={a.titulo}>• {a.titulo}: {a.aviso}</div>)}</details>}
        {rel.alertas.length > 0 && <div style={{ marginTop: 16 }}>{rel.alertas.map((a, i) => <div key={i} className={`notice ${a.tipo === "problema" ? "bad" : a.tipo === "atencao" ? "warn" : "info"}`}>{a.tipo === "problema" ? <ShieldAlert /> : a.tipo === "atencao" ? <AlertTriangle /> : <Info />}<div><b>{a.titulo}</b>{a.texto}{a.trecho && <div className="trecho">“{a.trecho}”</div>}</div></div>)}</div>}
        <div style={{ marginTop: 10 }}>{[...rel.itens].sort((a, b) => ["bad", "warn", "ok"].indexOf(VISUAL[a.situacao].cls) - ["bad", "warn", "ok"].indexOf(VISUAL[b.situacao].cls)).map(i => { const v = VISUAL[i.situacao]; return <div className="report-item" key={i.id}>
          <div className={`ico ${v.cls}`}><v.Icon style={{ width: 18 }} /></div>
          <div><h3>{i.nome}</h3><p>{i.explicacao}</p>{i.trecho && <details><summary>O que o edital diz{i.arquivoEdital ? ` (${i.arquivoEdital})` : ""}</summary><div className="trecho">“{i.trecho}”</div></details>}{!i.detectado && <p className="help">Item padrão (o edital não foi lido).</p>}</div>
          <div className="no-print">{v.cls !== "ok" ? <Link href="/documentos" className="btn small">{i.situacao === "falta" ? <><Plus /> Cadastrar</> : "Resolver"}</Link> : <span className={`pill ${v.cls}`}>{v.nome}</span>}</div>
        </div>; })}</div>
        <p className="help" style={{ marginTop: 12 }}>⚠️ Leitura automática por palavras-chave. Use como checklist e confirme no edital antes de enviar a proposta.</p>
      </>}
    </div>

    <div className="card no-print" style={{ marginTop: 16 }}>
      <div className="row" style={{ justifyContent: "space-between" }}><div><h2>Orçamento</h2><p className="muted" style={{ margin: 0 }}>Monte a proposta no orçamentador. Para usar a planilha do órgão, abra o orçamento e use <b>Importar PDFs</b>.</p></div>
        <button className="btn primary" onClick={novoOrcamento}><Calculator /> Criar orçamento para esta licitação</button></div>
      {orcs.length > 0 && <div className="files" style={{ marginTop: 14 }}>{orcs.map(o => <Link key={o.id} href={`/orcamentos?id=${o.id}`} className="row" style={{ display: "flex" }}><Calculator /> <span>{o.titulo}</span><small>{o.valor_proposta ? brl(o.valor_proposta) : "em montagem"}</small></Link>)}</div>}
    </div>
  </Shell>;
}
