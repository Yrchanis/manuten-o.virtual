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
const roleLabels = { admin: "ADMIN", management: "Gerência", leader: "Gerência", maintenance: "Manutenção", maintenance_assistant: "Auxiliar de manutenção", administrative: "Administrativo" };
const roleOptions = ["maintenance","maintenance_assistant","administrative","management","admin"];

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
  const [page, setPage] = useState("select-store");
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
  const [login, setLogin] = useState({ username: "", password: "" });
  const [passwordChange, setPasswordChange] = useState({ password: "", confirm: "" });
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [session, setSession] = useState(null);
  const [membership, setMembership] = useState(null);
  const [profile, setProfile] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);
  const [userForm, setUserForm] = useState({ user_id: "", display_name: "", employee_number: "", role: "maintenance" });
  const [userResult, setUserResult] = useState(null);
  const [internalForm, setInternalForm] = useState({ requester_name: "", requester_contact: "", sector_id: "", category_id: "", location: "", title: "", description: "" });
  const [expandedTicket, setExpandedTicket] = useState("");
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
  }, [session?.user?.id, storeId]);

  async function loadStaffContext() {
    if (!session?.user || !supabase || !storeId || session.user.user_metadata?.must_change_password === true) return;
    setBusy(true); setError("");
    try {
      const [{ data: memberships, error: mErr }, { data: p, error: pErr }] = await Promise.all([
        supabase.from("user_store_memberships").select("id, store_id, role, active, stores(name, code)").eq("user_id", session.user.id).eq("active", true).eq("store_id", storeId),
        supabase.from("profiles").select("display_name, employee_number, active").eq("id", session.user.id).maybeSingle()
      ]);
      if (mErr) throw mErr;
      if (pErr) throw pErr;
      if (!memberships?.length || p?.active === false) throw new Error("Este usuário não possui acesso ativo à loja selecionada. Solicite liberação ao administrador.");
      setMembership(memberships[0]); setProfile(p);
      await loadTickets(memberships[0].store_id);
    } catch (e) { setError(e.message || "Falha ao carregar o painel."); }
    finally { setBusy(false); }
  }
  async function loadTickets(id = membership?.store_id) {
    if (!id || !supabase) return;
    const { data, error: queryError } = await supabase.from("tickets").select("*").eq("store_id", id).is("deleted_at", null).order("opened_at", { ascending: false }).limit(300);
    if (queryError) throw queryError;
    setTickets(data || []);
  }
  async function submitTicket(e) {
    e.preventDefault(); setBusy(true); setError(""); setTicketResult(null);
    try {
      if (!storeId) throw new Error("Selecione uma loja antes de abrir o chamado.");
      const data = await publicApi({ action: "create_ticket", store_id: storeId, ...form });
      if (data.protocol) { setTicketResult(data); setForm({ requester_name:"", requester_contact:"", sector_id:"", category_id:"", location:"", title:"", description:"", website:"" }); }
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function submitTracking(e) {
    e.preventDefault(); setBusy(true); setError(""); setTracking(null);
    try { setTracking(await publicApi({ action: "track_ticket", store_id: storeId, ...trackForm })); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function signIn(e) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const username = login.username.trim();
      if (!/^\d{7}$/.test(username)) throw new Error("Informe o usuário numérico de 7 dígitos.");
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: `${username}@central-manutencao.local`, password: login.password
      });
      if (authError) throw authError;
      const required = data.user?.user_metadata?.must_change_password === true;
      setMustChangePassword(required);
      setPage(required ? "change-password" : "dashboard");
    } catch (e) { setError(e.message === "Invalid login credentials" ? "Usuário ou senha incorretos." : e.message); }
    finally { setBusy(false); }
  }
  async function updateFirstPassword(e) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      if (passwordChange.password.length < 6) throw new Error("A nova senha deve ter pelo menos 6 caracteres.");
      if (passwordChange.password !== passwordChange.confirm) throw new Error("As senhas não coincidem.");
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordChange.password,
        data: { must_change_password: false }
      });
      if (updateError) throw updateError;
      setMustChangePassword(false);
      setPasswordChange({ password: "", confirm: "" });
      setNotice("Senha alterada. Acesso liberado.");
      setPage("dashboard");
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function runOps(payload) {
    setBusy(true); setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("maintenance-ops", { body: { ...payload, store_id: storeId } });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setNotice("Operação registrada.");
      await loadTickets();
      return data;
    } catch (e) { setError(e.message || "Não foi possível concluir a operação."); return null; }
    finally { setBusy(false); }
  }
  async function loadUsers() {
    setBusy(true); setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("maintenance-admin", { body: { action: "list_users", store_id: storeId } });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setStaffUsers(data.users || []);
    } catch (e) { setError(e.message || "Não foi possível carregar usuários."); }
    finally { setBusy(false); }
  }
  async function saveUser(e) {
    e.preventDefault(); setBusy(true); setError(""); setUserResult(null);
    try {
      const action = userForm.user_id ? "update_user" : "create_user";
      const { data, error: fnError } = await supabase.functions.invoke("maintenance-admin", { body: { action, store_id: storeId, ...userForm } });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setUserResult(data);
      setUserForm({ user_id: "", display_name: "", employee_number: "", role: "maintenance" });
      await loadUsers();
      setNotice(action === "create_user" ? "Usuário criado." : "Usuário atualizado.");
    } catch (e) { setError(e.message || "Não foi possível salvar o usuário."); }
    finally { setBusy(false); }
  }
  async function createInternalTicket(e) {
    e.preventDefault();
    const result = await runOps({ action: "create_internal_ticket", ...internalForm });
    if (result?.ok) {
      setInternalForm({ requester_name: "", requester_contact: "", sector_id: "", category_id: "", location: "", title: "", description: "" });
      setPage("dashboard");
    }
  }
  function exportReport() {
    const headers = ["Protocolo","Título","Local","Solicitante","Status","Prioridade","Orçamento previsto","Custo realizado","Abertura","Conclusão"];
    const rows = tickets.map(t => [t.protocol,t.title,t.location,t.requester_name,statusLabels[t.status] || t.status,priorityLabels[t.priority] || t.priority,t.estimated_budget ?? "",t.actual_cost ?? "",t.opened_at ? new Date(t.opened_at).toLocaleString("pt-BR") : "",t.resolved_at ? new Date(t.resolved_at).toLocaleString("pt-BR") : ""]);
    const csv = [headers,...rows].map(row => row.map(v => '"' + String(v ?? "").replace(/"/g,'""') + '"').join(";")).join("\\r\\n");
    const blob = new Blob(["\\ufeff"+csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = "relatorio-manutencao-" + (selectedStore?.code || "loja") + ".csv"; a.click(); URL.revokeObjectURL(url);
  }
  async function signOut() {
    await supabase?.auth.signOut(); setPage("select-store"); setStoreId(""); setMembership(null); setTickets([]);
  }

  const visibleTickets = useMemo(() => tickets.filter(t => {
    const matchesFilter = filter === "all" || t.status === filter;
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || [t.protocol, t.title, t.location, t.requester_name].some(v => String(v || "").toLowerCase().includes(q));
    return matchesFilter && matchesSearch;
  }), [tickets, filter, search]);
  const canManageUsers = ["admin","management"].includes(membership?.role);
  const canCreateInternal = ["admin","management","administrative"].includes(membership?.role);
  const canOperate = ["admin","management","maintenance","maintenance_assistant","leader"].includes(membership?.role);
  const canApprove = ["admin","management","leader"].includes(membership?.role);
  const canDelete = ["admin","management","maintenance","leader"].includes(membership?.role);
  const stats = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter(t => t.status === "open").length,
    active: tickets.filter(t => ["in_progress","waiting_material","waiting_third_party"].includes(t.status)).length,
    resolved: tickets.filter(t => t.status === "resolved").length
  }), [tickets]);

  const go = (target) => { setError(""); setNotice(null); setPage(target); setMobileMenu(false); };
  const publicPage = ["new","track"].includes(page);
  const selectedStore = stores.find(s => s.id === storeId);
  const chooseStore = (id) => { setStoreId(id); setError(""); setNotice(null); setTicketResult(null); setTracking(null); setForm(f => ({...f, sector_id:"", category_id:""})); loadBootstrap(id); setPage(session?.user ? "dashboard" : "new"); };


  return <div className="app-shell">
    <header className="topbar">
      <div className="topbar-inner">
        <Brand />
        <div className="topbar-right">
          {selectedStore && <button className="login-link" onClick={() => { setPage("select-store"); setStoreId(""); setMembership(null); setTickets([]); setError(""); }}><Building2 size={15}/> {selectedStore.code} · Trocar loja</button>}
          {selectedStore && (session?.user && membership ? <><span className="user-chip"><span className="online-dot" />{profile?.display_name || session.user.email}</span><button className="icon-button" onClick={signOut} title="Sair"><LogOut size={17}/></button></> :
            <button className="login-link" onClick={() => go("login")}><LockKeyhole size={15}/> Acesso da equipe</button>)}
        </div>
      </div>
    </header>

    <main className="main-wrap">
      {publicPage && <section className="hero">
        <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line"/> OPERAÇÃO • MANUTENÇÃO</div>
          <h1>Manutenção em<br/><em>movimento.</em></h1>
          <p>Registre uma necessidade, acompanhe o atendimento e mantenha a operação funcionando.</p><div className="active-store-label"><Building2 size={14}/>{selectedStore?.name}</div><div className="active-store-label"><Building2 size={14}/>{selectedStore?.name}</div>
        </div>
        <div className="hero-art" aria-hidden="true"><div className="art-ring ring-one"/><div className="art-ring ring-two"/><div className="art-center"><Wrench size={44}/></div><span className="art-cross cross-a">+</span><span className="art-cross cross-b">+</span></div>
      </section>}

      {error && <div className="alert alert-error"><AlertCircle size={17}/><span>{error}</span><button onClick={() => setError("")}><X size={15}/></button></div>}
      {notice && <div className="alert alert-success"><CheckCircle2 size={17}/>{notice}</div>}

      {page === "select-store" && <section className="store-select-wrap"><div className="store-select-heading"><div className="eyebrow">AMBIENTE MULTILOJA</div><h1>Selecione a<br/><em>sua unidade.</em></h1><p>Escolha a loja para acessar a central de manutenção correspondente. Os registros são mantidos separados por unidade.</p></div><div className="store-card-grid">{stores.map((s) => <button className="store-card" key={s.id} onClick={() => chooseStore(s.id)}><span className="store-card-code">{s.code === "MAC" ? "232" : s.code}</span><span className="store-card-name">{s.name.replace(/^Loja\s+\S+\s+-\s*/, "")}</span><span className="store-card-city">{s.city} · {s.state}</span><span className="store-card-action">Entrar na unidade <ArrowRight size={16}/></span></button>)}</div>{!stores.length && <div className="empty-state">Carregando unidades...</div>}</section>}

      {page === "new" && storeId && <section className="content-grid">
        <aside className="side-intro">
          <div className="side-kicker">CENTRAL DE SERVIÇOS <span>{selectedStore?.code === "MAC" ? "232" : selectedStore?.code || "UNIDADE"}</span></div>
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

      {page === "track" && storeId && <section className="content-grid">
        <aside className="side-intro"><div className="side-kicker">CENTRAL DE SERVIÇOS <span>02 / 02</span></div><h2>Acompanhe<br/>o chamado.</h2><p>Consulte o andamento usando o protocolo e o código privado que recebeu ao registrar a solicitação.</p><div className="side-note"><LockKeyhole size={18}/><span>O código privado impede que terceiros consultem seu chamado.</span></div><div className="side-links"><button className="text-link" onClick={() => go("new")}>Abrir novo chamado <ArrowUpRight size={15}/></button></div></aside>
        <section className="panel form-panel">
          <form onSubmit={submitTracking}><div className="panel-heading"><div><span className="section-index">CONSULTA 02</span><h3>Localizar solicitação</h3></div></div>
            <div className="form-grid single"><Field label="Número do protocolo"><input required value={trackForm.protocol} onChange={e => setTrackForm(f => ({...f, protocol:e.target.value.toUpperCase()}))} placeholder="MAC-2026-000001"/></Field><Field label="Código privado"><input required value={trackForm.tracking_token} onChange={e => setTrackForm(f => ({...f, tracking_token:e.target.value.trim()}))} placeholder="Código de 64 caracteres"/></Field></div>
            <div className="form-footer"><span><ShieldCheck size={14}/> Consulta protegida</span><button className="button button-primary" disabled={busy}>{busy ? "Consultando..." : "Consultar chamado"} <Search size={17}/></button></div>
          </form>
          {tracking && <div className="tracking-result"><div className="tracking-top"><div><span className="section-index">{tracking.ticket.protocol}</span><h3>{tracking.ticket.title}</h3></div><Status value={tracking.ticket.status}/></div><div className="tracking-meta"><span><Wrench size={15}/>{tracking.ticket.location}</span><span><Clock3 size={15}/>{new Date(tracking.ticket.opened_at).toLocaleString("pt-BR")}</span><span><Priority value={tracking.ticket.priority}/></span></div><div className="timeline"><h4>Atualizações</h4>{tracking.updates.length ? tracking.updates.map((u,i) => <div className="timeline-item" key={i}><i/><div><strong>{u.new_status ? statusLabels[u.new_status] : "Atualização"}</strong><p>{u.message}</p><small>{new Date(u.created_at).toLocaleString("pt-BR")}</small></div></div>) : <p className="muted">Nenhuma atualização pública foi registrada até o momento.</p>}</div></div>}
        </section>
      </section>}

      {page === "login" && <section className="login-layout"><div className="login-aside"><div className="eyebrow">ÁREA RESTRITA</div><h1>Gestão com<br/><em>visibilidade.</em></h1><p>Acesso operacional para a equipe responsável pelo atendimento e gestão da manutenção.</p><div className="login-feature"><ShieldCheck size={18}/> Ambiente protegido por autenticação</div></div><section className="panel login-panel"><div className="login-icon"><LockKeyhole size={22}/></div><span className="section-index">ACESSO INTERNO</span><h2>Entrar na central</h2><p>Utilize seu usuário e senha de acesso.</p><form onSubmit={signIn}><Field label="Usuário"><input inputMode="numeric" autoComplete="username" maxLength="7" required value={login.username} onChange={e => setLogin(f => ({...f,username:e.target.value.replace(/\D/g, "").slice(0,7)}))} placeholder="Seu usuário numérico"/></Field><Field label="Senha"><input type="password" autoComplete="current-password" required value={login.password} onChange={e => setLogin(f => ({...f,password:e.target.value}))} placeholder="Sua senha"/></Field><button className="button button-primary full" disabled={busy || !supabase}>{busy ? "Entrando..." : "Acessar painel"} <ArrowRight size={17}/></button></form><button className="text-link back-link" onClick={() => go("new")}>Voltar ao formulário público</button></section></section>}

      {page === "change-password" && session && <section className="login-layout"><div className="login-aside"><div className="eyebrow">SEGURANÇA DA CONTA</div><h1>Atualize sua<br/><em>senha.</em></h1><p>Antes de acessar os dados internos, defina uma senha pessoal e confidencial.</p></div><section className="panel login-panel"><div className="login-icon"><LockKeyhole size={22}/></div><span className="section-index">PRIMEIRO ACESSO</span><h2>Definir nova senha</h2><p>Use pelo menos 6 caracteres. Não compartilhe sua senha.</p><form onSubmit={updateFirstPassword}><Field label="Nova senha"><input type="password" autoComplete="new-password" minLength="6" required value={passwordChange.password} onChange={e => setPasswordChange(v => ({...v,password:e.target.value}))} placeholder="Mínimo de 6 caracteres"/></Field><Field label="Confirmar nova senha"><input type="password" autoComplete="new-password" minLength="6" required value={passwordChange.confirm} onChange={e => setPasswordChange(v => ({...v,confirm:e.target.value}))} placeholder="Repita a nova senha"/></Field><button className="button button-primary full" disabled={busy}>{busy ? "Salvando..." : "Salvar nova senha"} <ArrowRight size={17}/></button></form><button className="text-link back-link" onClick={signOut}>Sair</button></section></section>}

      {page === "dashboard" && session && membership && <section className="dashboard">
        <div className="dash-heading"><div><div className="eyebrow">VISÃO OPERACIONAL</div><h1>Painel de manutenção</h1><p>{membership.stores?.name || "Unidade"} · {roleLabels[membership.role] || membership.role}</p></div><div className="dash-actions">
            {canCreateInternal && <button className="button button-primary" onClick={() => go("internal-new")}><Plus size={16}/> Novo chamado</button>}
            {(membership.role === "administrative" || canApprove) && <button className="button button-secondary" onClick={exportReport}>Relatórios CSV</button>}
            {canManageUsers && <button className="button button-secondary" onClick={() => { loadUsers(); go("users"); }}>Usuários</button>}
            <button className="button button-secondary" onClick={() => loadTickets()}><RefreshCw size={16}/> Atualizar</button>
          </div></div>
        <div className="stat-grid"><div className="stat-card"><span>Chamados registrados</span><strong>{stats.total}</strong><ClipboardList size={20}/></div><div className="stat-card stat-open"><span>Abertos</span><strong>{stats.open}</strong><Ticket size={20}/></div><div className="stat-card stat-active"><span>Em andamento / espera</span><strong>{stats.active}</strong><Activity size={20}/></div><div className="stat-card stat-done"><span>Resolvidos</span><strong>{stats.resolved}</strong><CheckCircle2 size={20}/></div></div>
        <section className="panel queue-panel"><div className="queue-heading"><div><span className="section-index">ACOMPANHAMENTO</span><h3>Fila de chamados</h3></div><span className="count-pill">{visibleTickets.length} registros</span></div>
          <div className="queue-tools"><div className="search-box"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar protocolo, local ou título"/></div><select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Todos os status</option>{Object.entries(statusLabels).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div className="ticket-list">{visibleTickets.length ? visibleTickets.map(t => <article className="ticket-row" key={t.id}><div className="ticket-main"><span className="ticket-protocol">{t.protocol}</span><h4>{t.title}</h4><p>{t.location} · {t.requester_name}</p></div><div className="ticket-tags"><Priority value={t.priority}/><Status value={t.status}/></div><div className="ticket-date">{new Date(t.opened_at).toLocaleDateString("pt-BR")}</div>
              <button className="button button-secondary ticket-manage" onClick={() => setExpandedTicket(expandedTicket === t.id ? "" : t.id)}>{expandedTicket === t.id ? "Fechar" : "Ações"}</button>
              {expandedTicket === t.id && <div className="ticket-actions">
                <div className="ticket-financials"><span>Orçamento: {t.estimated_budget == null ? "—" : Number(t.estimated_budget).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</span><span>Custo: {t.actual_cost == null ? "—" : Number(t.actual_cost).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</span><span>Aprovação: {({not_required:"Não solicitada",pending:"Pendente",approved:"Aprovada",rejected:"Reprovada"})[t.approval_status] || "—"}</span>{t.is_incorrect && <span className="warning-text">Abertura incorreta</span>}</div>
                {canOperate && <Field label="Alterar status"><select value={t.status} onChange={e => runOps({action:"set_status",ticket_id:t.id,status:e.target.value})}>{Object.entries(statusLabels).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></Field>}
                {["maintenance","maintenance_assistant","admin"].includes(membership.role) && <button className="button button-secondary" onClick={() => { const note = window.prompt("Justificativa para solicitar aprovação gerencial:"); if (note) runOps({action:"request_approval",ticket_id:t.id,note}); }}>Solicitar aprovação</button>}
                {canApprove && t.approval_status === "pending" && <><button className="button button-primary" onClick={() => runOps({action:"decide_approval",ticket_id:t.id,decision:"approved"})}>Aprovar execução</button><button className="button button-secondary" onClick={() => { const note = window.prompt("Motivo da reprovação:"); if (note) runOps({action:"decide_approval",ticket_id:t.id,decision:"rejected",note}); }}>Reprovar</button></>}
                {["maintenance","maintenance_assistant","administrative","admin","management"].includes(membership.role) && <button className="button button-secondary" onClick={() => { const v = window.prompt("Orçamento previsto (R$):", t.estimated_budget ?? ""); if (v !== null) runOps({action:"set_financials",ticket_id:t.id,estimated_budget:v}); }}>Informar orçamento</button>}
                {["administrative","admin","management"].includes(membership.role) && <button className="button button-secondary" onClick={() => { const v = window.prompt("Custo realizado (R$):", t.actual_cost ?? ""); if (v !== null) runOps({action:"set_financials",ticket_id:t.id,actual_cost:v}); }}>Informar custo</button>}
                {canDelete && <button className="button button-danger" onClick={() => { const reason = window.prompt("Motivo obrigatório para excluir o chamado:"); if (reason) runOps({action:"delete_ticket",ticket_id:t.id,reason}); }}>Excluir chamado</button>}
                {["maintenance","admin","management"].includes(membership.role) && <button className="button button-secondary" onClick={() => { const reason = window.prompt("Explique por que a abertura está incorreta:"); if (reason) runOps({action:"mark_incorrect",ticket_id:t.id,reason}); }}>Marcar abertura incorreta</button>}
              </div>}
            </article>) : <div className="empty-state"><ClipboardList size={26}/><strong>Nenhum chamado encontrado</strong><span>Os registros aparecerão aqui quando forem abertos.</span></div>}</div>
        </section>
      </section>}
      {page === "internal-new" && session && membership && canCreateInternal && <section className="panel form-panel page-panel">
        <div className="panel-heading"><div><span className="section-index">REGISTRO INTERNO</span><h3>Novo chamado</h3></div><button className="button button-secondary" onClick={() => go("dashboard")}>Voltar</button></div>
        <form onSubmit={createInternalTicket}>
          <div className="form-grid">
            <Field label="Solicitante *"><input required minLength="2" value={internalForm.requester_name} onChange={e=>setInternalForm(f=>({...f,requester_name:e.target.value}))}/></Field>
            <Field label="Contato"><input value={internalForm.requester_contact} onChange={e=>setInternalForm(f=>({...f,requester_contact:e.target.value}))}/></Field>
            <Field label="Setor"><select value={internalForm.sector_id} onChange={e=>setInternalForm(f=>({...f,sector_id:e.target.value}))}><option value="">Selecione</option>{sectors.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
            <Field label="Categoria"><select value={internalForm.category_id} onChange={e=>setInternalForm(f=>({...f,category_id:e.target.value}))}><option value="">Selecione</option>{categories.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
            <Field label="Local *"><input required value={internalForm.location} onChange={e=>setInternalForm(f=>({...f,location:e.target.value}))}/></Field>
            <Field label="Título *"><input required minLength="4" value={internalForm.title} onChange={e=>setInternalForm(f=>({...f,title:e.target.value}))}/></Field>
            <div className="span-2"><Field label="Descrição *"><textarea required minLength="10" rows="4" value={internalForm.description} onChange={e=>setInternalForm(f=>({...f,description:e.target.value}))}/></Field></div>
          </div>
          <div className="form-footer"><span>Chamados do perfil Administrativo recebem prioridade alta automaticamente.</span><button className="button button-primary" disabled={busy}>Registrar chamado <ArrowRight size={16}/></button></div>
        </form>
      </section>}
      {page === "users" && session && membership && canManageUsers && <section className="panel form-panel page-panel">
        <div className="panel-heading"><div><span className="section-index">ADMINISTRAÇÃO DA EQUIPE</span><h3>Usuários da unidade</h3></div><button className="button button-secondary" onClick={()=>go("dashboard")}>Voltar ao painel</button></div>
        {userResult?.temporary_password && <div className="alert alert-success user-temp"><div><strong>Usuário criado.</strong><br/>Login: {userResult.username}<br/>Senha provisória: {userResult.temporary_password}<br/>Exiba e copie agora; ela não será mostrada novamente.</div><button onClick={()=>setUserResult(null)}><X size={15}/></button></div>}
        <form onSubmit={saveUser}>
          <div className="form-grid">
            <Field label="Nome completo"><input required minLength="3" value={userForm.display_name} onChange={e=>setUserForm(f=>({...f,display_name:e.target.value}))}/></Field>
            <Field label="Matrícula / usuário"><input required inputMode="numeric" value={userForm.employee_number} onChange={e=>setUserForm(f=>({...f,employee_number:e.target.value.replace(/\\D/g,"").slice(0,12)}))}/></Field>
            <Field label="Perfil"><select value={userForm.role} onChange={e=>setUserForm(f=>({...f,role:e.target.value}))}>{roleOptions.filter(r=>membership.role==="admin" || !["admin","management"].includes(r)).map(r=><option key={r} value={r}>{roleLabels[r]}</option>)}</select></Field>
          </div>
          <div className="form-footer"><span>{userForm.user_id ? "Editando usuário existente" : "Uma senha provisória será gerada automaticamente."}</span><div className="form-actions">{userForm.user_id && <button type="button" className="button button-secondary" onClick={()=>setUserForm({user_id:"",display_name:"",employee_number:"",role:"maintenance"})}>Cancelar edição</button>}<button className="button button-primary" disabled={busy}>{userForm.user_id ? "Salvar alterações" : "Criar usuário"} <ArrowRight size={16}/></button></div></div>
        </form>
        <div className="user-list">{staffUsers.map(u=><div className="user-row" key={u.user_id}><div><strong>{u.display_name}</strong><span>Matrícula {u.employee_number || "não informada"} · {roleLabels[u.role] || u.role}</span></div><button className="button button-secondary" onClick={()=>{setUserResult(null);setUserForm({user_id:u.user_id,display_name:u.display_name,employee_number:u.employee_number || "",role:u.role});}}>Editar</button></div>)}</div>
      </section>}
      {page === "dashboard" && session && !membership && <div className="panel access-wait"><ShieldCheck size={28}/><h2>Validando acesso</h2><p>Carregando vínculo com a unidade...</p><button className="button button-secondary" onClick={loadStaffContext}>Tentar novamente</button></div>}
    </main>
    <footer className="footer"><div className="footer-inner"><Brand compact/><span>Central de Manutenção <b>•</b> {selectedStore ? selectedStore.name : "Selecione uma unidade"}</span><span className="footer-status"><i/> SISTEMA EM ESTRUTURAÇÃO</span></div></footer>
  </div>;
}

export default App;