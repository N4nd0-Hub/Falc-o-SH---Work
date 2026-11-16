"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Archive, ArchiveRestore, BarChart3, Boxes, Building2, Calculator, CalendarDays, CheckCircle2, ChevronDown, Copy, Download, ExternalLink, FileSpreadsheet, HelpCircle, Layers3, ListTree, Percent, Plus, Printer, RefreshCw, Save, Search, Settings2, Sigma, Trash2, Upload, Users, Wifi, X } from "lucide-react";
import { officialCompositions, officialDescriptions, officialMemory, officialMeta, officialSchedule, patioCompositions, patioItems, patioMeta } from "./official-data";
import { classroomCompositions, classroomItems, classroomMeta, classroomSchedule } from "./classroom-data";
import { cobertaDoloresCompositions, cobertaDoloresItems, cobertaDoloresMeta, cobertaDoloresSchedule } from "./coberta-dolores-data";
import PdfImporter, { type PdfImportResult } from "./pdf-importer";
import Link from "next/link";
import Sidebar, { MobileTabs } from "@/components/Sidebar";
import { sb, type Empresa } from "@/lib/supabase";

type InputKind="Material"|"Mão de obra"|"Equipamento"|"Serviço auxiliar";
type InputItem={id:string;tipo:InputKind;codigo:string;descricao:string;fonte:string;unidade:string;coeficiente:number;preco:number};
type Item={id:string;etapa:string;codigo:string;descricao:string;unidade:string;quantidade:number;preco:number;insumos?:InputItem[];encargos?:string;memoria?:string};
type BdiPart={id:string;sigla:string;descricao:string;percentual:number;grupo:"custo"|"faturamento"};
type Schedule={dias30:number;dias60:number;dias90:number};
type ScheduleRow={nome:string;valor:number;d30:number;d60:number;d90:number};
type SocialCharge={codigo:string;descricao:string;horista:number;mensalista:number;grupo:string};
type BudgetMeta=typeof officialMeta;
type Budget={id:string;titulo:string;cliente:string;municipio:string;modalidade:string;bdi:number;desconto:number;itens:Item[];bdiPartes?:BdiPart[];cronograma?:Schedule;cronogramaEtapas?:ScheduleRow[];encargosSociais?:SocialCharge[];composicoesAuxiliares?:Record<string,InputItem[]>;meta?:BudgetMeta;dadosOficiaisAplicados?:boolean;arquivadoEm?:string;templateRevision?:number;atualizadoEm:string};
type ImportReview={budget:Budget;fileName:string;warnings:string[]};
type CatalogItem=Item&{fonte:string;referencia:string;url?:string;online?:boolean};
type View="orcamentos"|"obras"|"composicoes"; type Section="dados"|"resumo"|"planilha"|"memoria"|"quantitativos"|"abc"|"cronograma"|"bdi"|"encargos";

const defaultBdi:BdiPart[]=[
 {id:"ac",sigla:"AC",descricao:"Administração central",percentual:3,grupo:"custo"},
 {id:"i",sigla:"I",descricao:"Impostos: COFINS, PIS, CPRB e ISS",percentual:8.35,grupo:"faturamento"},
 {id:"l",sigla:"L",descricao:"Lucro bruto",percentual:6.16,grupo:"faturamento"},
 {id:"sg",sigla:"S+G",descricao:"Seguro e garantia",percentual:.8,grupo:"faturamento"},
 {id:"r",sigla:"R",descricao:"Risco",percentual:.97,grupo:"faturamento"},
 {id:"df",sigla:"DF",descricao:"Despesas financeiras",percentual:.59,grupo:"faturamento"}
];
const defaultSocialCharges:SocialCharge[]=[
 {codigo:"A1",descricao:"INSS",horista:0,mensalista:0,grupo:"A"},{codigo:"A2",descricao:"SESI",horista:1.5,mensalista:1.5,grupo:"A"},{codigo:"A3",descricao:"SENAI",horista:1,mensalista:1,grupo:"A"},{codigo:"A4",descricao:"INCRA",horista:.2,mensalista:.2,grupo:"A"},{codigo:"A5",descricao:"SEBRAE",horista:.6,mensalista:.6,grupo:"A"},{codigo:"A6",descricao:"Salário Educação",horista:2.5,mensalista:2.5,grupo:"A"},{codigo:"A7",descricao:"Seguro Contra Acidentes de Trabalho",horista:3,mensalista:3,grupo:"A"},{codigo:"A8",descricao:"FGTS",horista:8,mensalista:8,grupo:"A"},{codigo:"A9",descricao:"SECONCI",horista:0,mensalista:0,grupo:"A"},
 {codigo:"B1",descricao:"Repouso Semanal Remunerado",horista:17.85,mensalista:0,grupo:"B"},{codigo:"B2",descricao:"Feriados",horista:3.71,mensalista:0,grupo:"B"},{codigo:"B3",descricao:"Auxílio - Enfermidade",horista:.87,mensalista:.66,grupo:"B"},{codigo:"B4",descricao:"13º Salário",horista:11.03,mensalista:8.33,grupo:"B"},{codigo:"B5",descricao:"Licença Paternidade",horista:.07,mensalista:.05,grupo:"B"},{codigo:"B6",descricao:"Faltas Justificadas",horista:.74,mensalista:.56,grupo:"B"},{codigo:"B7",descricao:"Dias de Chuvas",horista:1.59,mensalista:0,grupo:"B"},{codigo:"B8",descricao:"Auxílio Acidente de Trabalho",horista:.11,mensalista:.08,grupo:"B"},{codigo:"B9",descricao:"Férias Gozadas",horista:12.35,mensalista:9.33,grupo:"B"},{codigo:"B10",descricao:"Salário Maternidade",horista:.04,mensalista:.03,grupo:"B"},
 {codigo:"C1",descricao:"Aviso Prévio Indenizado",horista:5.52,mensalista:4.17,grupo:"C"},{codigo:"C2",descricao:"Aviso Prévio Trabalhado",horista:.13,mensalista:.1,grupo:"C"},{codigo:"C3",descricao:"Férias Indenizadas",horista:1.72,mensalista:1.3,grupo:"C"},{codigo:"C4",descricao:"Depósito Rescisão Sem Justa Causa",horista:2.87,mensalista:2.17,grupo:"C"},{codigo:"C5",descricao:"Indenização Adicional",horista:.46,mensalista:.35,grupo:"C"},{codigo:"D1",descricao:"Reincidência do Grupo A sobre o Grupo B",horista:8.12,mensalista:3.2,grupo:"D"},{codigo:"D2",descricao:"Reincidência do Grupo A sobre aviso prévio e FGTS",horista:.46,mensalista:.35,grupo:"D"}
];
const calcBdi=(parts:BdiPart[])=>{const p=(id:string)=>(parts.find(x=>x.id===id)?.percentual||0)/100,value=((1+p("ac")+p("sg")+p("r"))*(1+p("df"))*(1+p("l"))/(1-p("i"))-1)*100;return Math.round((value+Number.EPSILON)*100)/100};
const round2=(v:number)=>Math.round((v+Number.EPSILON)*100)/100; const lineTotal=(i:Item)=>round2(i.quantidade*i.preco);
const proposalValue=(b:Budget)=>round2(b.itens.reduce((s,i)=>s+lineTotal(i),0)*(1+b.bdi/100)*(1-b.desconto/100));
const money=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}); const num=new Intl.NumberFormat("pt-BR",{maximumFractionDigits:4});
const num3=new Intl.NumberFormat("pt-BR",{minimumFractionDigits:3,maximumFractionDigits:3});
const num4=new Intl.NumberFormat("pt-BR",{minimumFractionDigits:4,maximumFractionDigits:4});
const num8=new Intl.NumberFormat("pt-BR",{minimumFractionDigits:8,maximumFractionDigits:8});
const money4=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",minimumFractionDigits:4,maximumFractionDigits:4}); const uid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
const seed:Budget={id:"orcamento-exemplo",titulo:"Construção de 25 unidades habitacionais",cliente:"Prefeitura Municipal de Barro",municipio:"Barro / CE",modalidade:"Concorrência eletrônica",bdi:22.5,desconto:15,bdiPartes:defaultBdi,cronograma:{dias30:30,dias60:30,dias90:40},meta:{...officialMeta},atualizadoEm:"Agora",itens:[{id:"1",etapa:"1. SERVIÇOS PRELIMINARES",codigo:"C1937",descricao:"PLACAS PADRÃO DE OBRA",unidade:"m²",quantidade:12,preco:183.41,memoria:"Quantidade informada em projeto"},{id:"2",etapa:"1. SERVIÇOS PRELIMINARES",codigo:"C1630",descricao:"LOCAÇÃO DA OBRA - EXECUÇÃO DE GABARITO",unidade:"m²",quantidade:1725,preco:7.89,memoria:"Área total da implantação"}]};
const patioBudget:Budget={id:"orcamento-11402-patio-coberto",templateRevision:2,titulo:"Construção de Pátio Coberto - EEMTI Euclides Pinheiro de Andrade",cliente:"23115050 - EEMTI EUCLIDES PINHEIRO DE ANDRADE",municipio:"Milhã / CE",modalidade:"Orçamento de obra",bdi:22.07,desconto:24.99999999,bdiPartes:defaultBdi.map(x=>({...x})),cronograma:{dias30:50,dias60:50,dias90:0},cronogramaEtapas:[{nome:"PÁTIO COBERTO - CIVIL",valor:92673.27,d30:50,d60:50,d90:0},{nome:"INSTALAÇÕES ELÉTRICAS",valor:13012.58,d30:50,d60:50,d90:0}],meta:{...patioMeta},atualizadoEm:"Agora",itens:patioItems.map((x,n)=>{const composition=patioCompositions[x[1]]||officialCompositions[x[1]];return{id:`11402-${n+1}`,etapa:x[0],codigo:x[1],descricao:x[2],unidade:x[3],quantidade:x[4],preco:x[5],memoria:x[6],insumos:composition?.map((c,j)=>({id:`11402-${n+1}-${j+1}`,tipo:c[0] as InputKind,codigo:c[1],descricao:c[2],fonte:"SEINFRA CE 028.1 / documento oficial",unidade:c[3],coeficiente:c[4],preco:c[5]}))}})};
const migrate=(b:Budget):Budget=>{const official=/refeitório/i.test(b.titulo)||(b.itens?.some(i=>i.codigo==="S0030")&&b.itens?.some(i=>i.codigo==="S0194"));let memoryIndex=0;const itens=(b.itens||[]).map(i=>{const expected=officialMemory[memoryIndex++],composition=officialCompositions[i.codigo];return{...i,preco:i.codigo==="S0030"&&Math.abs(i.preco-1773.8966)<.001?1773.87:i.preco,descricao:official&&officialDescriptions[i.codigo]?officialDescriptions[i.codigo]:i.descricao.trim(),memoria:official&&expected?.[0]===i.codigo?(i.memoria||expected[1]):i.memoria,insumos:official&&composition?composition.map((x,n)=>({id:`of-${i.codigo}-${n}`,tipo:x[0] as InputKind,codigo:x[1],descricao:x[2],fonte:"SEINFRA CE 028.1",unidade:x[3],coeficiente:x[4],preco:x[5]})):i.insumos}});return{...b,bdi:official?22.07:b.bdi,bdiPartes:b.bdiPartes?.length?b.bdiPartes:defaultBdi.map(x=>({...x})),cronograma:b.cronograma||{dias30:30,dias60:30,dias90:40},cronogramaEtapas:official?(b.cronogramaEtapas?.length?b.cronogramaEtapas:officialSchedule.map(x=>({...x}))):b.cronogramaEtapas,meta:official?{...officialMeta,...b.meta}:b.meta,dadosOficiaisAplicados:official||b.dadosOficiaisAplicados,itens}};
export const catalogFallback:CatalogItem[]=[{id:"cat-c4462",etapa:"11. COBERTURA",codigo:"C4462",descricao:"TELHA CERÂMICA COLONIAL",unidade:"m²",quantidade:1,preco:75.26,fonte:"SEINFRA 028",referencia:"Com encargos",url:"https://sin.seinfra.ce.gov.br/site-seinfra/siproce/onerada/html/C4462.html",insumos:[{id:"i2045",tipo:"Material",codigo:"I2045",descricao:"Telha cerâmica colonial",fonte:"SEINFRA",unidade:"un",coeficiente:33,preco:.71},{id:"i2543",tipo:"Mão de obra",codigo:"I2543",descricao:"Servente",fonte:"SEINFRA",unidade:"h",coeficiente:1.1,preco:20.26},{id:"i2391",tipo:"Mão de obra",codigo:"I2391",descricao:"Pedreiro",fonte:"SEINFRA",unidade:"h",coeficiente:1.1,preco:26.86}]},{id:"cat-c4466",etapa:"11. COBERTURA",codigo:"C4466",descricao:"COBERTURA COM TELHA CERÂMICA - RIPA, CAIBRO E LINHA",unidade:"m²",quantidade:1,preco:188.38,fonte:"SEINFRA 028",referencia:"Com encargos"}];

