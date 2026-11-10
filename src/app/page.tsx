"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownToLine, Building2, Database, FileText, FlaskConical, LogOut, RefreshCw, Search, ShieldCheck, TrendingUp } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/lib/supabase";

type Row = Record<string, string | number | boolean | null | undefined>;
type Tab = "overview" | "13f" | "form4" | "fda";
const fmt = (value: unknown) => value === null || value === undefined || value === "" ? "—" : String(value);
const money = (value: unknown) => { const n = Number(value); return Number.isFinite(n) ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n) : "—"; };
const date = (value: unknown) => { if (!value) return "—"; const d = new Date(String(value) + (String(value).length === 10 ? "T00:00:00" : "")); return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString(); };

function DataTable({ rows, columns, empty }: { rows: Row[]; columns: { key: string; label: string; money?: boolean; date?: boolean }[]; empty: string }) {
  if (!rows.length) return <div className="empty"><Database size={20}/><span>{empty}</span></div>;
  return <div className="table-wrap"><table><thead><tr>{columns.map(c => <th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={String(row.id ?? row.accession ?? row.k_number ?? row.transaction_key ?? i)}>{columns.map(c => <td key={c.key}>{c.money ? money(row[c.key]) : c.date ? date(row[c.key]) : fmt(row[c.key])}</td>)}</tr>)}</tbody></table></div>;
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [filings, setFilings] = useState<Row[]>([]);
  const [holdings, setHoldings] = useState<Row[]>([]);
  const [insiders, setInsiders] = useState<Row[]>([]);
  const [clearances, setClearances] = useState<Row[]>([]);
  const [counts, setCounts] = useState({ filings: 0, holdings: 0, insiders: 0, clearances: 0 });

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  const loadData = useCallback(async () => {
    if (!supabase || !session) return;
    setLoading(true); setLoadError("");
    const [f, h, i, c, fc, hc, ic, cc] = await Promise.all([
      supabase.from("institutional_filings").select("*").order("filing_date", { ascending: false }).limit(100),
      supabase.from("institutional_holdings").select("*").order("value_usd", { ascending: false }).limit(100),
      supabase.from("form4_transactions").select("*").order("filing_date", { ascending: false }).limit(100),
      supabase.from("fda_510k_clearances").select("*").order("decision_date", { ascending: false }).limit(100),
      supabase.from("institutional_filings").select("*", { count: "exact", head: true }),
      supabase.from("institutional_holdings").select("*", { count: "exact", head: true }),
      supabase.from("form4_transactions").select("*", { count: "exact", head: true }),
      supabase.from("fda_510k_clearances").select("*", { count: "exact", head: true }),
    ]);
    const errors = [f.error, h.error, i.error, c.error, fc.error, hc.error, ic.error, cc.error].filter(Boolean);
    if (errors.length) setLoadError(errors[0]?.message ?? "Could not load Supabase data.");
    setFilings((f.data ?? []) as Row[]); setHoldings((h.data ?? []) as Row[]); setInsiders((i.data ?? []) as Row[]); setClearances((c.data ?? []) as Row[]);
    setCounts({ filings: fc.count ?? 0, holdings: hc.count ?? 0, insiders: ic.count ?? 0, clearances: cc.count ?? 0 });
    setLoading(false);
  }, [session]);

  useEffect(() => { if (session) void loadData(); }, [session, loadData]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filter = (rows: Row[]) => !q ? rows : rows.filter(row => Object.values(row).some(v => String(v ?? "").toLowerCase().includes(q)));
    return { filings: filter(filings), holdings: filter(holdings), insiders: filter(insiders), clearances: filter(clearances) };
  }, [query, filings, holdings, insiders, clearances]);

  async function signIn(e: FormEvent) {
    e.preventDefault(); setAuthError("");
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
  }
  async function signOut() { await supabase?.auth.signOut(); setSession(null); }

  if (!supabaseConfigured) return <main className="setup-screen"><div className="login-card"><div className="brand-mark"><Activity/></div><p className="eyebrow">PRIVATE RESEARCH TERMINAL</p><h1>Connect your data layer</h1><p className="muted">Add the Supabase project URL and publishable/anon key to your deployment environment to enable sign-in.</p><div className="notice">Required: <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>. Never use the service-role key in the browser.</div></div></main>;
  if (authLoading) return <main className="setup-screen"><div className="loader"><span className="pulse"/> Establishing secure session…</div></main>;
  if (!session) return <main className="setup-screen"><form className="login-card" onSubmit={signIn}><div className="brand-mark"><Activity/></div><p className="eyebrow">PRIVATE RESEARCH TERMINAL</p><h1>Sign in</h1><p className="muted">Access is protected by Supabase authentication and row-level security.</p><label>Email address<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password"/></label>{authError && <p className="error">{authError}</p>}<button className="primary full" type="submit">Sign in securely</button><p className="fine">Create your first user in Supabase Dashboard → Authentication → Users. Disable public sign-ups after setup.</p></form></main>;

  const nav: { id: Tab; label: string; icon: typeof Activity }[] = [{id:"overview",label:"Overview",icon:Activity},{id:"13f",label:"13F Holdings",icon:Building2},{id:"form4",label:"Insider Activity",icon:TrendingUp},{id:"fda",label:"FDA 510(k)",icon:FlaskConical}];
  return <main className="terminal"><aside className="sidebar"><div className="brand"><div className="brand-mark small"><Activity/></div><div><strong>FIN INTEL</strong><span>PRIVATE TERMINAL</span></div></div><div className="side-label">WORKSPACE</div><nav>{nav.map(n=><button key={n.id} onClick={()=>setTab(n.id)} className={tab===n.id?"nav-item active":"nav-item"}><n.icon size={17}/>{n.label}</button>)}</nav><div className="side-bottom"><div className="secure"><ShieldCheck size={16}/><span>Authenticated session</span></div><button className="nav-item" onClick={signOut}><LogOut size={17}/>Sign out</button></div></aside>
    <section className="main-area"><header className="topbar"><div><p className="eyebrow">MARKET INTELLIGENCE / PRIVATE WORKSPACE</p><h1>{nav.find(n=>n.id===tab)?.label}</h1></div><div className="top-actions"><div className="search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search loaded records…"/></div><button className="icon-button" onClick={()=>void loadData()} disabled={loading} aria-label="Refresh data"><RefreshCw size={17} className={loading?"spin":""}/></button><span className="live"><i/> LIVE DATA</span></div></header>
    {loadError && <div className="error-banner">{loadError} — check that the tables exist and authenticated read policies are enabled.</div>}
    {tab==="overview" && <><div className="welcome"><div><span className="eyebrow">SYSTEM STATUS</span><h2>Your research, unified.</h2><p>Live records ingested from your three private GitHub trackers.</p></div><div className="status-chip"><span/> PIPELINES CONNECTED</div></div><div className="metrics"><Metric icon={FileText} label="13F FILINGS" value={counts.filings} note="Institutional disclosures"/><Metric icon={Building2} label="HOLDING ROWS" value={counts.holdings} note="Reported positions"/><Metric icon={TrendingUp} label="FORM 4 TRANSACTIONS" value={counts.insiders} note="Insider transactions"/><Metric icon={FlaskConical} label="FDA CLEARANCES" value={counts.clearances} note="510(k) decisions"/></div><div className="section-heading"><div><h3>Latest insider transactions</h3><p>Most recently filed Form 4 records</p></div><button className="text-button" onClick={()=>setTab("form4")}>View all <span>→</span></button></div><DataTable rows={filtered.insiders.slice(0,8)} columns={[{key:"filing_date",label:"FILED",date:true},{key:"ticker",label:"TICKER"},{key:"company",label:"COMPANY"},{key:"insider",label:"INSIDER"},{key:"title",label:"ROLE"},{key:"transaction_date",label:"TRADE DATE",date:true},{key:"value",label:"VALUE",money:true}]} empty="No Form 4 records found."/></>}
    {tab==="13f" && <><div className="metrics compact"><Metric icon={FileText} label="FILINGS" value={counts.filings} note="Total ingested"/><Metric icon={Building2} label="HOLDINGS" value={counts.holdings} note="Total ingested"/></div><div className="section-heading"><div><h3>Institutional filings</h3><p>Latest 100 filings · search across loaded records</p></div><ExportButton rows={filtered.filings} filename="institutional-filings.csv"/></div><DataTable rows={filtered.filings} columns={[{key:"filing_date",label:"FILED",date:true},{key:"institution_name",label:"INSTITUTION"},{key:"cik",label:"CIK"},{key:"report_period",label:"REPORT PERIOD",date:true},{key:"holdings_count",label:"POSITIONS"},{key:"total_value_usd",label:"PORTFOLIO VALUE",money:true},{key:"accession",label:"ACCESSION"}]} empty="No institutional filings found."/><div className="section-heading spaced"><div><h3>Reported positions</h3><p>Largest values among the latest 100 holding rows</p></div><ExportButton rows={filtered.holdings} filename="institutional-holdings.csv"/></div><DataTable rows={filtered.holdings} columns={[{key:"institution_name",label:"INSTITUTION"},{key:"issuer_name",label:"ISSUER"},{key:"cusip",label:"CUSIP"},{key:"value_usd",label:"VALUE",money:true},{key:"shares",label:"SHARES"},{key:"put_call",label:"TYPE"},{key:"report_period",label:"PERIOD",date:true}]} empty="No institutional holdings found."/></>}
    {tab==="form4" && <><div className="metrics compact"><Metric icon={TrendingUp} label="TRANSACTIONS" value={counts.insiders} note="Total ingested"/></div><div className="section-heading"><div><h3>SEC Form 4 activity</h3><p>Insider transaction feed · latest 100 records</p></div><ExportButton rows={filtered.insiders} filename="form4-transactions.csv"/></div><DataTable rows={filtered.insiders} columns={[{key:"filing_date",label:"FILED",date:true},{key:"ticker",label:"TICKER"},{key:"company",label:"COMPANY"},{key:"insider",label:"INSIDER"},{key:"title",label:"ROLE"},{key:"transaction_date",label:"TRADE DATE",date:true},{key:"shares",label:"SHARES"},{key:"price",label:"PRICE",money:true},{key:"value",label:"VALUE",money:true},{key:"week_key",label:"WEEK"}]} empty="No insider transactions found."/></>}
    {tab==="fda" && <><div className="metrics compact"><Metric icon={FlaskConical} label="510(K) CLEARANCES" value={counts.clearances} note="Total ingested"/></div><div className="section-heading"><div><h3>FDA device clearances</h3><p>510(k) decisions · latest 100 records</p></div><ExportButton rows={filtered.clearances} filename="fda-510k-clearances.csv"/></div><DataTable rows={filtered.clearances} columns={[{key:"decision_date",label:"DECISION",date:true},{key:"k_number",label:"K NUMBER"},{key:"applicant",label:"APPLICANT"},{key:"device_name",label:"DEVICE"},{key:"product_code",label:"PRODUCT CODE"},{key:"decision_code",label:"CODE"},{key:"decision_description",label:"DECISION"},{key:"device_class",label:"CLASS"},{key:"country",label:"COUNTRY"}]} empty="No FDA clearances found."/></>}
    <footer><span>FIN INTEL TERMINAL · PRIVATE</span><span>Showing up to 100 rows per data source · <button onClick={()=>void loadData()} className="footer-refresh">Refresh now</button></span></footer></section></main>;
}

function Metric({icon:Icon,label,value,note}:{icon:typeof Activity;label:string;value:number;note:string}) { return <div className="metric"><div className="metric-top"><span>{label}</span><Icon size={17}/></div><strong>{value.toLocaleString()}</strong><small>{note}</small></div>; }
function ExportButton({rows,filename}:{rows:Row[];filename:string}) { function exportRows(){ if(!rows.length)return; const keys=Array.from(new Set(rows.flatMap(r=>Object.keys(r)))); const cell=(v:unknown)=>'"'+String(v??"").replaceAll('"','""')+'"'; const csv=[keys.map(cell).join(","),...rows.map(r=>keys.map(k=>cell(r[k])).join(","))].join("\n"); const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"}); const url=URL.createObjectURL(blob); const a=document.createElement("a");a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url); } return <button className="outline-button" onClick={exportRows}><ArrowDownToLine size={15}/> Export CSV</button>; }
