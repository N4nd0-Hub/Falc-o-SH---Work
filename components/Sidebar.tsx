"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, Calculator, Building2, FolderLock, Home, LogOut, Search } from "lucide-react";
import { useAuth } from "./Auth";

export const NAV = [
  { href: "/", label: "Início", icon: Home },
  { href: "/licitacoes", label: "Licitações", icon: Search },
  { href: "/documentos", label: "Documentos", icon: FolderLock },
  { href: "/acervo", label: "Acervo técnico", icon: Award },
  { href: "/orcamentos", label: "Orçamentos", icon: Calculator },
  { href: "/empresa", label: "Empresa", icon: Building2 },
];
export const ativo = (path: string, href: string) => href === "/" ? path === "/" : path.startsWith(href);

export default function Sidebar({ extra }: { extra?: React.ReactNode }) {
  const path = usePathname();
  const { email, sair } = useAuth();
  return <aside className="sidebar">
    <Link href="/" className="brand brand-work" style={{ textDecoration: "none", color: "inherit" }}>
      <div className="brand-mark">F</div>
      <div><strong>FALCÃO SH</strong><span>WORK</span></div>
    </Link>
    <nav>{NAV.map(n => <Link key={n.href} href={n.href} className={ativo(path, n.href) ? "active" : ""} title={n.label}><n.icon />{n.label}</Link>)}</nav>
    {extra}
    <div className="user-box">
      <span>Conectado como</span><b>{email}</b>
      <button onClick={sair} title="Sair"><LogOut /> Sair</button>
    </div>
  </aside>;
}

export function MobileTabs() {
  const path = usePathname();
  return <nav className="mobile-tabs">{NAV.map(n => <Link key={n.href} href={n.href} className={ativo(path, n.href) ? "active" : ""}><n.icon />{n.label.split(" ")[0]}</Link>)}</nav>;
}

export function Shell({ children }: { children: React.ReactNode }) {
  return <div className="app-shell work-shell"><Sidebar /><main className="page">{children}</main><MobileTabs /></div>;
}