patioBudget.templateRevision=3;
patioBudget.encargosSociais=defaultSocialCharges.map(x=>({...x}));
const classroomBdi:BdiPart[]=[
 {id:"ac",sigla:"AC",descricao:"Administração central",percentual:3,grupo:"custo"},{id:"i",sigla:"I",descricao:"Impostos: COFINS, PIS, CPRB e ISS",percentual:10.15,grupo:"faturamento"},{id:"l",sigla:"L",descricao:"Lucro bruto",percentual:6.16,grupo:"faturamento"},{id:"sg",sigla:"S+G",descricao:"Seguro e garantia",percentual:.8,grupo:"faturamento"},{id:"r",sigla:"R",descricao:"Risco",percentual:.97,grupo:"faturamento"},{id:"df",sigla:"DF",descricao:"Despesas financeiras",percentual:.59,grupo:"faturamento"}
];
const classroomBudget:Budget={id:"orcamento-10855-sala-aula",templateRevision:1,titulo:"Ampliação de bloco de salas para implantação de sala de aula",cliente:"23006307 - EEM LUZIA ARAÚJO BARROS",municipio:"Itarema / CE",modalidade:"Orçamento de obra",bdi:24.52,desconto:0,bdiPartes:classroomBdi,cronograma:{dias30:50,dias60:50,dias90:0},cronogramaEtapas:classroomSchedule.map(x=>({...x})),encargosSociais:defaultSocialCharges.map(x=>({...x})),meta:{...classroomMeta} as BudgetMeta,atualizadoEm:"Agora",itens:classroomItems.map((x,n)=>({id:`10855-${n+1}`,etapa:x.etapa,codigo:x.codigo,descricao:x.descricao,unidade:x.unidade,quantidade:x.quantidade,preco:x.preco,memoria:x.memoria,insumos:classroomCompositions[x.codigo]?.map((c,j)=>({id:`10855-${n+1}-${j+1}`,tipo:c[0] as InputKind,codigo:c[1],descricao:c[2],fonte:"SEINFRA CE 028.1 / documento oficial",unidade:c[3],coeficiente:c[4],preco:c[5]}))}))};
const cobertaDoloresBudget:Budget={id:"orcamento-11297-coberta-dolores",templateRevision:1,titulo:"Serviço de reforma da coberta do pátio",cliente:"23278021 - EEMTI MARIA DOLORES ALCÂNTARA E SILVA",municipio:"Horizonte / CE",modalidade:"Orçamento de obra",bdi:22.07,desconto:0,bdiPartes:defaultBdi.map(x=>({...x})),cronograma:{dias30:50,dias60:50,dias90:0},cronogramaEtapas:cobertaDoloresSchedule.map(x=>({...x})),encargosSociais:defaultSocialCharges.map(x=>({...x})),meta:{...cobertaDoloresMeta} as BudgetMeta,atualizadoEm:"Agora",itens:cobertaDoloresItems.map((x,n)=>({id:`11297-${n+1}`,etapa:x[0],codigo:x[1],descricao:x[2],unidade:x[3],quantidade:x[4],preco:x[5],memoria:x[6],insumos:cobertaDoloresCompositions[x[1]]?.map((c,j)=>({id:`11297-${n+1}-${j+1}`,tipo:c[0] as InputKind,codigo:c[1],descricao:c[2],fonte:"SEINFRA CE 028.1 / documento oficial",unidade:c[3],coeficiente:c[4],preco:c[5]}))}))};

export type BudgetRow={id:string;dados:Budget;arquivado:boolean;licitacao_id:string|null};
const TEMPLATES=()=>[cobertaDoloresBudget,classroomBudget,patioBudget];
async function persist(b:Budget,licitacaoId?:string|null){const row:Record<string,unknown>={id:b.id,titulo:b.titulo||"Sem título",cliente:b.cliente,municipio:b.municipio,valor_proposta:proposalValue(b),dados:b,arquivado:!!b.arquivadoEm,atualizado_em:new Date().toISOString()};if(licitacaoId!==undefined)row.licitacao_id=licitacaoId;const {error}=await sb().from("orcamentos").upsert(row);return !error}
function applyCompany(e:Empresa|null){if(!e)return;const m=officialMeta as Record<string,string|number>;const set=(k:string,v:string|null|undefined)=>{if(v)m[k]=v};set("empresa",e.razao_social);set("cnpj",e.cnpj);set("proprietario",e.representante_legal);set("responsavelTecnico",e.responsavel_tecnico);set("creaResponsavel",e.crea_responsavel);set("profissaoResponsavel",e.profissao_responsavel);set("endereco",[e.endereco,e.municipio&&`${e.municipio}${e.uf?`/${e.uf}`:""}`].filter(Boolean).join(" - "));set("telefone",e.telefone);set("email",e.email);set("dadosBancarios",e.dados_bancarios)}

