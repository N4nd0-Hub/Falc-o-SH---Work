"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { KeyRound, LoaderCircle, LogIn, ShieldAlert, UserPlus } from "lucide-react";
import { sb } from "@/lib/supabase";

type Ctx = { session: Session; email: string; sair: () => Promise<void> };
const AuthCtx = createContext<Ctx | null>(null);
export const useAuth = () => { const c = useContext(AuthCtx); if (!c) throw new Error("useAuth fora do AuthGate"); return c; };

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [membro, setMembro] = useState<boolean | null>(null);
  const [recuperando, setRecuperando] = useState(false);

  useEffect(() => {
    const c = sb();
    c.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = c.auth.onAuthStateChange((ev, s) => { if (ev === "PASSWORD_RECOVERY") setRecuperando(true); setSession(s); });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setMembro(null); return; }
    sb().rpc("is_membro").then(({ data, error }) => setMembro(error ? false : !!data));
  }, [session]);

  const sair = async () => { await sb().auth.signOut(); setSession(null); };

  if (session === undefined || (session && membro === null)) return <div className="loading"><LoaderCircle className="spin" /></div>;
  if (recuperando && session) return <NovaSenha fim={() => setRecuperando(false)} />;
  if (!session) return <Login />;
  if (!membro) return <div className="login-wrap"><div className="login">
    <ShieldAlert style={{ width: 40, height: 40 }} />
    <h1>Seu e-mail ainda não tem acesso</h1>
    <p className="muted">Você entrou como <b>{session.user.email}</b>. Peça para alguém da empresa adicionar este e-mail em <b>Empresa → Pessoas com acesso</b> e depois entre de novo.</p>
    <button className="btn" onClick={sair}>Sair</button>
  </div></div>;
  return <AuthCtx.Provider value={{ session, email: session.user.email || "", sair }}>{children}</AuthCtx.Provider>;
}

function Login() {
  const [modo, setModo] = useState<"entrar" | "criar" | "esqueci">("entrar");
  const [email, setEmail] = useState(""), [senha, setSenha] = useState(""), [senha2, setSenha2] = useState("");
  const [msg, setMsg] = useState<{ t: "bad" | "ok"; s: string } | null>(null), [busy, setBusy] = useState(false);
  const traduz = (m: string) => /Invalid login/i.test(m) ? "E-mail ou senha incorretos." : /not confirmed/i.test(m) ? "Este e-mail ainda não tem acesso liberado." : /already registered/i.test(m) ? "Este e-mail já tem senha. Use a aba Entrar." : /rate limit/i.test(m) ? "Muitas tentativas seguidas. Espere alguns minutos e tente de novo." : /at least 6|Password should/i.test(m) ? "A senha precisa ter pelo menos 6 caracteres." : m;
  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setMsg(null); setBusy(true);
    const c = sb();
    try {
      if (modo === "entrar") {
        const { error } = await c.auth.signInWithPassword({ email: email.trim(), password: senha });
        if (error) setMsg({ t: "bad", s: traduz(error.message) });
      } else if (modo === "criar") {
        if (senha !== senha2) { setMsg({ t: "bad", s: "As duas senhas não são iguais." }); return; }
        const { error } = await c.auth.signUp({ email: email.trim(), password: senha, options: { emailRedirectTo: window.location.origin } });
        if (error) { setMsg({ t: "bad", s: traduz(error.message) }); return; }
        const r = await c.auth.signInWithPassword({ email: email.trim(), password: senha });
        if (r.error) setMsg({ t: "bad", s: "Senha criada, mas este e-mail ainda não foi liberado. Peça para alguém da empresa adicionar você em Empresa → Pessoas com acesso." });
      } else {
        const { error } = await c.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
        setMsg(error ? { t: "bad", s: traduz(error.message) } : { t: "ok", s: "Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha." });
      }
    } finally { setBusy(false); }
  }
  return <div className="login-wrap"><form className="login" onSubmit={enviar}>
    <div className="row"><div className="brand-mark">F</div><div><h1>Falcão SH · Work</h1><span className="muted">Licitações, documentos e orçamentos</span></div></div>
    {modo !== "esqueci" && <div className="tabs"><button type="button" className={modo === "entrar" ? "active" : ""} onClick={() => setModo("entrar")}>Entrar</button><button type="button" className={modo === "criar" ? "active" : ""} onClick={() => setModo("criar")}>Primeiro acesso</button></div>}
    {modo === "criar" && <p className="help">Use o e-mail que foi liberado pela empresa e escolha uma senha.</p>}
    {modo === "esqueci" && <p className="help">Digite seu e-mail para receber o link de nova senha.</p>}
    <label className="field">E-mail<input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
    {modo !== "esqueci" && <label className="field">Senha<input type="password" required minLength={6} autoComplete={modo === "criar" ? "new-password" : "current-password"} value={senha} onChange={e => setSenha(e.target.value)} /></label>}
    {modo === "criar" && <label className="field">Repita a senha<input type="password" required minLength={6} autoComplete="new-password" value={senha2} onChange={e => setSenha2(e.target.value)} /></label>}
    {msg && <div className={`notice ${msg.t}`}>{msg.s}</div>}
    <button className="btn primary big" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : modo === "entrar" ? <LogIn /> : modo === "criar" ? <UserPlus /> : <KeyRound />}{modo === "entrar" ? "Entrar" : modo === "criar" ? "Criar minha senha" : "Enviar link"}</button>
    {modo === "entrar" ? <button type="button" className="btn small" onClick={() => setModo("esqueci")}>Esqueci minha senha</button> : modo === "esqueci" ? <button type="button" className="btn small" onClick={() => setModo("entrar")}>Voltar</button> : null}
  </form></div>;
}

function NovaSenha({ fim }: { fim: () => void }) {
  const [s, setS] = useState(""), [msg, setMsg] = useState("");
  return <div className="login-wrap"><form className="login" onSubmit={async e => { e.preventDefault(); const { error } = await sb().auth.updateUser({ password: s }); if (error) setMsg(error.message); else fim(); }}>
    <h1>Criar nova senha</h1>
    <label className="field">Nova senha<input type="password" minLength={6} required value={s} onChange={e => setS(e.target.value)} /></label>
    {msg && <div className="notice bad">{msg}</div>}
    <button className="btn primary big"><KeyRound /> Salvar senha</button>
  </form></div>;
}
