"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownToLine, Bell, Building2, Database, FileText, FlaskConical, LogOut, Plus, RefreshCw, Search, ShieldCheck, Star, TrendingUp, Trash2, GitCompareArrows, Users, Sun, Moon } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/lib/supabase";

type Row = Record<string, string | number | boolean | null | undefined>;
type Tab = "overview" | "13f" | "compare" | "form4" | "clusters" | "fda" | "watchlist" | "alerts";
type WatchItem = { id: string; item_type: string; symbol: string; label: string | null; created_at: string };
type AlertRule = { id: string; ticker: string; min_unique_insiders: number; min_total_value: number; enabled: boolean };
type Cluster = { key: string; ticker: string; company: string; week: string; insiders: string[]; transactions: number; value: number };
const fmt = (value: unknown) => value === null || value === undefined || value === "" ? "—" : String(value);
const money = (value: unknown) => { const n = Number(value); return Number.isFinite(n) ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n) : "—"; };
const date = (value: unknown) => { if (!value) return "—"; const d = new Date(String(value) + (String(value).length === 10 ? "T00:00:00" : "")); return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString(); };
const number = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

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
  const [theme, setTheme] = useState<"dark" | "light">("light");

  useEffect(() => {
    const saved = window.localStorage.getItem("eric-terminal-theme");
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("eric-terminal-theme", theme);
  }, [theme]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [filings, setFilings] = useState<Row[]>([]);
  const [holdings, setHoldings] = useState<Row[]>([]);
  const [insiders, setInsiders] = useState<Row[]>([]);
  const [clearances, setClearances] = useState<Row[]>([]);
  const [counts, setCounts] = useState({ filings: 0, holdings: 0, insiders: 0, clearances: 0 });
  const [watchlist, setWatchlist] = useState<WatchItem[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [watchType, setWatchType] = useState("ticker");
  const [watchSymbol, setWatchSymbol] = useState("");
  const [watchLabel, setWatchLabel] = useState("");
  const [ruleTicker, setRuleTicker] = useState("*");
  const [ruleMinInsiders, setRuleMinInsiders] = useState("3");
  const [ruleMinValue, setRuleMinValue] = useState("0");
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  const loadData = useCallback(async () => {
    if (!supabase || !session) return;
    setLoading(true); setLoadError("");
    const [f, h, i, c, fc, hc, ic, cc, w, r] = await Promise.all([
      supabase.from("institutional_filings").select("*").order("filing_date", { ascending: false }).limit(100),
      supabase.from("institutional_holdings").select("*").order("report_period", { ascending: false }).limit(5000),
      supabase.from("form4_transactions").select("*").order("filing_date", { ascending: false }).limit(2000),
      supabase.from("fda_510k_clearances").select("*").order("decision_date", { ascending: false }).limit(100),
      supabase.from("institutional_filings").select("*", { count: "exact", head: true }),
      supabase.from("institutional_holdings").select("*", { count: "exact", head: true }),
      supabase.from("form4_transactions").select("*", { count: "exact", head: true }),
      supabase.from("fda_510k_clearances").select("*", { count: "exact", head: true }),
      supabase.from("research_watchlist").select("*").order("created_at", { ascending: false }),
      supabase.from("research_alert_rules").select("*").order("created_at", { ascending: false }),
    ]);
    const errors = [f.error, h.error, i.error, c.error, fc.error, hc.error, ic.error, cc.error, w.error, r.error].filter(Boolean);
    if (errors.length) setLoadError(errors[0]?.message ?? "Could not load data. Run the advanced-feature SQL migration and verify authenticated RLS policies.");
    setFilings((f.data ?? []) as Row[]); setHoldings((h.data ?? []) as Row[]); setInsiders((i.data ?? []) as Row[]); setClearances((c.data ?? []) as Row[]);
    setCounts({ filings: fc.count ?? 0, holdings: hc.count ?? 0, insiders: ic.count ?? 0, clearances: cc.count ?? 0 });
    setWatchlist((w.data ?? []) as WatchItem[]); setRules((r.data ?? []) as AlertRule[]);
    setLoading(false);
  }, [session]);

  useEffect(() => { if (session) void loadData(); }, [session, loadData]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filter = (rows: Row[]) => !q ? rows : rows.filter(row => Object.values(row).some(v => String(v ?? "").toLowerCase().includes(q)));
    return { filings: filter(filings), holdings: filter(holdings), insiders: filter(insiders), clearances: filter(clearances) };
  }, [query, filings, holdings, insiders, clearances]);

  const clusters = useMemo<Cluster[]>(() => {
    const map = new Map<string, Cluster>();
    for (const row of insiders) {
      const ticker = String(row.ticker ?? "").toUpperCase();
      const company = String(row.company ?? "Unknown company");
      const week = String(row.week_key ?? row.filing_date ?? "Unknown week");
      const identity = String(row.company_cik ?? ticker ?? company);
      const key = identity + "|" + week;
      const item = map.get(key) ?? { key, ticker, company, week, insiders: [], transactions: 0, value: 0 };
      const insider = String(row.insider ?? "").trim();
      if (insider && !item.insiders.includes(insider)) item.insiders.push(insider);
      item.transactions += 1; item.value += number(row.value);
      map.set(key, item);
    }
    return [...map.values()].filter(x => x.insiders.length >= 2).sort((a,b) => b.insiders.length-a.insiders.length || b.value-a.value);
  }, [insiders]);

  const periods = useMemo(() => [...new Set(holdings.map(h => String(h.report_period ?? "")).filter(Boolean))].sort().reverse(), [holdings]);
  const comparison = useMemo(() => {
    if (periods.length < 2) return [];
    const latest = periods[0], previous = periods[1];
    const key = (r: Row) => [r.cik, r.cusip, r.put_call ?? ""].join("|");
    const oldRows = new Map(holdings.filter(h => String(h.report_period ?? "") === previous).map(h => [key(h), h]));
    const newRows = new Map(holdings.filter(h => String(h.report_period ?? "") === latest).map(h => [key(h), h]));
    const all = new Set([...oldRows.keys(), ...newRows.keys()]);
    return [...all].map(k => {
      const old = oldRows.get(k), current = newRows.get(k), base = current ?? old ?? {};
      const oldShares = number(old?.shares), newShares = number(current?.shares);
      const oldValue = number(old?.value_usd), newValue = number(current?.value_usd);
      const status = !old ? "NEW" : !current ? "EXITED" : newShares > oldShares ? "INCREASED" : newShares < oldShares ? "REDUCED" : "UNCHANGED";
      return { institution_name: base.institution_name, issuer_name: base.issuer_name, cusip: base.cusip, status, old_shares: old ? oldShares : null, new_shares: current ? newShares : null, share_change: current && old ? newShares-oldShares : current ? newShares : -oldShares, old_value: old ? oldValue : null, new_value: current ? newValue : null, value_change: current && old ? newValue-oldValue : current ? newValue : -oldValue, report_period: latest };
    }).sort((a,b) => Math.abs(number(b.value_change))-Math.abs(number(a.value_change)));
  }, [holdings, periods]);

  const triggeredAlerts = useMemo(() => clusters.filter(cluster => rules.some(rule => rule.enabled && (rule.ticker === "*" || rule.ticker.toUpperCase() === cluster.ticker) && cluster.insiders.length >= rule.min_unique_insiders && cluster.value >= number(rule.min_total_value))), [clusters, rules]);

  async function signIn(e: FormEvent) {
    e.preventDefault(); setAuthError("");
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
  }
  async function signOut() { await supabase?.auth.signOut(); setSession(null); }

  async function addWatch(e: FormEvent) {
    e.preventDefault(); if (!supabase || !session || !watchSymbol.trim()) return;
    setActionMessage("");
    const { error } = await supabase.from("research_watchlist").insert({ user_id: session.user.id, item_type: watchType, symbol: watchSymbol.trim().toUpperCase(), label: watchLabel.trim() || null });
    if (error) setActionMessage(error.message); else { setWatchSymbol(""); setWatchLabel(""); setActionMessage("Added to your watchlist."); await loadData(); }
  }
  async function removeWatch(id: string) {
    if (!supabase || !session) return;
    const { error } = await supabase.from("research_watchlist").delete().eq("id", id).eq("user_id", session.user.id);
    setActionMessage(error?.message ?? "Watchlist item removed."); if (!error) await loadData();
  }
  async function addRule(e: FormEvent) {
    e.preventDefault(); if (!supabase || !session) return;
    const ticker = ruleTicker.trim().toUpperCase() || "*";
    const { error } = await supabase.from("research_alert_rules").insert({ user_id: session.user.id, ticker, min_unique_insiders: Math.max(2, Number(ruleMinInsiders) || 3), min_total_value: Math.max(0, Number(ruleMinValue) || 0), enabled: true });
    setActionMessage(error?.message ?? "Alert rule saved."); if (!error) await loadData();
  }
  async function toggleRule(rule: AlertRule) {
    if (!supabase || !session) return;
    const { error } = await supabase.from("research_alert_rules").update({ enabled: !rule.enabled }).eq("id", rule.id).eq("user_id", session.user.id);
    setActionMessage(error?.message ?? "Alert rule updated."); if (!error) await loadData();
  }
  async function deleteRule(id: string) {
    if (!supabase || !session) return;
    const { error } = await supabase.from("research_alert_rules").delete().eq("id", id).eq("user_id", session.user.id);
    setActionMessage(error?.message ?? "Alert rule deleted."); if (!error) await loadData();
  }

  if (!supabaseConfigured) return <main className="setup-screen"><div className="login-card"><p className="eyebrow">ERIC TERMINAL / PRIVATE MARKETS</p><h1>Connect your data layer</h1><p className="muted">Add the Supabase project URL and publishable/anon key to your deployment environment to enable sign-in.</p><div className="notice">Required: <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>. Never use the service-role key in the browser.</div></div></main>;
  if (authLoading) return <main className="setup-screen"><div className="loader"><span className="pulse"/> Establishing secure session…</div></main>;
  if (!session) return <main className="setup-screen"><form className="login-card" onSubmit={signIn}><p className="eyebrow">ERIC TERMINAL / PRIVATE MARKETS</p><h1>Sign in</h1><p className="muted">Access is protected by Supabase authentication and row-level security.</p><label>Email address<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password"/></label>{authError && <p className="error">{authError}</p>}<button className="primary full" type="submit">Sign in securely</button><p className="fine">Create your first user in Supabase Dashboard → Authentication → Users. Disable public sign-ups after setup.</p></form></main>;

  const nav: { id: Tab; label: string; icon: typeof Activity }[] = [{id:"overview",label:"Overview",icon:Activity},{id:"13f",label:"13F Holdings",icon:Building2},{id:"compare",label:"13F Compare",icon:GitCompareArrows},{id:"form4",label:"Insider Activity",icon:TrendingUp},{id:"clusters",label:"Insider Clusters",icon:Users},{id:"fda",label:"FDA 510(k)",icon:FlaskConical},{id:"watchlist",label:"Watchlist",icon:Star},{id:"alerts",label:"Alert Rules",icon:Bell}];
  return <main className="terminal"><aside className="sidebar"><div className="brand"><div><strong>ERIC TERMINAL</strong><span>MARKET INTELLIGENCE</span></div></div><div className="side-label">WORKSPACE</div><nav>{nav.map(n=><button key={n.id} onClick={()=>setTab(n.id)} className={tab===n.id?"nav-item active":"nav-item"}><n.icon size={17}/>{n.label}</button>)}</nav><div className="side-bottom"><div className="secure"><ShieldCheck size={16}/><span>Authenticated session</span></div><button className="nav-item" onClick={signOut}><LogOut size={17}/>Sign out</button></div></aside>
    <section className="main-area"><header className="topbar"><div><p className="eyebrow">MARKET INTELLIGENCE / PRIVATE WORKSPACE</p><h1>{nav.find(n=>n.id===tab)?.label}</h1></div><div className="top-actions"><div className="market-clock">US MARKETS <b>●</b> RESEARCH MODE</div><div className="search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search loaded records…"/></div><button className="icon-button theme-toggle" onClick={()=>setTheme(theme==="dark"?"light":"dark")} aria-label={"Switch to "+(theme==="dark"?"light":"dark")+" mode"} title={theme==="dark"?"Switch to light mode":"Switch to dark mode"}>{theme==="dark"?<Sun size={17}/>:<Moon size={17}/>}</button><button className="icon-button" onClick={()=>void loadData()} disabled={loading} aria-label="Refresh data"><RefreshCw size={17} className={loading?"spin":""}/></button><span className="live"><i/> LIVE DATA</span></div></header>
    {loadError && <div className="error-banner">{loadError}</div>}{actionMessage && <div className="notice action-notice">{actionMessage}</div>}
    {tab==="overview" && <><div className="welcome"><div><span className="eyebrow">YOUR MARKET INTELLIGENCE WORKSPACE</span><h2>See the market from every angle.</h2><p>Institutional positioning, insider activity, and FDA device clearances — unified in one research terminal.</p></div><div className="status-chip"><span/> PIPELINES CONNECTED</div></div><div className="metrics"><Metric icon={FileText} label="13F FILINGS" value={counts.filings} note="Institutional disclosures"/><Metric icon={Building2} label="HOLDING ROWS" value={counts.holdings} note="Reported positions"/><Metric icon={TrendingUp} label="FORM 4 TRANSACTIONS" value={counts.insiders} note="Insider transactions"/><Metric icon={FlaskConical} label="FDA CLEARANCES" value={counts.clearances} note="510(k) decisions"/></div><div className="insight-strip"><div><strong>{clusters.length}</strong><span>multi-insider company-weeks detected</span></div><div><strong>{triggeredAlerts.length}</strong><span>active alert matches</span></div><div><strong>{watchlist.length}</strong><span>saved watchlist items</span></div></div><div className="section-heading"><div><h3>Latest insider transactions</h3><p>Most recently filed Form 4 records</p></div><button className="text-button" onClick={()=>setTab("form4")}>View all →</button></div><DataTable rows={filtered.insiders.slice(0,8)} columns={[{key:"filing_date",label:"FILED",date:true},{key:"ticker",label:"TICKER"},{key:"company",label:"COMPANY"},{key:"insider",label:"INSIDER"},{key:"title",label:"ROLE"},{key:"transaction_date",label:"TRADE DATE",date:true},{key:"value",label:"VALUE",money:true}]} empty="No Form 4 records found."/></>}
    {tab==="13f" && <><div className="metrics compact"><Metric icon={FileText} label="FILINGS" value={counts.filings} note="Total ingested"/><Metric icon={Building2} label="HOLDINGS" value={counts.holdings} note="Total ingested"/></div><div className="section-heading"><div><h3>Institutional filings</h3><p>Latest filings ingested</p></div><ExportButton rows={filtered.filings} filename="institutional-filings.csv"/></div><DataTable rows={filtered.filings} columns={[{key:"filing_date",label:"FILED",date:true},{key:"institution_name",label:"INSTITUTION"},{key:"cik",label:"CIK"},{key:"report_period",label:"REPORT PERIOD",date:true},{key:"holdings_count",label:"POSITIONS"},{key:"total_value_usd",label:"PORTFOLIO VALUE",money:true},{key:"accession",label:"ACCESSION"}]} empty="No institutional filings found."/><div className="section-heading spaced"><div><h3>Reported positions</h3><p>Latest 5,000 holding rows · search loaded records</p></div><ExportButton rows={filtered.holdings} filename="institutional-holdings.csv"/></div><DataTable rows={filtered.holdings.slice(0,500)} columns={[{key:"institution_name",label:"INSTITUTION"},{key:"issuer_name",label:"ISSUER"},{key:"cusip",label:"CUSIP"},{key:"value_usd",label:"VALUE",money:true},{key:"shares",label:"SHARES"},{key:"put_call",label:"TYPE"},{key:"report_period",label:"PERIOD",date:true}]} empty="No institutional holdings found."/></>}
    {tab==="compare" && <><div className="welcome"><div><span className="eyebrow">QUARTER-OVER-QUARTER ANALYSIS</span><h2>Institutional position changes</h2><p>Compares the two most recent report periods available in your loaded holdings.</p></div><div className="status-chip">{periods.length>=2?periods[1]+" → "+periods[0]:"NEED 2 REPORT PERIODS"}</div></div>{periods.length<2?<div className="empty">At least two distinct 13F report periods are needed to calculate changes.</div>:<><div className="insight-strip"><div><strong>{comparison.filter(x=>x.status==="NEW").length}</strong><span>new positions</span></div><div><strong>{comparison.filter(x=>x.status==="EXITED").length}</strong><span>exited positions</span></div><div><strong>{comparison.filter(x=>x.status==="INCREASED").length}</strong><span>increased positions</span></div><div><strong>{comparison.filter(x=>x.status==="REDUCED").length}</strong><span>reduced positions</span></div></div><div className="section-heading"><div><h3>Position deltas</h3><p>Matched by institution CIK, CUSIP and put/call designation · limited to loaded 5,000 rows</p></div><ExportButton rows={comparison as unknown as Row[]} filename="13f-quarterly-comparison.csv"/></div><DataTable rows={(comparison as unknown as Row[]).filter(r=>!query || Object.values(r).some(v=>String(v??"").toLowerCase().includes(query.toLowerCase())))} columns={[{key:"institution_name",label:"INSTITUTION"},{key:"issuer_name",label:"ISSUER"},{key:"cusip",label:"CUSIP"},{key:"status",label:"CHANGE"},{key:"old_shares",label:"PRIOR SHARES"},{key:"new_shares",label:"LATEST SHARES"},{key:"share_change",label:"Δ SHARES"},{key:"old_value",label:"PRIOR VALUE",money:true},{key:"new_value",label:"LATEST VALUE",money:true},{key:"value_change",label:"Δ VALUE",money:true}]} empty="No positions match the current search."/></>}</>}
    {tab==="form4" && <><div className="metrics compact"><Metric icon={TrendingUp} label="TRANSACTIONS" value={counts.insiders} note="Total ingested"/></div><div className="section-heading"><div><h3>SEC Form 4 activity</h3><p>Latest 2,000 records loaded</p></div><ExportButton rows={filtered.insiders} filename="form4-transactions.csv"/></div><DataTable rows={filtered.insiders} columns={[{key:"filing_date",label:"FILED",date:true},{key:"ticker",label:"TICKER"},{key:"company",label:"COMPANY"},{key:"insider",label:"INSIDER"},{key:"title",label:"ROLE"},{key:"transaction_date",label:"TRADE DATE",date:true},{key:"shares",label:"SHARES"},{key:"price",label:"PRICE",money:true},{key:"value",label:"VALUE",money:true},{key:"week_key",label:"WEEK"}]} empty="No insider transactions found."/></>}
    {tab==="clusters" && <><div className="welcome"><div><span className="eyebrow">CONCENTRATED INSIDER ACTIVITY</span><h2>Multi-insider company-weeks</h2><p>Groups Form 4 filings by issuer and reporting week, counting distinct insiders.</p></div><div className="status-chip">{clusters.length} GROUPS</div></div><div className="notice">A cluster is a research signal, not proof of coordinated buying or a bullish signal. Your current source schema does not include transaction codes, so these groups do not distinguish purchases from sales.</div><div className="section-heading"><div><h3>Detected clusters</h3><p>Based on latest 2,000 Form 4 records</p></div><ExportButton rows={clusters as unknown as Row[]} filename="insider-clusters.csv"/></div><DataTable rows={(clusters as unknown as Row[]).filter(r=>!query || Object.values(r).some(v=>String(v??"").toLowerCase().includes(query.toLowerCase())))} columns={[{key:"ticker",label:"TICKER"},{key:"company",label:"COMPANY"},{key:"week",label:"WEEK"},{key:"insiders",label:"DISTINCT INSIDERS"},{key:"transactions",label:"FILINGS"},{key:"value",label:"AGGREGATE REPORTED VALUE",money:true}]} empty="No multi-insider company-weeks found in the loaded records."/></>}
    {tab==="fda" && <><div className="metrics compact"><Metric icon={FlaskConical} label="510(K) CLEARANCES" value={counts.clearances} note="Total ingested"/></div><div className="section-heading"><div><h3>FDA device clearances</h3><p>510(k) decisions · latest 100 records</p></div><ExportButton rows={filtered.clearances} filename="fda-510k-clearances.csv"/></div><DataTable rows={filtered.clearances} columns={[{key:"decision_date",label:"DECISION",date:true},{key:"k_number",label:"K NUMBER"},{key:"applicant",label:"APPLICANT"},{key:"device_name",label:"DEVICE"},{key:"product_code",label:"PRODUCT CODE"},{key:"decision_code",label:"CODE"},{key:"decision_description",label:"DECISION"},{key:"device_class",label:"CLASS"},{key:"country",label:"COUNTRY"}]} empty="No FDA clearances found."/></>}
    {tab==="watchlist" && <><div className="welcome"><div><span className="eyebrow">PERSONAL RESEARCH TRACKER</span><h2>Your watchlist</h2><p>Saved tickers, companies, FDA product codes or other identifiers.</p></div><div className="status-chip">{watchlist.length} SAVED ITEMS</div></div><form className="inline-form" onSubmit={addWatch}><select value={watchType} onChange={e=>setWatchType(e.target.value)}><option value="ticker">Ticker</option><option value="company">Company</option><option value="product_code">FDA product code</option><option value="cusip">CUSIP</option></select><input required value={watchSymbol} onChange={e=>setWatchSymbol(e.target.value)} placeholder="Symbol / identifier"/><input value={watchLabel} onChange={e=>setWatchLabel(e.target.value)} placeholder="Label (optional)"/><button className="primary" type="submit"><Plus size={15}/> Add item</button></form><div className="watch-grid">{watchlist.map(item=><div className="watch-card" key={item.id}><div><span className="watch-type">{item.item_type.replace("_"," ")}</span><strong>{item.symbol}</strong><small>{item.label || "No description"}</small></div><button className="icon-button danger" onClick={()=>void removeWatch(item.id)} aria-label={"Remove "+item.symbol}><Trash2 size={15}/></button></div>)}</div>{!watchlist.length && <div className="empty">Your watchlist is empty. Add an identifier above to start tracking it.</div>}</>}
    {tab==="alerts" && <><div className="welcome"><div><span className="eyebrow">RULE-BASED RESEARCH SIGNALS</span><h2>Insider cluster alerts</h2><p>Define thresholds and review matches in your loaded Form 4 records.</p></div><div className="status-chip">{triggeredAlerts.length} MATCHES</div></div><div className="notice">Alerts are evaluated when the dashboard loads or refreshes; they do not send email, push or Discord notifications. A ticker of * applies the rule to all companies. Cluster data does not identify transaction codes (buy vs. sell).</div><form className="inline-form" onSubmit={addRule}><input value={ruleTicker} onChange={e=>setRuleTicker(e.target.value)} placeholder="Ticker or * for all"/><label className="field-label">Min insiders<input type="number" min="2" value={ruleMinInsiders} onChange={e=>setRuleMinInsiders(e.target.value)}/></label><label className="field-label">Min aggregate value ($)<input type="number" min="0" value={ruleMinValue} onChange={e=>setRuleMinValue(e.target.value)}/></label><button className="primary" type="submit"><Plus size={15}/> Save rule</button></form><div className="section-heading"><div><h3>Your rules</h3><p>Private to your authenticated account</p></div></div><div className="rules-list">{rules.map(rule=><div className="rule-row" key={rule.id}><div><strong>{rule.ticker==="*"?"All tickers":rule.ticker}</strong><small>{rule.min_unique_insiders}+ distinct insiders · minimum {money(rule.min_total_value)} reported value</small></div><span className={rule.enabled?"rule-enabled":"rule-disabled"}>{rule.enabled?"ENABLED":"PAUSED"}</span><button className="outline-button" onClick={()=>void toggleRule(rule)}>{rule.enabled?"Pause":"Enable"}</button><button className="icon-button danger" onClick={()=>void deleteRule(rule.id)} aria-label="Delete rule"><Trash2 size={15}/></button></div>)}</div>{!rules.length && <div className="empty">No alert rules yet. Add a rule above; the default threshold is 3 distinct insiders.</div>}<div className="section-heading spaced"><div><h3>Current alert matches</h3><p>Signals that meet at least one enabled rule</p></div></div><DataTable rows={triggeredAlerts as unknown as Row[]} columns={[{key:"ticker",label:"TICKER"},{key:"company",label:"COMPANY"},{key:"week",label:"WEEK"},{key:"insiders",label:"DISTINCT INSIDERS"},{key:"transactions",label:"FILINGS"},{key:"value",label:"REPORTED VALUE",money:true}]} empty="No current clusters match your enabled rules."/></>}
    <footer><span>ERIC TERMINAL · PRIVATE</span><span>Latest source records loaded · <button onClick={()=>void loadData()} className="footer-refresh">Refresh now</button></span></footer></section></main>;
}

function Metric({icon:Icon,label,value,note}:{icon:typeof Activity;label:string;value:number;note:string}) { return <div className="metric"><div className="metric-top"><span>{label}</span><Icon size={17}/></div><strong>{value.toLocaleString()}</strong><small>{note}</small></div>; }
function ExportButton({rows,filename}:{rows:Row[];filename:string}) { function exportRows(){ if(!rows.length)return; const keys=Array.from(new Set(rows.flatMap(r=>Object.keys(r)))); const cell=(v:unknown)=>'"'+String(Array.isArray(v)?v.join("; "):v??"").replace(/"/g,'""')+'"'; const csv=[keys.map(cell).join(","),...rows.map(r=>keys.map(k=>cell(r[k])).join(","))].join("\n"); const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"}); const url=URL.createObjectURL(blob); const a=document.createElement("a");a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url); } return <button className="outline-button" onClick={exportRows}><ArrowDownToLine size={15}/> Export CSV</button>; }