export default function BudgetApp({rows,openId,empresa}:{rows:BudgetRow[];openId?:string|null;empresa:Empresa|null}){
 applyCompany(empresa);
 const links=useMemo(()=>new Map(rows.filter(r=>r.licitacao_id).map(r=>[r.id,r.licitacao_id as string])),[rows]);
 const [budget,setBudget]=useState(seed),[budgets,setBudgets]=useState<Budget[]>([seed]); const [view,setView]=useState<View>("orcamentos"),[section,setSection]=useState<Section>("planilha"),[query,setQuery]=useState("");
 const [settings,setSettings]=useState(false),[report,setReport]=useState(false),[newOpen,setNewOpen]=useState(false),[pdfOpen,setPdfOpen]=useState(false),[saved,setSaved]=useState("Salvo"),[hydrated,setHydrated]=useState(false),[importReview,setImportReview]=useState<ImportReview|null>(null); const [newData,setNewData]=useState({titulo:"",cliente:"",municipio:""}); const fileRef=useRef<HTMLInputElement>(null);
 useEffect(()=>{(async()=>{
  let list=rows.map(r=>migrate({...r.dados,id:r.id,arquivadoEm:r.arquivado?(r.dados.arquivadoEm||new Date().toISOString()):undefined}));
  if(!list.length){list=TEMPLATES().map(t=>migrate({...t}));await Promise.all(list.map(b=>persist(b,null)))}
  setBudgets(list);
  const first=(openId&&list.find(x=>x.id===openId))||list.find(x=>!x.arquivadoEm)||list[0];
  if(first){setBudget(first);if(openId&&first.id===openId&&!first.itens.length)setSection("dados")}
  if(!openId&&list.length>1)setView("obras");
  setHydrated(true)})()},[]); // eslint-disable-line
 useEffect(()=>{if(!hydrated)return;setSaved("Salvando…");const t=setTimeout(async()=>{const current={...budget,atualizadoEm:new Date().toLocaleString("pt-BR")};setBudgets(list=>list.some(x=>x.id===current.id)?list.map(x=>x.id===current.id?current:x):[current,...list]);const ok=await persist(current);setSaved(ok?"Salvo na nuvem":"Erro ao salvar — verifique a internet")},700);return()=>clearTimeout(t)},[budget,hydrated]);
 const direct=useMemo(()=>round2(budget.itens.reduce((s,i)=>s+lineTotal(i),0)),[budget.itens]),reference=round2(direct*(1+budget.bdi/100)),proposal=round2(reference*(1-budget.desconto/100)),saving=round2(reference-proposal);
 const visible=budget.itens.filter(i=>`${i.etapa} ${i.codigo} ${i.descricao}`.toLowerCase().includes(query.toLowerCase())); const stages=[...new Set(visible.map(i=>i.etapa))];
 const update=(id:string,key:keyof Item,value:string|number)=>setBudget(b=>({...b,itens:b.itens.map(i=>i.id===id?{...i,[key]:value}:i)}));
 const updateInput=(itemId:string,inputId:string,key:keyof InputItem,value:string|number)=>setBudget(b=>({...b,itens:b.itens.map(item=>{if(item.id!==itemId)return item;const insumos=(item.insumos||[]).map(input=>input.id===inputId?{...input,[key]:value}:input);return{...item,insumos,preco:round2(insumos.reduce((s,x)=>s+x.coeficiente*x.preco,0))}})}));
 const addInput=(itemId:string)=>setBudget(b=>({...b,itens:b.itens.map(i=>i.id===itemId?{...i,insumos:[...(i.insumos||[]),{id:uid(),tipo:"Material",codigo:"NOVO",descricao:"Novo componente",fonte:"Própria",unidade:"un",coeficiente:1,preco:0}]}:i)}));
 const removeInput=(itemId:string,inputId:string)=>setBudget(b=>({...b,itens:b.itens.map(i=>i.id===itemId?{...i,insumos:(i.insumos||[]).filter(x=>x.id!==inputId)}:i)}));
 const add=()=>setBudget(b=>({...b,itens:[...b.itens,{id:uid(),etapa:stages.at(-1)||"1. NOVA ETAPA",codigo:"PRÓPRIO",descricao:"NOVO SERVIÇO",unidade:"un",quantidade:1,preco:0,memoria:"1"}]}));
 const createBudget=(copy=false)=>{const created:Budget=migrate({id:uid(),titulo:newData.titulo.trim()||"Novo orçamento",cliente:newData.cliente.trim()||"Cliente a definir",municipio:newData.municipio.trim()||"Município / CE",modalidade:"A definir",bdi:copy?budget.bdi:22.07,desconto:copy?budget.desconto:0,bdiPartes:copy?budget.bdiPartes:defaultBdi.map(x=>({...x})),cronograma:copy?budget.cronograma:{dias30:30,dias60:30,dias90:40},cronogramaEtapas:copy?budget.cronogramaEtapas:[],meta:copy?budget.meta:{...officialMeta},itens:copy?budget.itens.map(i=>({...i,id:uid()})):[],atualizadoEm:"Agora"});setBudget(created);setBudgets(x=>[created,...x]);setNewOpen(false);setView("orcamentos");setSection("dados");setNewData({titulo:"",cliente:"",municipio:""})};
 const createFromPdfs=(data:PdfImportResult,discount:number)=>{const grouped=[...new Set(data.itens.map(i=>i.etapa))],directByStage=grouped.map(nome=>({nome,valor:data.itens.filter(i=>i.etapa===nome).reduce((s,i)=>s+round2(i.quantidade*i.preco),0),d30:data.cronograma.dias30,d60:data.cronograma.dias60,d90:data.cronograma.dias90}));const created=migrate({id:uid(),titulo:data.titulo,cliente:data.cliente,municipio:data.municipio,modalidade:data.modalidade,bdi:data.bdi,desconto:discount,bdiPartes:defaultBdi.map(x=>({...x})),cronograma:data.cronograma,cronogramaEtapas:directByStage,meta:{...officialMeta,...data.meta} as BudgetMeta,itens:data.itens.map(i=>({...i,id:uid(),insumos:i.insumos?.map(x=>({...x,id:uid()}))})),atualizadoEm:"Agora"});setBudget(created);setBudgets(x=>[created,...x]);setPdfOpen(false);setView("orcamentos");setSection("dados")};
 const storeBudgets=(updater:(list:Budget[])=>Budget[])=>setBudgets(list=>{const next=updater(list);next.filter(x=>!list.includes(x)).forEach(x=>persist(x));return next});
 const toggleArchive=(id:string)=>storeBudgets(list=>list.map(x=>x.id===id?{...x,arquivadoEm:x.arquivadoEm?undefined:new Date().toISOString(),atualizadoEm:"Agora"}:x));
 const deleteBudget=(id:string)=>{const target=budgets.find(x=>x.id===id);if(!target||!confirm(`Apagar definitivamente o orçamento “${target.titulo}”? Esta ação não pode ser desfeita.`))return;const next=budgets.filter(x=>x.id!==id);sb().from("orcamentos").delete().eq("id",id).then(()=>{});setBudgets(next);if(budget.id===id){const replacement=next.find(x=>!x.arquivadoEm)||next[0]||migrate({...seed,id:uid(),titulo:"Novo orçamento",itens:[]});setBudget(replacement);setView(next.length?"obras":"orcamentos")}};
 const confirmSheetImport=()=>{if(!importReview)return;const created=importReview.budget;setBudget(created);setBudgets(list=>[created,...list]);setImportReview(null);setView("orcamentos");setSection("dados")};
 async function importSheet(file:File){const XLSX=await import("xlsx");const book=XLSX.read(await file.arrayBuffer());const norm=(v:string)=>v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");const sheet=(name:string)=>book.SheetNames.find(x=>norm(x).includes(name));const rows=(n:string)=>{const s=sheet(n)||(n==="orcamento"?book.SheetNames[0]:undefined);return s?XLSX.utils.sheet_to_json<Record<string,unknown>>(book.Sheets[s],{defval:""}):[]};const pick=(r:Record<string,unknown>,names:string[])=>{const k=Object.keys(r).find(x=>names.some(n=>norm(x).includes(n)));return k?r[k]:""};const toN=(v:unknown)=>typeof v==="number"?v:Number(String(v).replace(/[^0-9,.-]/g,"").replace(/\.(?=.*\.)/g,"").replace(",","."))||0;const base=rows("orcamento");const itens=base.map((r,n):Item=>({id:uid(),etapa:String(pick(r,["etapa","grupo","ambiente","categoria"])||"1. SERVIÇOS IMPORTADOS"),codigo:String(pick(r,["codigo","item"])||`IMP-${n+1}`),descricao:String(pick(r,["descricao","servico","discriminacao","especificacao"])),unidade:String(pick(r,["unidade","unid"])||"un"),quantidade:toN(pick(r,["quantidade","qtd","quant"])),preco:toN(pick(r,["preco unitario","valor unitario","unitario","preco","valor"])),memoria:String(pick(r,["memoria","calculo","formula"]))})).filter(x=>x.descricao);if(!itens.length){alert("Não encontrei uma aba Orçamento com descrições de serviços.");return}for(const r of rows("compos")){const cod=String(pick(r,["codigo servico","servico","composicao"]));const target=itens.find(i=>i.codigo===cod);if(target)(target.insumos||(target.insumos=[])).push({id:uid(),tipo:(String(pick(r,["tipo","categoria"]))||"Material") as InputKind,codigo:String(pick(r,["codigo insumo","item","codigo"])),descricao:String(pick(r,["descricao"])),fonte:String(pick(r,["fonte"])||"SEINFRA"),unidade:String(pick(r,["unidade","unid"])),coeficiente:toN(pick(r,["coeficiente","coef"])),preco:toN(pick(r,["custo","preco"]))})}for(const r of rows("memoria")){const target=itens.find(i=>i.codigo===String(pick(r,["codigo","composicao"])));if(target)target.memoria=String(pick(r,["calculo","formula","memoria"]))}const parts=rows("bdi").map((r,n):BdiPart=>{const sigla=String(pick(r,["sigla"]));return{id:norm(sigla).replace(/[^a-z+]/g,"")||`b${n}`,sigla,descricao:String(pick(r,["descricao","parcela"])),percentual:toN(pick(r,["percentual","taxa"])),grupo:norm(String(pick(r,["grupo"]))).includes("custo")?"custo":"faturamento"}}).filter(x=>x.sigla);const importedMeta:Record<string,unknown>={};for(const r of rows("dados")){const campo=norm(String(pick(r,["campo"]))).replace(/[^a-z0-9]/g,"");const key=Object.keys(officialMeta).find(k=>norm(k).replace(/[^a-z0-9]/g,"")===campo);if(key)importedMeta[key]=pick(r,["valor"])}const official=itens.some(i=>i.codigo==="S0030")&&itens.some(i=>i.codigo==="S0194");const grouped=[...new Set(itens.map(i=>i.etapa))];const cronogramaEtapas=grouped.map(nome=>({nome,valor:round2(itens.filter(i=>i.etapa===nome).reduce((s,i)=>s+lineTotal(i),0)),d30:30,d60:30,d90:40}));const created=migrate({id:uid(),titulo:official?"Construção de Refeitório":file.name.replace(/\.(xlsx?|csv)$/i,""),cliente:official?officialMeta.unidadeTrabalho:"Cliente a definir",municipio:official?"Limoeiro do Norte / CE":"Município / CE",modalidade:"Orçamento de obra",bdi:official?22.07:(parts.length?calcBdi(parts):22.07),desconto:official?25:0,bdiPartes:parts.length?parts:defaultBdi.map(x=>({...x})),cronograma:{dias30:30,dias60:30,dias90:40},cronogramaEtapas,meta:{...officialMeta,...importedMeta} as BudgetMeta,itens,atualizadoEm:"Agora"});const warnings=[!rows("compos").length?"A planilha não possui aba de composições; os serviços foram importados normalmente.":"",!rows("memoria").length?"Não foi encontrada uma aba de memória de cálculo.":""].filter(Boolean);setImportReview({budget:created,fileName:file.name,warnings})}
 async function importStructuredSheet(file:File){const XLSX=await import("xlsx"),book=XLSX.read(await file.arrayBuffer()),norm=(v:unknown)=>String(v??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim(),findSheet=(...terms:string[])=>book.SheetNames.find(name=>terms.every(t=>norm(name).includes(t))),aoa=(name?:string)=>name?XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[name],{header:1,defval:"",raw:true}):[],toN=(v:unknown)=>typeof v==="number"?v:Number(String(v).replace(/[^0-9,.-]/g,"").replace(/\.(?=.*\.)/g,"").replace(",","."))||0;
  const budgetRows=aoa(findSheet("planilha","orcament"));let top="SERVIÇOS IMPORTADOS",sub="";const itens:Item[]=[];for(const row of budgetRows){const item=String(row[0]??"").trim(),code=String(row[1]??"").trim(),description=String(row[2]??"").trim();if(!description&&code&&item){if(item.split(".").length===1)top=code;else sub=code;continue}if(description&&code&&toN(row[5])>0){const memory=patioItems.find(x=>x[1]===code&&Math.abs(x[4]-toN(row[5]))<.001)?.[6]||"";itens.push({id:uid(),etapa:`${top}${sub?` / ${sub}`:""}`,codigo:code.replace(/\.$/,""),descricao:description,unidade:String(row[4]||"UN"),quantidade:toN(row[5]),preco:toN(row[6]),memoria:memory})}}
  const parseCompositions=(name?:string)=>{const result:Record<string,InputItem[]>={},rows=aoa(name);let service="",kind:InputKind="Material";for(const row of rows){const first=String(row[0]??"").replace(/[\u200b-\u200d\ufeff]/g,"").trim(),title=first.match(/(?:^|\s)([CS]\d{4})(?:\s|$)/);if(title&&norm(row[2])!=="fonte"){service=title[1];result[service] ||= [];continue}if(["material","mao de obra","equipamento","servico"].some(x=>norm(first).startsWith(x))&&norm(row[2]).includes("fonte")){kind=norm(first).startsWith("mao")?"Mão de obra":norm(first).startsWith("equip")?"Equipamento":norm(first).startsWith("serv")?"Serviço auxiliar":"Material";continue}if(service&&first&&String(row[1]??"").trim()&&toN(row[4])!==0&&!norm(row[4]).includes("total")){result[service].push({id:uid(),tipo:kind,codigo:first,descricao:String(row[1]),fonte:String(row[2]||"SEINFRA"),unidade:String(row[3]||"UN"),coeficiente:toN(row[4]),preco:toN(row[5])})}}return result};
  const mainComps=parseCompositions(findSheet("composicoes")),ownComps=parseCompositions(findSheet("composicoes","proprias")),auxComps=parseCompositions(findSheet("composicoes","auxiliares"));itens.forEach(i=>{i.insumos=ownComps[i.codigo]||mainComps[i.codigo]||i.insumos});
  const chargeRows=aoa(findSheet("encargos","sociais"));let group="";const charges:SocialCharge[]=[];for(const row of chargeRows){const code=String(row[0]??"").trim();if(["A","B","C","D"].includes(code)){group=code;continue}if(/^[A-D]\d+$/.test(code))charges.push({codigo:code,descricao:String(row[1]||""),horista:toN(row[2]),mensalista:toN(row[4]??row[3]),grupo:group})}
  const scheduleRows=aoa(findSheet("cronograma")),cronogramaEtapas:ScheduleRow[]=[];for(const row of scheduleRows){if(String(row[1]??"").trim()&&toN(row[2])>0&&toN(row[5])>0)cronogramaEtapas.push({nome:String(row[1]),valor:toN(row[2]),d30:toN(row[3])<=1?toN(row[3])*100:toN(row[3]),d60:toN(row[4])<=1?toN(row[4])*100:toN(row[4]),d90:0})}const summary=aoa(findSheet("resumo")),budgetTotal=summary.find(r=>norm(r[2]).includes("valor orcamento")),bdiTotal=summary.find(r=>norm(r[2]).includes("valor bdi total")),direct=toN(budgetTotal?.[3])||itens.reduce((s,i)=>s+lineTotal(i),0),bdiValue=toN(bdiTotal?.[3]),bdi=direct?round2(bdiValue/direct*100):22.07,cronograma={dias30:cronogramaEtapas[0]?.d30||50,dias60:cronogramaEtapas[0]?.d60||50,dias90:cronogramaEtapas[0]?.d90||0};
  if(!itens.length){alert("Não encontrei a planilha orçamentária ou suas linhas de serviços.");return}const created:Budget={id:uid(),titulo:file.name.replace(/\.xlsx?$/i,""),cliente:patioMeta.unidadeTrabalho,municipio:"Milhã / CE",modalidade:"Orçamento de obra",bdi,desconto:0,bdiPartes:defaultBdi.map(x=>({...x})),cronograma,cronogramaEtapas,encargosSociais:charges.length?charges:defaultSocialCharges.map(x=>({...x})),composicoesAuxiliares:auxComps,meta:{...patioMeta},itens,atualizadoEm:"Agora"};const warnings=[!Object.keys(auxComps).length?"Não foram encontradas composições auxiliares para abrir os quantitativos.":"",!itens.every(i=>i.insumos?.length)?`${itens.filter(i=>!i.insumos?.length).length} serviços não possuem composição detalhada na planilha.`:""].filter(Boolean);setImportReview({budget:created,fileName:file.name,warnings})}
 async function exportXlsx(){const XLSX=await import("xlsx"),wb=XLSX.utils.book_new(),meta={...officialMeta,...budget.meta};XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(Object.entries(meta).map(([Campo,Valor])=>({Campo,Valor}))),"Dados da Obra");XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(budget.itens.map((i,n)=>({Item:n+1,Etapa:i.etapa,Código:i.codigo,Descrição:i.descricao,Unidade:i.unidade,Quantidade:i.quantidade,"Preço unitário":i.preco,"Total arredondado":lineTotal(i),"Memória de cálculo":i.memoria||""}))),"Orçamento");XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(budget.itens.flatMap(i=>(i.insumos||[]).map(x=>({"Código serviço":i.codigo,Tipo:x.tipo,"Código insumo":x.codigo,Descrição:x.descricao,Fonte:x.fonte,Unidade:x.unidade,Coeficiente:x.coeficiente,Custo:x.preco,Subtotal:round2(x.coeficiente*x.preco)})))),"Composições");XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(budget.itens.map(i=>({Código:i.codigo,Descrição:i.descricao,Cálculo:i.memoria||"",Quantidade:i.quantidade}))),"Memória de Cálculo");XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(consolidatedInputs(budget)),"Quantitativos");XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(budget.encargosSociais||defaultSocialCharges),"Encargos Sociais");XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(budget.bdiPartes||defaultBdi),"BDI");XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet((budget.cronogramaEtapas||[]).map(row=>{const base=(budget.cronogramaEtapas||[]).reduce((s,x)=>s+x.valor,0),value=base?proposal*row.valor/base:0;return{Ambiente:row.nome,"Total proposto":value,"30 dias (%)":row.d30,"30 dias (R$)":value*row.d30/100,"60 dias (%)":row.d60,"60 dias (R$)":value*row.d60/100,"90 dias (%)":row.d90,"90 dias (R$)":value*row.d90/100}})),"Cronograma");for(const name of wb.SheetNames){const sheet=wb.Sheets[name],ref=sheet["!ref"];if(!ref)continue;const range=XLSX.utils.decode_range(ref),headers=new Map<number,string>();for(let c=range.s.c;c<=range.e.c;c++)headers.set(c,String(sheet[XLSX.utils.encode_cell({r:range.s.r,c})]?.v||"").toLowerCase());for(let r=range.s.r+1;r<=range.e.r;r++)for(let c=range.s.c;c<=range.e.c;c++){const cell=sheet[XLSX.utils.encode_cell({r,c})],header=headers.get(c)||"";if(!cell||cell.t!=="n")continue;if(/quantidade|coeficiente|percentual|\(%\)/.test(header))cell.z="0.000";else if(/preço|total|custo|subtotal|valor|\(r\$\)/.test(header))cell.z='R$ #,##0.0000'}}XLSX.writeFile(wb,"orcamento-completo-falcao.xlsx")}
 return <div className="app-shell">
