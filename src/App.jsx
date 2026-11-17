import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Activity, AlertCircle, ArrowRight, ArrowUpRight, Building2, Check,
  CheckCircle2, ChevronDown, ClipboardList, Clock3, HardHat, LayoutDashboard,
  LockKeyhole, LogOut, Menu, Plus, RefreshCw, Search, ShieldCheck,
  Ticket, Wrench, X
} from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const API_URL = import.meta.env.VITE_MAINTENANCE_API_URL;
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const statusLabels = {
  open: "Aberto", in_progress: "Em atendimento", waiting_material: "Aguardando material",
  waiting_third_party: "Aguardando terceiro", resolved: "Resolvido",
  closed_unresolved: "Encerrado sem solução", cancelled: "Cancelado"
};
const priorityLabels = { low: "Baixa", normal: "Normal", high: "Alta", critical: "Crítica" };

async function publicApi(payload) {
  if (!API_URL) throw new Error("Endereço da API não configurado.");
  const response = await fetch(API_URL, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a operação.");
  return data;
}
function Field({ label, children, hint }) {
  return <label className="field"><span className="field-label">{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
function Brand({ compact = false }) {
  return <div className="brand">
    <div className="brand-mark"><Wrench size={21} strokeWidth={2.2} /></div>
    {!compact && <div><strong>central<span>.</span></strong><small>MANUTENÇÃO</small></div>}
  </div>;
}
function Status({ value }) {
  return <span className={`status status-${value}`}><i />{statusLabels[value] || value}</span>;
}
function Priority({ value }) {
  return <span className={`priority priority-${value}`}>{priorityLabels[value] || value}</span>;
}
function App() {
  const [page, setPage] = useState("new");
  const [stores, setStores] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [storeId, setStoreId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [ticketResult, setTicketResult] = useState(null);
  const [trackForm, setTrackForm] = useState({ protocol: "", tracking_token: "" });
  const [tracking, setTracking] = useState(null);
  const [login, setLogin] = useState({ email: "", password: "" });
  const [session, setSession] = useState(null);
  const [membership, setMembership] = useState(null);
  const [profile, setProfile] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [form, setForm] = useState({
    requester_name: "", requester_contact: "", sector_id: "", category_id: "",
    location: "", title: "", description: "", website: ""
  });

  const loadBootstrap = async (id = "") => {
    try {
      const data = await publicApi({ action: "bootstrap", ...(id ? { store_id: id } : {}) });
      if (data.stores) setStores(data.stores);
      if (data.sectors) setSectors(data.sectors);
      if (data.categories) setCategories(data.categories);
    } catch (e) { setError(e.message); }
  };

  useEffect(() => { loadBootstrap(); }, []);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session?.user) { setMembership(null); setProfile(null); setTickets([]); return; }
    loadStaffContext();
  }, [session?.user?.id]);

  async function loadStaffContext() {
    if (!session?.user || !supabase) return;
    setBusy(true); setError("");
    try {
      const [{ data: memberships, error: mErr }, { data: p, error: pErr }] = await Promise.all([
        supabase.from("user_store_memberships").select("id, store_id, role, active, stores(name, code)").eq("user_id", session.user.id).eq("active", true),
        supabase.from("profiles").select("display_name, active").eq("id", session.user.id).maybeSingle()
      ]);
      if (mErr) throw mErr;
      if (pErr) throw pErr;
      if (!memberships?.length || p?.active === false) throw new Error("Este usuário não possui vínculo ativo com uma loja. Solicite acesso ao administrador.");
      setMembership(memberships[0]); setProfile(p);
      await loadTickets(memberships[0].store_id);
    } catch (e) { setError(e.message || "Falha ao carregar o painel."); }
    finally { setBusy(false); }
  }
  async function loadTickets(id = membership?.store_id) {
    if (!id || !supabase) return;
    const { data, error: queryError } = await supabase.from("tickets").select("*").eq("store_id", id).order("opened_at", { ascending: false }).limit(150);
    if (queryError) throw queryError;
    setTickets(data || []);
  }
  async function submitTicket(e) {
    e.preventDefault(); setBusy(true); setError(""); setTicketResult(null);
    try {
      const data = await publicApi({ action: "create_ticket", store_id: storeId, ...form });
      if (data.protocol) { setTicketResult(data); setForm({ requester_name:"", requester_contact:"", sector_id:"", category_id:"", location:"", title:"", description:"", website:"" }); }
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function submitTracking(e) {
    e.preventDefault(); setBusy(true); setError(""); setTracking(null);
    try { setTracking(await publicApi({ action: "track_ticket", ...trackForm })); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function signIn(e) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const { error: authError } = await supabase.auth.signInWithPassword(login);
      if (authError) throw authError;
      setPage("dashboard");
    } catch (e) { setError(e.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : e.message); }
    finally { setBusy(false); }
  }
  async function signOut() {
    await supabase?.auth.signOut(); setPage("new"); setMembership(null); setTickets([]);
  }

  const visibleTickets = useMemo(() => tickets.filter(t => {
    const matchesFilter = filter === "all" || t.status === filter;
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || [t.protocol, t.title, t.location, t.requester_name].some(v => String(v || "").toLowerCase().includes(q));
    return matchesFilter && matchesSearch;
  }), [tickets, filter, search]);
  const stats = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter(t => t.status === "open").length,
    active: tickets.filter(t => ["in_progress","waiting_material","waiting_third_party"].includes(t.status)).length,
    resolved: tickets.filter(t => t.status === "resolved").length
  }), [tickets]);

  const go = (target) => { setError(""); setNotice(null); setPage(target); setMobileMenu(false); };
  const publicPage = ["new","track"].includes(page);

  return <div className="app-shell">
    <header className="topbar">
      <div className="topbar-inner">
        <Brand />
        <div className="topbar-right">
          {session?.user && membership ? <><span className="user-chip"><span className="online-dot" />{profile?.display_name || session.user.email}</span><button className="icon-button" onClick={signOut} title="Sair"><LogOut size={17}/></button></> :
            <button className="login-link" onClick={() => go("login")}><LockKeyhole size={15}/> Acesso da equipe</button>}
        </div>
      </div>
    </header>

    <main className="main-wrap">
      {publicPage && <section className="hero">
        <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line"/> OPERAÇÃO • MANUTENÇÃO</div>
          <h1>Manutenção em<br/><em>movimento.</em></h1>
          <p>Registre uma necessidade, acompanhe o atendimento e mantenha a operação funcionando.</p>
        </div>
        <div className="hero-art" aria-hidden="true"><div className="art-ring ring-one"/><div className="art-ring ring-two"/><div className="art-center"><Wrench size={44}/></div><span className="art-cross cross-a">+</span><span className="art-cross cross-b">+</span></div>
      </section>}

      {error && <div className="alert alert-error"><AlertCircle size={17}/><span>{error}</span><button onClick={() => setError("")}><X size={15}/></button></div>}
      {notice && <div className="alert alert-success"><CheckCircle2 size={17}/>{notice}</div>}

      {page === "new" && <section className="content-grid">
        <aside className="side-intro">
          <div className="side-kicker">CENTRAL DE SERVIÇOS <span>01 / 02</span></div>
          <h2>Abra um<br/>chamado.</h2>
          <p>Descreva o problema com clareza. A equipe de manutenção receberá a solicitação para avaliação.</p>
          <div className="side-note"><ShieldCheck size={18}/><span>Não é necessário fazer login para solicitar atendimento.</span></div>
          <div className="side-links"><button className="text-link" onClick={() => go("track")}>Já tenho um protocolo <ArrowUpRight size={15}/></button></div>
        </aside>
        <section className="panel form-panel">
          {ticketResult ? <div className="success-state">
            <div className="success-icon"><Check size={28}/></div><div className="eyebrow">SOLICITAÇÃO REGISTRADA</div>
            <h2>Chamado aberto.</h2><p>Guarde os dados abaixo. O código de acompanhamento é exibido apenas nesta tela.</p>
            <div className="protocol-box"><small>PROTOCOLO</small><strong>{ticketResult.protocol}</strong></div>
            <div className="token-box"><small>CÓDIGO PRIVADO DE ACOMPANHAMENTO</small><code>{ticketResult.tracking_token}</code></div>
            <button className="button button-primary full" onClick={() => { setTrackForm({ protocol: ticketResult.protocol, tracking_token: ticketResult.tracking_token }); setTicketResult(null); go("track"); }}>Acompanhar chamado <ArrowRight size={17}/></button>
            <button className="button button-quiet full" onClick={() => setTicketResult(null)}>Abrir outro chamado</button>
          </div> : <form onSubmit={submitTicket}>
            <div className="panel-heading"><div><span className="section-index">FORMULÁRIO 01</span><h3>Nova solicitação</h3></div><span className="required-note">* Obrigatório</span></div>
            <div className="form-grid">
              <Field label="Loja *"><select required value={storeId} onChange={e => { setStoreId(e.target.value); setForm(f => ({...f, sector_id:""})); loadBootstrap(e.target.value); }}><option value="">Selecione a unidade</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
              <Field label="Setor"><select value={form.sector_id} onChange={e => setForm(f => ({...f, sector_id:e.target.value}))}><option value="">Selecione o setor</option>{sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
              <Field label="Seu nome *"><input required minLength="2" maxLength="100" value={form.requester_name} onChange={e => setForm(f => ({...f, requester_name:e.target.value}))} placeholder="Nome e sobrenome"/></Field>
              <Field label="Contato"><input maxLength="120" value={form.requester_contact} onChange={e => setForm(f => ({...f, requester_contact:e.target.value}))} placeholder="Ramal ou telefone"/></Field>
              <Field label="Categoria"><select value={form.category_id} onChange={e => setForm(f => ({...f, category_id:e.target.value}))}><option value="">Selecione a categoria</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              <Field label="Local exato *"><input required minLength="2" maxLength="160" value={form.location} onChange={e => setForm(f => ({...f, location:e.target.value}))} placeholder="Ex.: Câmara fria, corredor 12"/></Field>
              <div className="span-2"><Field label="Título do problema *"><input required minLength="4" maxLength="140" value={form.title} onChange={e => setForm(f => ({...f, title:e.target.value}))} placeholder="Resuma o que precisa de manutenção"/></Field></div>
              <div className="span-2"><Field label="Descrição detalhada *" hint="Informe o que aconteceu, desde quando e se existe algum risco para pessoas ou para a operação."><textarea required minLength="10" maxLength="3000" rows="4" value={form.description} onChange={e => setForm(f => ({...f, description:e.target.value}))} placeholder="Descreva a situação com o máximo de clareza..."/></Field></div>
              <div className="honeypot" aria-hidden="true"><input tabIndex="-1" autoComplete="off" value={form.website} onChange={e => setForm(f => ({...f, website:e.target.value}))}/></div>
            </div>
            <div className="form-footer"><span><LockKeyhole size={14}/> Dados enviados em conexão segura</span><button className="button button-primary" type="submit" disabled={busy || !stores.length}>{busy ? "Enviando..." : "Registrar chamado"} <ArrowRight size={17}/></button></div>
          </form>}
        </section>
      </section>}

      {page === "track" && <section className="content-grid">
        <aside className="side-intro"><div className="side-kicker">CENTRAL DE SERVIÇOS <span>02 / 02</span></div><h2>Acompanhe<br/>o chamado.</h2><p>Consulte o andamento usando o protocolo e o código privado que recebeu ao registrar a solicitação.</p><div className="side-note"><LockKeyhole size={18}/><span>O código privado impede que terceiros consultem seu chamado.</span></div><div className="side-links"><button className="text-link" onClick={() => go("new")}>Abrir novo chamado <ArrowUpRight size={15}/></button></div></aside>
        <section className="panel form-panel">
          <form onSubmit={submitTracking}><div className="panel-heading"><div><span className="section-index">CONSULTA 02</span><h3>Localizar solicitação</h3></div></div>
            <div className="form-grid single"><Field label="Número do protocolo"><input required value={trackForm.protocol} onChange={e => setTrackForm(f => ({...f, protocol:e.target.value.toUpperCase()}))} placeholder="MAC-2026-000001"/></Field><Field label="Código privado"><input required value={trackForm.tracking_token} onChange={e => setTrackForm(f => ({...f, tracking_token:e.target.value.trim()}))} placeholder="Código de 64 caracteres"/></Field></div>
            <div className="form-footer"><span><ShieldCheck size={14}/> Consulta protegida</span><button className="button button-primary" disabled={busy}>{busy ? "Consultando..." : "Consultar chamado"} <Search size={17}/></button></div>
          </form>
          {tracking && <div className="tracking-result"><div className="tracking-top"><div><span className="section-index">{tracking.ticket.protocol}</span><h3>{tracking.ticket.title}</h3></div><Status value={tracking.ticket.status}/></div><div className="tracking-meta"><span><Wrench size={15}/>{tracking.ticket.location}</span><span><Clock3 size={15}/>{new Date(tracking.ticket.opened_at).toLocaleString("pt-BR")}</span><span><Priority value={tracking.ticket.priority}/></span></div><div className="timeline"><h4>Atualizações</h4>{tracking.updates.length ? tracking.updates.map((u,i) => <div className="timeline-item" key={i}><i/><div><strong>{u.new_status ? statusLabels[u.new_status] : "Atualização"}</strong><p>{u.message}</p><small>{new Date(u.created_at).toLocaleString("pt-BR")}</small></div></div>) : <p className="muted">Nenhuma atualização pública foi registrada até o momento.</p>}</div></div>}
        </section>
      </section>}

      {page === "login" && <section className="login-layout"><div className="login-aside"><div className="eyebrow">ÁREA RESTRITA</div><h1>Gestão com<br/><em>visibilidade.</em></h1><p>Acesso operacional para a equipe responsável pelo atendimento e gestão da manutenção.</p><div className="login-feature"><ShieldCheck size={18}/> Ambiente protegido por autenticação</div></div><section className="panel login-panel"><div className="login-icon"><LockKeyhole size={22}/></div><span className="section-index">ACESSO INTERNO</span><h2>Entrar na central</h2><p>Utilize suas credenciais de acesso.</p><form onSubmit={signIn}><Field label="E-mail"><input type="email" autoComplete="username" required value={login.email} onChange={e => setLogin(f => ({...f,email:e.target.value}))} placeholder="nome@empresa.com"/></Field><Field label="Senha"><input type="password" autoComplete="current-password" required value={login.password} onChange={e => setLogin(f => ({...f,password:e.target.value}))} placeholder="Sua senha"/></Field><button className="button button-primary full" disabled={busy || !supabase}>{busy ? "Entrando..." : "Acessar painel"} <ArrowRight size={17}/></button></form><button className="text-link back-link" onClick={() => go("new")}>Voltar ao formulário público</button></section></section>}

      {page === "dashboard" && session && membership && <section className="dashboard">
        <div className="dash-heading"><div><div className="eyebrow">VISÃO OPERACIONAL</div><h1>Painel de manutenção</h1><p>{membership.stores?.name || "Unidade"} · {membership.role === "admin" ? "Administrador" : membership.role === "leader" ? "Liderança" : "Manutenção"}</p></div><button className="button button-secondary" onClick={() => loadTickets()}><RefreshCw size={16}/> Atualizar</button></div>
        <div className="stat-grid"><div className="stat-card"><span>Chamados registrados</span><strong>{stats.total}</strong><ClipboardList size={20}/></div><div className="stat-card stat-open"><span>Abertos</span><strong>{stats.open}</strong><Ticket size={20}/></div><div className="stat-card stat-active"><span>Em andamento / espera</span><strong>{stats.active}</strong><Activity size={20}/></div><div className="stat-card stat-done"><span>Resolvidos</span><strong>{stats.resolved}</strong><CheckCircle2 size={20}/></div></div>
        <section className="panel queue-panel"><div className="queue-heading"><div><span className="section-index">ACOMPANHAMENTO</span><h3>Fila de chamados</h3></div><span className="count-pill">{visibleTickets.length} registros</span></div>
          <div className="queue-tools"><div className="search-box"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar protocolo, local ou título"/></div><select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Todos os status</option>{Object.entries(statusLabels).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div className="ticket-list">{visibleTickets.length ? visibleTickets.map(t => <article className="ticket-row" key={t.id}><div className="ticket-main"><span className="ticket-protocol">{t.protocol}</span><h4>{t.title}</h4><p>{t.location} · {t.requester_name}</p></div><div className="ticket-tags"><Priority value={t.priority}/><Status value={t.status}/></div><div className="ticket-date">{new Date(t.opened_at).toLocaleDateString("pt-BR")}</div></article>) : <div className="empty-state"><ClipboardList size={26}/><strong>Nenhum chamado encontrado</strong><span>Os registros aparecerão aqui quando forem abertos.</span></div>}</div>
        </section>
      </section>}
      {page === "dashboard" && session && !membership && <div className="panel access-wait"><ShieldCheck size={28}/><h2>Validando acesso</h2><p>Carregando vínculo com a unidade...</p><button className="button button-secondary" onClick={loadStaffContext}>Tentar novamente</button></div>}
    </main>
    <footer className="footer"><div className="footer-inner"><Brand compact/><span>Central de Manutenção <b>•</b> Loja 232 — Macaé</span><span className="footer-status"><i/> SISTEMA EM ESTRUTURAÇÃO</span></div></footer>
  </div>;
}

export default App;