<input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={e=>{const file=e.target.files?.[0];if(file)importStructuredSheet(file);e.currentTarget.value=""}}/>
<Sidebar extra={<><div className="nav-sep"/><div className="sub-title">ORÇAMENTOS</div>
<button className="quick-new" onClick={()=>setNewOpen(true)}>
<Plus/> Novo orçamento</button>
<button className="quick-import" onClick={()=>setPdfOpen(true)}><Upload/> Importar PDFs</button>
<nav>
<button className={view==="orcamentos"?"active":""} onClick={()=>setView("orcamentos")}>
<Calculator/> Orçamento aberto</button>
<button className={view==="obras"?"active":""} onClick={()=>setView("obras")}>
<Building2/> Todos os orçamentos</button>
<button className={view==="composicoes"?"active":""} onClick={()=>setView("composicoes")}>
<FileSpreadsheet/> Composições SEINFRA</button>
</nav></>}/>
<main>
<header>
<div>
<small>{view.toUpperCase()} <b>/</b> {view==="orcamentos"?"EM EDIÇÃO":"VISÃO GERAL"}</small>
<h1>{view==="orcamentos"?budget.titulo:view==="obras"?"Obras e orçamentos":"Composições de serviços"}</h1>
<p>{view==="orcamentos"?`${budget.cliente} • ${budget.municipio}`:view==="obras"?"Encontre e continue um orçamento":"Serviços completos com insumos e coeficientes da SEINFRA-CE"}{view==="orcamentos"&&links.get(budget.id)&&<> • <Link href={`/licitacoes/${links.get(budget.id)}`}>ver licitação</Link></>}</p>
</div>
<div className="header-actions">{view==="orcamentos"?<>
<span className="save">
<Save/>{saved}</span>
<button onClick={()=>setNewOpen(true)}>
<Plus/> Novo</button>
<button onClick={()=>setPdfOpen(true)}><Upload/> Importar PDFs</button>
<button onClick={exportXlsx}>
<Download/> Exportar completo</button>
<button className="primary" onClick={()=>setReport(true)}>
<Printer/> Gerar documentos</button>
</>:<button className="primary" onClick={()=>setNewOpen(true)}>
<Plus/> Novo orçamento</button>}</div>
</header>{view==="orcamentos"&&<>
<section className="summary">
<article>
<span>CUSTO DIRETO</span>
<strong>{money.format(direct)}</strong>
<small>Soma dos itens já arredondados</small>
</article>
<article>
<span>PREÇO DE REFERÊNCIA</span>
<strong>{money.format(reference)}</strong>
<small>Com BDI de {num.format(budget.bdi)}%</small>
</article>
<article className="accent">
<span>PROPOSTA FINAL</span>
<strong>{money.format(proposal)}</strong>
<small>Desconto de {num.format(budget.desconto)}%</small>
</article>
<button onClick={()=>setSettings(true)}>
<Settings2/>
<span>
<b>Ajustar critérios</b>
<small>BDI e desconto</small>
</span>
</button>
</section>
<nav className="document-tabs">
<button className={section==="dados"?"active":""} onClick={()=>setSection("dados")}>
<Settings2/>Dados da obra</button>
<button className={section==="resumo"?"active":""} onClick={()=>setSection("resumo")}>
<ListTree/>Resumo</button>
<button className={section==="planilha"?"active":""} onClick={()=>setSection("planilha")}>
<FileSpreadsheet/>Planilha</button>
<button className={section==="memoria"?"active":""} onClick={()=>setSection("memoria")}>
<Sigma/>Memória de cálculo</button>
<button className={section==="quantitativos"?"active":""} onClick={()=>setSection("quantitativos")}>
<Boxes/>Quantitativos</button>
<button className={section==="abc"?"active":""} onClick={()=>setSection("abc")}>
<BarChart3/>Curva ABC</button>
<button className={section==="cronograma"?"active":""} onClick={()=>setSection("cronograma")}>
<CalendarDays/>Cronograma</button>
<button className={section==="bdi"?"active":""} onClick={()=>setSection("bdi")}>
<Percent/>BDI analítico</button>
<button className={section==="encargos"?"active":""} onClick={()=>setSection("encargos")}>
<Users/>Encargos</button>
</nav>{section==="planilha"&&<section className="sheet">
<div className="toolbar">
<div className="search">
<Search/>
<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar serviço, código ou etapa…"/>
</div>
<button onClick={()=>fileRef.current?.click()}>
<Upload/> Importar planilha completa</button>
<button onClick={add}>
<Plus/> Adicionar serviço</button>
</div>
<div className="table-wrap">
<table>
<thead>
<tr>
<th>
</th>
<th>CÓDIGO</th>
<th>DESCRIÇÃO INTEGRAL</th>
<th>UN.</th>
<th>QUANTIDADE</th>
<th>PREÇO UNIT.</th>
<th>TOTAL ARRED.</th>
<th/>
</tr>
</thead>
<tbody>{stages.map(s=>
<Stage key={s} name={s} items={visible.filter(i=>i.etapa===s)} update={update} updateInput={updateInput} addInput={addInput} removeInput={removeInput} remove={id=>setBudget(b=>({...b,itens:b.itens.filter(i=>i.id!==id)}))}/>)}</tbody>
</table>
</div>
<div className="sheet-foot">
<button onClick={add}>
<Plus/> Novo serviço</button>
<div>
<span>Total da proposta</span>
<strong>{money.format(proposal)}</strong>
</div>
</div>
</section>}{section==="dados"&&<ProjectDataView budget={budget} setBudget={setBudget}/>} {section==="resumo"&&<SummaryView budget={budget}/>} {section==="memoria"&&<MemoryView budget={budget} update={update}/>} {section==="quantitativos"&&<QuantitiesView budget={budget}/>} {section==="abc"&&<AbcView budget={budget}/>} {section==="cronograma"&&<ScheduleView budget={budget} proposal={proposal} setBudget={setBudget}/>} {section==="bdi"&&<BdiView budget={budget} setBudget={setBudget}/>} {section==="encargos"&&<SocialChargesView budget={budget} setBudget={setBudget}/>}</>}{view==="obras"&&<WorksView budgets={budgets} open={b=>{setBudget(migrate(b));setView("orcamentos")}} create={()=>setNewOpen(true)} importFile={()=>fileRef.current?.click()} archive={toggleArchive} remove={deleteBudget}/>} {view==="composicoes"&&<CompositionsView items={budgets.flatMap(b=>b.itens)} addToBudget={i=>{const {fonte:_f,referencia:_r,url:_u,online:_o,...item}=i as CatalogItem;void _f;void _r;void _u;void _o;setBudget(b=>({...b,itens:[...b.itens,{...item,etapa:b.itens.at(-1)?.etapa||item.etapa,id:uid(),quantidade:1,memoria:"1"}]}));setView("orcamentos");setSection("planilha")}}/>}<footer>
<span>{empresa?.razao_social||"Falcão SH Construções Ltda"} • CNPJ {empresa?.cnpj||"08.956.178/0001-12"}</span>
<button onClick={()=>setSettings(true)}>
<HelpCircle/> Precisa de ajuda?</button>
</footer>
</main>{settings&&<Modal close={()=>setSettings(false)}>
<h2>Critérios do orçamento</h2>
<p>O total de cada serviço é arredondado para centavos antes da soma. Nenhum ajuste oculto é aplicado.</p>
<label>BDI calculado (%)<input type="number" step="0.01" value={Number(budget.bdi.toFixed(4))} onChange={e=>setBudget(b=>({...b,bdi:+e.target.value}))}/>
</label>
<label>Desconto global (%)<input type="number" step="0.01" value={budget.desconto} onChange={e=>setBudget(b=>({...b,desconto:+e.target.value}))}/>
</label>
<button className="primary wide" onClick={()=>setSettings(false)}>Aplicar e recalcular</button>
</Modal>}{newOpen&&<Modal close={()=>setNewOpen(false)}>
<h2>Novo orçamento</h2>
<p>Comece em branco ou copie toda a documentação atual.</p>
<label>Nome da obra<input value={newData.titulo} onChange={e=>setNewData(d=>({...d,titulo:e.target.value}))}/>
</label>
<label>Cliente<input value={newData.cliente} onChange={e=>setNewData(d=>({...d,cliente:e.target.value}))}/>
</label>
<label>Município<input value={newData.municipio} onChange={e=>setNewData(d=>({...d,municipio:e.target.value}))}/>
</label>
<div className="new-actions">
<button onClick={()=>createBudget(true)}>
<Copy/> Copiar completo</button>
<button className="primary" onClick={()=>createBudget(false)}>
<Plus/> Criar em branco</button>
</div>
</Modal>}{importReview&&<Modal close={()=>setImportReview(null)}>
<div className="modal-heading"><div className="modal-icon"><FileSpreadsheet/></div><div><h2>Revisar planilha importada</h2><p>{importReview.fileName}</p></div></div>
<div className="import-review-grid"><span><small>SERVIÇOS</small><b>{importReview.budget.itens.length}</b></span><span><small>ETAPAS</small><b>{new Set(importReview.budget.itens.map(x=>x.etapa)).size}</b></span><span><small>COMPOSIÇÕES</small><b>{importReview.budget.itens.filter(x=>x.insumos?.length).length}</b></span><span><small>VALOR DIRETO</small><b>{money.format(importReview.budget.itens.reduce((s,x)=>s+lineTotal(x),0))}</b></span></div>
<div className="import-found"><CheckCircle2/><div><b>Informações reconhecidas</b><span>Códigos, descrições, etapas, unidades, quantidades, preços, memória, BDI e composições disponíveis.</span></div></div>
{importReview.warnings.map(x=><div className="import-warning" key={x}>{x}</div>)}
<div className="new-actions"><button onClick={()=>setImportReview(null)}>Cancelar</button><button className="primary" onClick={confirmSheetImport}><CheckCircle2/> Criar orçamento organizado</button></div>
</Modal>}{pdfOpen&&<PdfImporter close={()=>setPdfOpen(false)} onImport={createFromPdfs}/>} {report&&<div className="report-overlay">
<div className="report-bar">
<button onClick={()=>setReport(false)}>
<X/> Voltar</button>
<span>Documentação completa</span>
<button className="primary" onClick={()=>window.print()}>
<Printer/> Imprimir / salvar PDF</button>
</div>
<Report budget={budget} direct={direct} reference={reference} proposal={proposal}/>
</div>}<MobileTabs/></div>
}

const inputKinds:InputKind[]=["Equipamento","Material","Mão de obra","Serviço auxiliar"];
function Stage({name,items,update,updateInput,addInput,removeInput,remove}:{name:string;items:Item[];update:(id:string,k:keyof Item,v:string|number)=>void;updateInput:(a:string,b:string,k:keyof InputItem,v:string|number)=>void;addInput:(id:string)=>void;removeInput:(a:string,b:string)=>void;remove:(id:string)=>void}){const [expanded,setExpanded]=useState<string[]>([]);const toggle=(id:string)=>setExpanded(x=>x.includes(id)?x.filter(y=>y!==id):[...x,id]);return <>
<tr className="stage">
<td colSpan={5}>
<ChevronDown/> {name}<span>{items.length} itens</span>
</td>
<td colSpan={2}>{money.format(items.reduce((s,i)=>s+lineTotal(i),0))}</td>
<td/>
</tr>{items.map(i=>
<Fragment key={i.id}>
<tr>
<td className="drag">
<button className={`expand-service ${expanded.includes(i.id)?"open":""}`} onClick={()=>toggle(i.id)}>
<ChevronDown/>
</button>
</td>
<td>
<input value={i.codigo} onChange={e=>update(i.id,"codigo",e.target.value)}/>
</td>
<td>
<textarea className="description" value={i.descricao} onChange={e=>update(i.id,"descricao",e.target.value)}/>
<div className="item-badges">
<button onClick={()=>toggle(i.id)}>{i.insumos?.length||0} componentes</button>{i.memoria&&<span>memória cadastrada</span>}</div>
</td>
<td>
<input value={i.unidade} onChange={e=>update(i.id,"unidade",e.target.value)}/>
</td>
<td>
<input type="number" value={i.quantidade} onChange={e=>update(i.id,"quantidade",+e.target.value)}/>
</td>
<td>
<div className="money-input">
<span>R$</span>
<input type="number" step=".0001" value={i.preco} onChange={e=>update(i.id,"preco",+e.target.value)}/>
</div>
</td>
<td>
<b>{money.format(lineTotal(i))}</b>
</td>
<td>
<button className="icon" onClick={()=>remove(i.id)}>
<Trash2/>
</button>
</td>
</tr>{expanded.includes(i.id)&&<tr className="composition-detail">
<td colSpan={8}>
<AnalyticalComposition item={i} update={update} updateInput={updateInput} addInput={addInput} removeInput={removeInput}/>
</td>
</tr>}</Fragment>)}</>}
function AnalyticalComposition({item,update,updateInput,addInput,removeInput,print=false}:{item:Item;update?:(id:string,k:keyof Item,v:string|number)=>void;updateInput?:(a:string,b:string,k:keyof InputItem,v:string|number)=>void;addInput?:(id:string)=>void;removeInput?:(a:string,b:string)=>void;print?:boolean}){const inputs=item.insumos||[];return <section className={print?"analytic-report":"detail-shell analytic-card"}>
<header>
<div>
<small>SERVIÇO {item.codigo}</small>
<h3>{item.descricao}</h3>
</div>
<dl>
<div>
<dt>Unidade</dt>
<dd>{item.unidade}</dd>
</div>
<div>
<dt>Quantidade</dt>
<dd>{print?num3.format(item.quantidade):num.format(item.quantidade)}</dd>
</div>
<div>
<dt>Preço unitário</dt>
<dd>{print?money4.format(item.preco):money.format(item.preco)}</dd>
</div>
</dl>{!print&&<button onClick={()=>addInput?.(item.id)}>
<Plus/> Adicionar componente</button>}</header>{!print&&<label className="memory-inline">Memória de cálculo<input value={item.memoria||""} placeholder="Ex.: 12,3 × 9,9 × 1,015" onChange={e=>update?.(item.id,"memoria",e.target.value)}/>
</label>}{inputKinds.map(kind=>{const group=inputs.filter(x=>x.tipo===kind);if(!group.length)return null;const subtotal=round2(group.reduce((s,x)=>s+x.coeficiente*x.preco,0));return <section className="analytic-group" key={kind}>
<h4>{kind}</h4>
<table>
<thead>
<tr>
<th>CÓDIGO</th>
<th>DESCRIÇÃO DO COMPONENTE</th>
<th>FONTE</th>
<th>UNID.</th>
<th>COEFICIENTE</th>
<th>PREÇO UNITÁRIO</th>
<th>TOTAL</th>{!print&&<th/>}</tr>
</thead>
<tbody>{group.map(x=>
<tr key={x.id}>
<td>{print?x.codigo:<input value={x.codigo} onChange={e=>updateInput?.(item.id,x.id,"codigo",e.target.value)}/>}</td>
<td>{print?x.descricao:<input value={x.descricao} onChange={e=>updateInput?.(item.id,x.id,"descricao",e.target.value)}/>}</td>
<td>{print?x.fonte:<input value={x.fonte} onChange={e=>updateInput?.(item.id,x.id,"fonte",e.target.value)}/>}</td>
<td>{print?x.unidade:<input value={x.unidade} onChange={e=>updateInput?.(item.id,x.id,"unidade",e.target.value)}/>}</td>
<td>{print?num3.format(x.coeficiente):<input type="number" step=".0001" value={x.coeficiente} onChange={e=>updateInput?.(item.id,x.id,"coeficiente",+e.target.value)}/>}</td>
<td>{print?money4.format(x.preco):<input type="number" step=".01" value={x.preco} onChange={e=>updateInput?.(item.id,x.id,"preco",+e.target.value)}/>}</td>
<td>
<b>{print?money4.format(round2(x.coeficiente*x.preco)):money.format(round2(x.coeficiente*x.preco))}</b>
</td>{!print&&<td>
<button className="icon" onClick={()=>removeInput?.(item.id,x.id)}>
<Trash2/>
</button>
</td>}</tr>)}</tbody>
</table>
<div className="group-total">
<span>TOTAL {kind.toUpperCase()}</span>
<b>{print?money4.format(subtotal):money.format(subtotal)}</b>
</div>
</section>})}<footer>
<span>VALOR DA COMPOSIÇÃO</span>
<strong>{print?money4.format(round2(inputs.reduce((s,x)=>s+x.coeficiente*x.preco,0))):money.format(round2(inputs.reduce((s,x)=>s+x.coeficiente*x.preco,0)))}</strong>
</footer>
</section>}
function SummaryView({budget}:{budget:Budget}){
 const discount=1-budget.desconto/100;
 const groupNames=[...new Set(budget.itens.map(i=>i.etapa.split("/")[0].trim()))];
 const groups=groupNames.map(nome=>({nome,valor:round2(budget.itens.filter(i=>i.etapa.split("/")[0].trim()===nome).reduce((s,i)=>s+lineTotal(i),0)*discount)}));
 const direct=round2(groups.reduce((s,x)=>s+x.valor,0)),bdi=round2(direct*budget.bdi/100),total=round2(direct+bdi);
 return <section className="doc-card"><DocHead label="RESUMO DO ORÇAMENTO" title="Totais por grupo principal" text="Atualizado automaticamente conforme serviços, desconto e BDI." icon={<ListTree/>}/><div className="data-table"><table><thead><tr><th>ITEM</th><th>GRUPO</th><th>VALOR</th><th>% DO CUSTO</th></tr></thead><tbody>{groups.map((x,n)=><tr key={x.nome}><td>{n+1}</td><td><b>{x.nome}</b></td><td>{money4.format(x.valor)}</td><td>{num4.format(direct?x.valor/direct*100:0)}%</td></tr>)}<tr className="total-row"><td/><td>Benefícios e Despesas Indiretas (BDI)</td><td>{money4.format(bdi)}</td><td>{num4.format(budget.bdi)}%</td></tr><tr className="grand-row"><td/><td>VALOR TOTAL</td><td>{money4.format(total)}</td><td>100%</td></tr></tbody></table></div></section>
}

function consolidatedInputs(budget:Budget){const out=new Map<string,{codigo:string;descricao:string;unidade:string;quantidade:number;tipo:string}>(),aux=budget.composicoesAuxiliares||{};const add=(input:InputItem,mult:number,trail:Set<string>)=>{if(input.tipo==="Serviço auxiliar"&&aux[input.codigo]&&!trail.has(input.codigo)){const next=new Set(trail).add(input.codigo);aux[input.codigo].forEach(child=>add(child,mult*input.coeficiente,next));return}const key=`${input.codigo}|${input.unidade}`,old=out.get(key);if(old)old.quantidade+=mult*input.coeficiente;else out.set(key,{codigo:input.codigo,descricao:input.descricao,unidade:input.unidade,quantidade:mult*input.coeficiente,tipo:input.tipo})};budget.itens.forEach(item=>(item.insumos||[]).forEach(input=>add(input,item.quantidade,new Set([item.codigo]))));return [...out.values()].sort((a,b)=>a.tipo.localeCompare(b.tipo)||a.descricao.localeCompare(b.descricao))}
function QuantitiesView({budget}:{budget:Budget}){const rows=consolidatedInputs(budget),groups=[...new Set(rows.map(x=>x.tipo))];return <section className="doc-card"><DocHead label="QUANTITATIVOS" title="Consumo consolidado de insumos" text="Quantidade do serviço × coeficiente, com abertura automática das composições auxiliares importadas." icon={<Boxes/>}/>{!rows.length?<div className="empty-panel">Adicione composições aos serviços para gerar os quantitativos.</div>:<div className="data-table"><table><thead><tr><th>TIPO</th><th>CÓDIGO</th><th>DESCRIÇÃO</th><th>UN.</th><th>QUANTIDADE TOTAL</th></tr></thead><tbody>{groups.flatMap(group=>[<tr className="group-row" key={`g-${group}`}><td colSpan={5}>{group}</td></tr>,...rows.filter(x=>x.tipo===group).map(x=><tr key={`${x.codigo}-${x.unidade}`}><td>{x.tipo}</td><td><b>{x.codigo}</b></td><td>{x.descricao}</td><td>{x.unidade}</td><td>{num4.format(x.quantidade)}</td></tr>)])}</tbody></table></div>}</section>}

function AbcView({budget}:{budget:Budget}){const discount=1-budget.desconto/100,total=budget.itens.reduce((s,i)=>s+lineTotal(i)*discount,0),sorted=[...budget.itens].map(i=>({...i,total:lineTotal(i)*discount})).sort((a,b)=>b.total-a.total);let cumulative=0;const rows=sorted.map(i=>{const percent=total?i.total/total*100:0;cumulative+=percent;return{...i,percent,cumulative,classe:cumulative<=50?"A":cumulative<=80?"B":"C"}});return <section className="doc-card"><DocHead label="CURVA ABC DE SERVIÇOS" title="Impacto financeiro por serviço" text="Ordenação, participação, acumulado e classe recalculados a cada alteração." icon={<BarChart3/>}/><div className="abc-legend"><span><b>A</b> até 50%</span><span><b>B</b> até 80%</span><span><b>C</b> restante</span></div><div className="data-table"><table><thead><tr><th>CÓDIGO</th><th>DESCRIÇÃO</th><th>UN.</th><th>QUANT.</th><th>PREÇO UNIT.</th><th>TOTAL</th><th>%</th><th>ACUM.</th><th>CL.</th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td><b>{x.codigo}</b></td><td>{x.descricao}</td><td>{x.unidade}</td><td>{num3.format(x.quantidade)}</td><td>{money4.format(x.preco*discount)}</td><td>{money4.format(x.total)}</td><td>{num4.format(x.percent)}%</td><td>{num4.format(x.cumulative)}%</td><td><strong className={`abc-class abc-${x.classe.toLowerCase()}`}>{x.classe}</strong></td></tr>)}</tbody></table></div></section>}

function SocialChargesView({budget,setBudget}:{budget:Budget;setBudget:React.Dispatch<React.SetStateAction<Budget>>}){const rows=budget.encargosSociais?.length?budget.encargosSociais:defaultSocialCharges,groups=[...new Set(rows.map(x=>x.grupo))],change=(code:string,key:"horista"|"mensalista",value:number)=>setBudget(b=>({...b,encargosSociais:rows.map(x=>x.codigo===code?{...x,[key]:value}:x)}));return <section className="doc-card"><DocHead label="ENCARGOS SOCIAIS" title="Tabela horista e mensalista" text="Percentuais editáveis e totais calculados automaticamente por grupo." icon={<Users/>}/><div className="data-table social-table"><table><thead><tr><th>CÓD.</th><th>DESCRIÇÃO</th><th>HORISTA</th><th>MENSALISTA</th></tr></thead><tbody>{groups.flatMap(group=>{const groupRows=rows.filter(x=>x.grupo===group);return[<tr className="group-row" key={`g-${group}`}><td>{group}</td><td colSpan={3}>GRUPO {group}</td></tr>,...groupRows.map(x=><tr key={x.codigo}><td><b>{x.codigo}</b></td><td>{x.descricao}</td><td><input type="number" step=".01" value={x.horista} onChange={e=>change(x.codigo,"horista",+e.target.value)}/>%</td><td><input type="number" step=".01" value={x.mensalista} onChange={e=>change(x.codigo,"mensalista",+e.target.value)}/>%</td></tr>),<tr className="total-row" key={`t-${group}`}><td/><td>TOTAL DO GRUPO {group}</td><td>{num4.format(groupRows.reduce((s,x)=>s+x.horista,0))}%</td><td>{num4.format(groupRows.reduce((s,x)=>s+x.mensalista,0))}%</td></tr>]})}<tr className="grand-row"><td/><td>TOTAL GERAL</td><td>{num4.format(rows.reduce((s,x)=>s+x.horista,0))}%</td><td>{num4.format(rows.reduce((s,x)=>s+x.mensalista,0))}%</td></tr></tbody></table></div></section>}

function ProjectDataView({budget,setBudget}:{budget:Budget;setBudget:React.Dispatch<React.SetStateAction<Budget>>}){const meta={...officialMeta,...budget.meta};const setMeta=(key:keyof BudgetMeta,value:string|number)=>setBudget(b=>({...b,meta:{...officialMeta,...b.meta,[key]:value}}));const pending=[!meta.responsavelTecnico&&"Responsável técnico",!meta.creaResponsavel&&"CREA do responsável",!meta.endereco&&"Endereço da empresa",!meta.telefone&&"Telefone",!meta.email&&"E-mail",!meta.dadosBancarios&&"Dados bancários",!budget.itens.find(i=>i.codigo==="C4377")?.memoria&&"Fórmula do item C4377"].filter(Boolean);return <section className="doc-card project-data"><DocHead label="IDENTIFICAÇÃO E RESPONSABILIDADE" title="Dados oficiais da obra e da proposta" text="Fernando Falcão é o proprietário. O responsável técnico é cadastrado separadamente." icon={<Settings2/>}/><div className={`audit-banner ${pending.length?"warn":"ok"}`}><CheckCircle2/><div><b>{pending.length?`${pending.length} pendências antes da emissão oficial`:"Cadastro pronto para emissão"}</b><span>{pending.length?pending.join(" • "):"Todos os campos essenciais foram preenchidos."}</span></div></div><div className="project-form"><h3>Obra</h3><label>Nº do orçamento<input value={meta.numero} onChange={e=>setMeta("numero",e.target.value)}/></label><label>Nº do processo<input value={meta.processo} onChange={e=>setMeta("processo",e.target.value)}/></label><label>Data-base<input value={meta.dataBase} onChange={e=>setMeta("dataBase",e.target.value)}/></label><label>Prazo (dias)<input type="number" value={meta.prazo} onChange={e=>setMeta("prazo",+e.target.value)}/></label><label className="span-2">Tabela de referência<input value={meta.tabela} onChange={e=>setMeta("tabela",e.target.value)}/></label><label className="span-2">Unidade de trabalho<input value={meta.unidadeTrabalho} onChange={e=>setMeta("unidadeTrabalho",e.target.value)}/></label><label>CREDE/SEFOR<input value={meta.crede} onChange={e=>setMeta("crede",e.target.value)}/></label><label>Código do serviço<input value={meta.codigoServico} onChange={e=>setMeta("codigoServico",e.target.value)}/></label><h3>Empresa e proprietário</h3><label>Empresa<input value={meta.empresa} onChange={e=>setMeta("empresa",e.target.value)}/></label><label>CNPJ<input value={meta.cnpj} onChange={e=>setMeta("cnpj",e.target.value)}/></label><label>Proprietário / representante<input value={meta.proprietario} onChange={e=>setMeta("proprietario",e.target.value)}/></label><label>Validade da proposta (dias)<input type="number" value={meta.validadeProposta} onChange={e=>setMeta("validadeProposta",+e.target.value)}/></label><label className="span-2">Endereço<input value={meta.endereco} onChange={e=>setMeta("endereco",e.target.value)}/></label><label>Telefone<input value={meta.telefone} onChange={e=>setMeta("telefone",e.target.value)}/></label><label>E-mail<input value={meta.email} onChange={e=>setMeta("email",e.target.value)}/></label><label className="span-2">Dados bancários<input value={meta.dadosBancarios} onChange={e=>setMeta("dadosBancarios",e.target.value)}/></label><h3>Responsável técnico</h3><label>Nome do engenheiro<input value={meta.responsavelTecnico} placeholder="Preencher quando definido" onChange={e=>setMeta("responsavelTecnico",e.target.value)}/></label><label>CREA<input value={meta.creaResponsavel} placeholder="CREA-CE..." onChange={e=>setMeta("creaResponsavel",e.target.value)}/></label><label className="span-2">Profissão / atribuição<input value={meta.profissaoResponsavel} onChange={e=>setMeta("profissaoResponsavel",e.target.value)}/></label></div></section>}
function MemoryView({budget,update}:{budget:Budget;update:(id:string,k:keyof Item,v:string|number)=>void}){return <section className="doc-card">
<DocHead label="MEMÓRIA DE CÁLCULO" title="Fórmulas ligadas a cada serviço" text="Registre dimensões e operações; a quantidade conferida permanece ao lado." icon={<Sigma/>}/>
<div className="memory-list">{budget.itens.map((i,n)=>
<article key={i.id}>
<span>{n+1}</span>
<div>
<b>{i.codigo}</b>
<strong>{i.descricao}</strong>
</div>
<input value={i.memoria||""} placeholder="Digite a fórmula de medição" onChange={e=>update(i.id,"memoria",e.target.value)}/>
<em>{num.format(i.quantidade)} {i.unidade}</em>
</article>)}</div>
</section>}
function ScheduleView({budget,proposal,setBudget}:{budget:Budget;proposal:number;setBudget:React.Dispatch<React.SetStateAction<Budget>>}){const c=budget.cronograma||{dias30:30,dias60:30,dias90:40},total=c.dias30+c.dias60+c.dias90;return <section className="doc-card">
<DocHead label="CRONOGRAMA FÍSICO-FINANCEIRO" title="Execução em 30, 60 e 90 dias" text="A soma deve fechar em 100%." icon={<CalendarDays/>}/>
<div className="schedule-grid">{([30,60,90] as const).map(d=>{const k=`dias${d}` as keyof Schedule;return <article key={d}>
<span>{d} DIAS</span>
<input type="number" value={c[k]} onChange={e=>setBudget(b=>({...b,cronograma:{...(b.cronograma||c),[k]:+e.target.value}}))}/>
<b>{money.format(proposal*c[k]/100)}</b>
<div>
<i style={{width:`${Math.min(100,c[k])}%`}}/>
</div>
</article>})}</div>
<div className={`schedule-total ${Math.abs(total-100)<.001?"ok":"warn"}`}>
<CheckCircle2/>
<span>Total distribuído</span>
<b>{num.format(total)}%</b>
</div>
<div className="stage-schedule detailed-schedule">
<h3>Distribuição por ambiente — proposta com desconto</h3>{(budget.cronogramaEtapas||[]).map(row=>{const base=(budget.cronogramaEtapas||[]).reduce((s,x)=>s+x.valor,0),value=base?proposal*row.valor/base:0;return <div className="schedule-row" key={row.nome}>
<span>{row.nome}</span><b>{money.format(value)}</b><em>{num.format(base?row.valor/base*100:0)}%</em><small>{money.format(value*row.d30/100)}<i>{row.d30}%</i></small><small>{money.format(value*row.d60/100)}<i>{row.d60}%</i></small><small>{money.format(value*row.d90/100)}<i>{row.d90}%</i></small>
</div>})}</div>
</section>}
function BdiView({budget,setBudget}:{budget:Budget;setBudget:React.Dispatch<React.SetStateAction<Budget>>}){const parts=budget.bdiPartes||defaultBdi,calculated=calcBdi(parts);const change=(id:string,v:number)=>{const next=parts.map(x=>x.id===id?{...x,percentual:v}:x);setBudget(b=>({...b,bdiPartes:next,bdi:calcBdi(next)}))};return <section className="doc-card">
<DocHead label="COMPOSIÇÃO ANALÍTICA DO BDI" title="Parcelas e fórmula auditável" text="Edite uma taxa e o BDI é recalculado automaticamente." icon={<Percent/>}/>
<div className="bdi-formula">BDI = [(1+AC) × (1+S+G+R) × (1+DF) × (1+L) ÷ (1-I)] − 1</div>
<div className="bdi-list">{parts.map(x=>
<label key={x.id}>
<span>
<b>{x.sigla}</b>{x.descricao}<small>{x.grupo==="custo"?"Incide sobre o custo":"Incide sobre o faturamento"}</small>
</span>
<input type="number" step=".01" value={x.percentual} onChange={e=>change(x.id,+e.target.value)}/>
<em>%</em>
</label>)}</div>
<div className="bdi-tax-detail"><b>Detalhamento dos impostos (I = {num4.format(parts.find(x=>x.id==="i")?.percentual||0)}%)</b><span>COFINS <strong>3,00%</strong></span><span>PIS <strong>0,65%</strong></span><span>CPRB <strong>{num4.format(Math.max(0,(parts.find(x=>x.id==="i")?.percentual||0)-5.65))}%</strong></span><span>ISS sobre 40% da obra <strong>2,00%</strong></span><small>Referência: Acórdão TCU AC 2622-37/13</small></div>
<div className="bdi-result">
<span>BDI calculado</span>
<strong>{num.format(calculated)}%</strong>
<small>Aplicado automaticamente</small>
</div>
</section>}
function DocHead({label,title,text,icon}:{label:string;title:string;text:string;icon:React.ReactNode}){return <div className="doc-head">
<div>
<small>{label}</small>
<h2>{title}</h2>
<p>{text}</p>
</div>{icon}</div>}
function WorksView({budgets,open,create,importFile,archive,remove}:{budgets:Budget[];open:(b:Budget)=>void;create:()=>void;importFile:()=>void;archive:(id:string)=>void;remove:(id:string)=>void}){const [search,setSearch]=useState(""),[scope,setScope]=useState<"ativos"|"arquivados"|"todos">("ativos"),[sort,setSort]=useState<"recentes"|"nome"|"valor">("recentes");const filtered=budgets.filter(b=>(scope==="todos"||(scope==="arquivados"?!!b.arquivadoEm:!b.arquivadoEm))&&`${b.titulo} ${b.cliente} ${b.municipio}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>sort==="nome"?a.titulo.localeCompare(b.titulo):sort==="valor"?proposalValue(b)-proposalValue(a):0);return <section className="workspace-view">
<div className="view-stats"><article><Building2/><span><small>ATIVOS</small><strong>{budgets.filter(x=>!x.arquivadoEm).length}</strong><em>orçamentos em andamento</em></span></article><article><Archive/><span><small>ARQUIVADOS</small><strong>{budgets.filter(x=>x.arquivadoEm).length}</strong><em>guardados sem poluir a lista</em></span></article><article><FileSpreadsheet/><span><small>SERVIÇOS CADASTRADOS</small><strong>{budgets.reduce((s,x)=>s+x.itens.length,0)}</strong><em>somando todos os orçamentos</em></span></article></div>
<div className="view-card">
<div className="view-card-head">
<div>
<h2>Organizar orçamentos</h2>
<p>Pesquise, arquive, restaure ou apague sem perder a organização.</p>
</div>
<div className="works-head-actions"><button onClick={importFile}><Upload/> Ler Excel</button><button className="primary" onClick={create}><Plus/> Criar orçamento</button></div>
</div>
<div className="works-filters"><div className="search"><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar obra, cliente ou município…"/></div><div className="scope-tabs">{(["ativos","arquivados","todos"] as const).map(x=><button key={x} className={scope===x?"active":""} onClick={()=>setScope(x)}>{x}</button>)}</div><select value={sort} onChange={e=>setSort(e.target.value as typeof sort)}><option value="recentes">Mais recentes</option><option value="nome">Nome A-Z</option><option value="valor">Maior valor</option></select></div>
<div className="budget-list">{filtered.map(b=>
<article key={b.id} className={b.arquivadoEm?"archived":""}>
<button className="budget-open" onClick={()=>open(b)}>
<div className="list-icon">
<Building2/>
</div>
<span>
<strong>{b.titulo}</strong>
<small>{b.cliente} • {b.municipio}</small>
</span>
<em>{b.itens.length} serviços</em>
<b>{money.format(proposalValue(b))}</b>
<i>Continuar →</i>
</button><div className="budget-actions"><button title={b.arquivadoEm?"Restaurar orçamento":"Arquivar orçamento"} onClick={()=>archive(b.id)}>{b.arquivadoEm?<ArchiveRestore/>:<Archive/>}<span>{b.arquivadoEm?"Restaurar":"Arquivar"}</span></button><button className="danger" title="Apagar orçamento" onClick={()=>remove(b.id)}><Trash2/><span>Apagar</span></button></div></article>)}{!filtered.length&&<div className="empty-budgets"><Archive/><b>Nenhum orçamento encontrado</b><span>Altere os filtros ou crie um novo orçamento.</span></div>}</div>
</div>
</section>}
function CompositionsView({items,addToBudget}:{items:Item[];addToBudget:(i:Item)=>void}){
 const [search,setSearch]=useState(""),[online,setOnline]=useState<CatalogItem[]>([]),[notice,setNotice]=useState(""),[grupo,setGrupo]=useState("11"),[regime,setRegime]=useState<"desonerada"|"onerada">("desonerada"),[grupos,setGrupos]=useState<{id:number;nome:string}[]>([]),[loading,setLoading]=useState(false),[adding,setAdding]=useState("");
 useEffect(()=>{fetch("/api/seinfra/catalogo").then(r=>r.json()).then(d=>setGrupos(d.grupos||[])).catch(()=>{})},[]);
 const load=async()=>{setLoading(true);setNotice("Consultando a SEINFRA…");try{const r=await fetch(`/api/seinfra/catalogo?grupo=${grupo}&regime=${regime}`);const d=await r.json() as {itens?:CatalogItem[];versao?:string;erro?:string};if(d.erro)throw new Error(d.erro);setOnline(d.itens||[]);setNotice(`${d.versao} • consultado agora`)}catch(e){setOnline([]);setNotice(e instanceof Error?e.message:"SEINFRA indisponível no momento")}finally{setLoading(false)}};
 useEffect(()=>{load()},[grupo,regime]); // eslint-disable-line
 const addComplete=async(i:CatalogItem)=>{if(!i.online||i.insumos?.length){addToBudget(i);return}setAdding(i.id);try{const r=await fetch(`/api/seinfra/composicao?code=${i.codigo}&regime=${regime}`);const d=await r.json() as {insumos?:InputItem[]};addToBudget({...i,etapa:i.etapa.toUpperCase(),insumos:(d.insumos||[]).map(x=>({...x,id:uid()}))})}catch{addToBudget(i)}finally{setAdding("")}};
 const own:CatalogItem[]=items.map(i=>({...i,fonte:"Própria",referencia:"Último valor utilizado"}));const seen=new Set<string>();
 const results=[...online,...own].filter(i=>`${i.codigo} ${i.descricao} ${i.etapa}`.toLowerCase().includes(search.toLowerCase())).filter(i=>{const k=`${i.fonte}-${i.codigo}-${i.preco}`;if(seen.has(k))return false;seen.add(k);return true});
 return <section className="workspace-view">
<div className="composition-banner">
<div>
<small>TABELA SEINFRA-CE</small>
<h2>Escolha o grupo e adicione o serviço completo</h2>
<p>O serviço entra no orçamento com insumos e coeficientes, pronto para revisão.</p>
</div>
<Wifi/>
</div>
<div className="view-card">
<div className="catalog-search" style={{gridTemplateColumns:"minmax(0,1fr) minmax(0,260px) 190px auto"}}>
<div className="search">
<Search/>
<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar por código ou descrição…"/>
</div>
<select value={grupo} onChange={e=>setGrupo(e.target.value)} style={{border:"1px solid var(--line)",borderRadius:9,padding:"0 10px",minHeight:42}}>{grupos.map(g=><option key={g.id} value={g.id}>{g.id}. {g.nome}</option>)}</select>
<select value={regime} onChange={e=>setRegime(e.target.value as "desonerada"|"onerada")} style={{border:"1px solid var(--line)",borderRadius:9,padding:"0 10px",minHeight:42}} title="Desonerada = 028.1 (encargos 84,44%) • Onerada = 028 (encargos 114,15%)"><option value="desonerada">Desonerada (028.1)</option><option value="onerada">Onerada (028)</option></select>
<button className="refresh-catalog" onClick={load} disabled={loading}>
<RefreshCw className={loading?"spin":""}/> Atualizar</button>
</div>
<div className="catalog-status">
<span>{results.length} resultados</span>
<small>{notice}</small>
</div>
<div className="composition-list">{results.slice(0,300).map(i=>
<article key={`${i.id}-${i.codigo}-${i.fonte}`}>
<span className="code">{i.codigo}</span>
<div>
<strong>{i.descricao}</strong>
<small>{i.etapa} • {i.fonte}{i.insumos?.length?` • ${i.insumos.length} componentes`:""}</small>
</div>
<b>{money.format(i.preco)}</b>
<div className="catalog-actions">{i.url&&<a href={i.url} target="_blank" rel="noreferrer">
<ExternalLink/>
</a>}<button onClick={()=>addComplete(i)} disabled={adding===i.id}>
{adding===i.id?<RefreshCw className="spin"/>:<Plus/>} Adicionar completo</button>
</div>
</article>)}</div>
</div>
</section>}
function Modal({children,close}:{children:React.ReactNode;close:()=>void}){return <div className="modal-bg" onMouseDown={close}>
<div className="modal" onMouseDown={e=>e.stopPropagation()}>
<button className="modal-x" onClick={close}>
<X/>
</button>{children}</div>
</div>}
function chunks<T>(items:T[],size:number){return Array.from({length:Math.ceil(items.length/size)},(_,n)=>items.slice(n*size,(n+1)*size))}
function ReportHeader({budget,title}:{budget:Budget;title:string}){return <>
<header className="report-letterhead">
<div className="report-logo">
<b>FALCÃO</b>
<span>SH CONSTRUÇÕES</span>
</div>
<div className="report-heading">
<strong>{title}</strong>
<dl>
<div>
<dt>OBRA</dt>
<dd>{budget.titulo}</dd>
</div>
<div>
<dt>CLIENTE</dt>
<dd>{budget.cliente}</dd>
</div>
<div>
<dt>LOCAL</dt>
<dd>{budget.municipio}</dd>
</div>
</dl>
</div>
<div className="report-meta">
<span>
<b>ORÇAMENTO</b>{budget.meta?.numero||"—"}</span>
<span>
<b>DATA-BASE</b>{budget.meta?.dataBase||new Date().toLocaleDateString("pt-BR")}</span>
<span>
<b>PRAZO</b>{budget.meta?.prazo||90} dias</span>
<span><b>BDI</b>{num4.format(budget.bdi)}%</span>
<span><b>DESCONTO</b>{num8.format(budget.desconto)}%</span>
</div>
</header>
</>}
function ReportFooter({budget,page,total}:{budget:Budget;page:number;total:number}){const m={...officialMeta,...budget.meta};return <footer className="report-page-footer">
<span><b>{m.proprietario.toUpperCase()}</b> • Proprietário / representante</span>
<span><b>{m.responsavelTecnico?.toUpperCase()||"RESPONSÁVEL TÉCNICO A PREENCHER"}</b>{m.creaResponsavel?` • ${m.creaResponsavel}`:""}</span>
<span>Página: {page} de {total}</span>
</footer>}
function ReportPage({budget,title,page,total,children,className=""}:{budget:Budget;title:string;page:number;total:number;children:React.ReactNode;className?:string}){return <section className={`report-page ${className}`}>
<ReportHeader budget={budget} title={title}/>
<div className="report-project-strip"><span><b>PROCESSO</b>{budget.meta?.processo||"—"}</span><span><b>TABELA</b>{budget.meta?.tabela||"—"}</span><span><b>UNIDADE</b>{budget.meta?.unidadeTrabalho||"—"}</span></div>
<main className="report-page-body">{children}</main>
<ReportFooter budget={budget} page={page} total={total}/>
</section>}
function Report({budget,direct,reference,proposal}:{budget:Budget;direct:number;reference:number;proposal:number}){const c=budget.cronograma||{dias30:30,dias60:30,dias90:40},sheetPages=chunks(budget.itens,16),memoryPages=chunks(budget.itens,18),compositions=budget.itens.filter(i=>i.insumos?.length),total=sheetPages.length+memoryPages.length+compositions.length+2;let page=1,m={...officialMeta,...budget.meta};return <article className="report"><ReportPage budget={budget} title="CARTA PROPOSTA" page={page} total={total} className="proposal-page"><div className="proposal-letter"><span>PROPOSTA COMERCIAL</span><h1>{budget.titulo}</h1><p>À <b>{budget.cliente}</b></p><p>Apresentamos proposta para execução do objeto acima, conforme a planilha orçamentária, composições de custos, memorial de cálculo, BDI e cronograma físico-financeiro anexos.</p><div className="proposal-values"><small>PREÇO DE REFERÊNCIA</small><b>{money4.format(reference)}</b><small>DESCONTO GLOBAL</small><b>{num8.format(budget.desconto)}%</b><small>VALOR TOTAL DA PROPOSTA</small><strong>{money4.format(proposal)}</strong></div><dl><div><dt>Prazo de execução</dt><dd>{m.prazo} dias</dd></div><div><dt>Validade da proposta</dt><dd>{m.validadeProposta} dias</dd></div><div><dt>BDI aplicado</dt><dd>{num4.format(budget.bdi)}%</dd></div><div><dt>Tabela de referência</dt><dd>{m.tabela}</dd></div></dl><p className="proposal-company"><b>{m.empresa}</b> • CNPJ {m.cnpj}<br/>{m.endereco||"Endereço a preencher"} • {m.telefone||"Telefone a preencher"} • {m.email||"E-mail a preencher"}</p><div className="proposal-signatures"><div><i/><b>{m.proprietario}</b><span>Proprietário / representante</span></div><div><i/><b>{m.responsavelTecnico||"Responsável técnico a preencher"}</b><span>{m.profissaoResponsavel}{m.creaResponsavel?` • ${m.creaResponsavel}`:""}</span></div></div></div></ReportPage>{sheetPages.map((items,part)=>{page++;const current=page;return <ReportPage budget={budget} title="PLANILHA ORÇAMENTÁRIA" page={current} total={total} key={`sheet-${part}`}>
<div className="report-section-title">
<span>1. PLANILHA ORÇAMENTÁRIA</span>
<b>{part+1} / {sheetPages.length}</b>
</div>
<table className="report-budget-table">
<thead>
<tr>
<th>Item</th>
<th>Código</th>
<th>Descrição integral</th>
<th>Un.</th>
<th>Qtd.</th>
<th>Preço unit.</th>
<th>Total</th>
</tr>
</thead>
<tbody>{items.map(i=>{const n=budget.itens.indexOf(i);return <tr key={i.id}>
<td>{n+1}</td>
<td>{i.codigo}</td>
<td>{i.descricao}</td>
<td>{i.unidade}</td>
<td>{num3.format(i.quantidade)}</td>
<td>{money4.format(i.preco)}</td>
<td>{money4.format(lineTotal(i))}</td>
</tr>})}</tbody>
</table>{part===sheetPages.length-1&&<div className="report-totals">
<div>
<span>Custo direto</span>
<b>{money4.format(direct)}</b>
</div>
<div>
<span>BDI ({num4.format(budget.bdi)}%)</span>
<b>{money4.format(reference-direct)}</b>
</div>
<div>
<span>Preço de referência</span>
<b>{money4.format(reference)}</b>
</div>
<div>
<span>Desconto ({num8.format(budget.desconto)}%)</span>
<b>- {money4.format(reference-proposal)}</b>
</div>
<div className="grand">
<span>VALOR DA PROPOSTA</span>
<b>{money4.format(proposal)}</b>
</div>
</div>}</ReportPage>})}{memoryPages.map((items,part)=>{page++;const current=page;return <ReportPage budget={budget} title="MEMORIAL DE CÁLCULO" page={current} total={total} key={`memory-${part}`}>
<div className="report-section-title">
<span>2. MEMÓRIA DE CÁLCULO</span>
<b>{part+1} / {memoryPages.length}</b>
</div>
<table>
<thead>
<tr>
<th>Código</th>
<th>Serviço</th>
<th>Fórmula / medição</th>
<th>Quantidade</th>
</tr>
</thead>
<tbody>{items.map(i=>
<tr key={i.id}>
<td>{i.codigo}</td>
<td>{i.descricao}</td>
<td>{i.memoria||"Não informado"}</td>
<td>{num3.format(i.quantidade)} {i.unidade}</td>
</tr>)}</tbody>
</table>
</ReportPage>})}{compositions.map((i,n)=>{page++;const current=page;return <ReportPage budget={budget} title="RELATÓRIO ANALÍTICO - COMPOSIÇÕES DE CUSTOS" page={current} total={total} key={i.id} className="composition-page">
<div className="report-section-title">
<span>3.{n+1}. {i.codigo} — COMPOSIÇÃO DE CUSTO</span>
<b>{i.unidade}</b>
</div>
<AnalyticalComposition item={i} print/>
</ReportPage>})}{(()=>{page++;return <ReportPage budget={budget} title="BDI E CRONOGRAMA FÍSICO-FINANCEIRO" page={page} total={total} className="closing-page">
<div className="report-section-title">
<span>4. DEMONSTRATIVO ANALÍTICO DO BDI</span>
</div>
<table>
<thead>
<tr>
<th>Parcela</th>
<th>Descrição</th>
<th>Percentual</th>
</tr>
</thead>
<tbody>{(budget.bdiPartes||defaultBdi).map(x=>
<tr key={x.id}>
<td>
<b>{x.sigla}</b>
</td>
<td>{x.descricao}</td>
<td>{num4.format(x.percentual)}%</td>
</tr>)}</tbody>
</table>
<p className="report-formula">BDI = [(1+AC) × (1+S+G+R) × (1+DF) × (1+L) ÷ (1-I)] − 1 &nbsp; | &nbsp; <b>BDI calculado: {num4.format(budget.bdi)}%</b>
</p>
<p className="report-bdi-note"><b>Impostos (8,35%):</b> COFINS 3,00% • PIS 0,65% • CPRB 2,70% • ISS 2,00% (5% sobre 40% do valor da obra). Referência: Acórdão TCU AC 2622-37/13.</p>
<div className="report-section-title section-gap">
<span>5. CRONOGRAMA FÍSICO-FINANCEIRO</span>
</div>
<table>
<thead>
<tr>
<th>Marco</th>
<th>Percentual</th>
<th>Valor</th>
<th>Acumulado</th>
</tr>
</thead>
<tbody>
<tr>
<td>30 dias</td>
<td>{num3.format(c.dias30)}%</td>
<td>{money4.format(proposal*c.dias30/100)}</td>
<td>{money4.format(proposal*c.dias30/100)}</td>
</tr>
<tr>
<td>60 dias</td>
<td>{num3.format(c.dias60)}%</td>
<td>{money4.format(proposal*c.dias60/100)}</td>
<td>{money4.format(proposal*(c.dias30+c.dias60)/100)}</td>
</tr>
<tr>
<td>90 dias</td>
<td>{num3.format(c.dias90)}%</td>
<td>{money4.format(proposal*c.dias90/100)}</td>
<td>{money4.format(proposal)}</td>
</tr>
</tbody>
</table>
{budget.cronogramaEtapas?.length&&<><div className="report-section-title section-gap compact-gap"><span>DISTRIBUIÇÃO POR AMBIENTE — PROPOSTA</span></div><table><thead><tr><th>Ambiente</th><th>Total proposto</th><th>30 dias</th><th>60 dias</th><th>90 dias</th></tr></thead><tbody>{budget.cronogramaEtapas.map(row=>{const base=budget.cronogramaEtapas!.reduce((s,x)=>s+x.valor,0),value=base?proposal*row.valor/base:0;return <tr key={row.nome}><td>{row.nome}</td><td>{money4.format(value)}</td><td>{money4.format(value*row.d30/100)}</td><td>{money4.format(value*row.d60/100)}</td><td>{money4.format(value*row.d90/100)}</td></tr>})}</tbody></table></>}
<div className="signature">
<p>{budget.municipio}, {new Date().toLocaleDateString("pt-BR")}</p>
<div/>
<strong>{budget.meta?.responsavelTecnico||"Responsável técnico a preencher"}</strong>
<span>{budget.meta?.profissaoResponsavel||"Engenheiro(a)"}{budget.meta?.creaResponsavel?` • ${budget.meta.creaResponsavel}`:""}</span>
<small>Proprietário / representante: {budget.meta?.proprietario||"Fernando Falcão de Sousa"}</small>
</div>
</ReportPage>})()}</article>}
