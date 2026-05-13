import { useEffect, useMemo, useState } from "react";
import axios from "axios";

/* ============================================================
   API
   ============================================================ */

const TENANT_ID = "demo-tenant";

const api = axios.create({
  baseURL: "/api",
  headers: {
    "X-Tenant-ID": TENANT_ID,
    "Content-Type": "application/json",
  },
});

/* ============================================================
   Types
   ============================================================ */

type Kind = "llm" | "transform" | "router" | "component";
type Tab = "overview" | "catalog" | "builder" | "runs";

interface Component {
  id: string;
  name: string;
  kind: Kind;
  version: string;
  runtime_mode: string;
  config: Record<string, any>;
  is_public: boolean;
  created_at?: string;
}

interface Workflow {
  id: string;
  name: string;
  definition: {
    nodes: { id: string; type: Kind; component_id?: string; config?: any }[];
    edges: { from: string; to: string }[];
  };
  created_at?: string;
}

interface RunRecord {
  run_id: string;
  workflow_id: string;
  workflow_name: string;
  started_at: string;
  status?: string;
  output?: any;
  error?: string;
}

interface BuilderStep {
  uid: string;
  kind: Kind;
  component_id?: string;
  label: string;
  config?: Record<string, any>;
}

interface TemplateStep {
  kind: Kind;
  componentName?: string;          // refers to a sample component to find-or-create
  componentConfig?: Record<string, any>;
  componentRuntime?: string;
  builtinConfig?: Record<string, any>;
  label: string;
}

interface SolutionTemplate {
  slug: string;
  name: string;
  icon: string;
  description: string;
  steps: TemplateStep[];
}

/* ============================================================
   Helpers
   ============================================================ */

const uid = () => Math.random().toString(36).slice(2, 9);
const short = (s?: string, n = 8) => (s ? s.slice(0, n) : "—");
const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "solution";

const fmt = (iso?: string) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
};

const downloadJSON = (filename: string, data: any) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const estimateSize = (data: any) => {
  const bytes = new Blob([JSON.stringify(data, null, 2)]).size;
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
};

/* ============================================================
   Seed data
   ============================================================ */

const SAMPLE_COMPONENTS: Omit<Component, "id">[] = [
  { name: "Invoice OCR",          kind: "component", version: "1.0.0", runtime_mode: "local",  config: { engine: "tesseract", languages: ["en"] }, is_public: true },
  { name: "Summarizer (LLM)",     kind: "llm",       version: "1.0.0", runtime_mode: "cloud",  config: { provider: "openai", model: "gpt-4o-mini" }, is_public: true },
  { name: "Entity Tagger",        kind: "transform", version: "0.3.0", runtime_mode: "hybrid", config: { rules: "default" }, is_public: true },
  { name: "Compliance Router",    kind: "router",    version: "0.2.1", runtime_mode: "local",  config: { policy: "redact-pii" }, is_public: false },
  { name: "Sentiment Classifier", kind: "llm",       version: "0.5.0", runtime_mode: "hybrid", config: { provider: "anthropic", model: "claude-haiku" }, is_public: true },
  { name: "PII Redactor",         kind: "transform", version: "1.2.0", runtime_mode: "local",  config: { strategy: "regex+ner" }, is_public: true },
];

const SOLUTION_TEMPLATES: SolutionTemplate[] = [
  {
    slug: "invoice-intake",
    name: "Invoice Intake",
    icon: "I",
    description: "Extract text from scanned invoices, tag fields, summarize for human review.",
    steps: [
      { kind: "component", componentName: "Invoice OCR", componentConfig: { engine: "tesseract", languages: ["en"] }, componentRuntime: "local",  label: "Invoice OCR" },
      { kind: "component", componentName: "Entity Tagger", componentConfig: { rules: "default" }, componentRuntime: "hybrid", label: "Entity Tagger" },
      { kind: "component", componentName: "Summarizer (LLM)", componentConfig: { provider: "openai", model: "gpt-4o-mini" }, componentRuntime: "cloud", label: "Summarizer (LLM)" },
    ],
  },
  {
    slug: "support-triage",
    name: "Support Ticket Triage",
    icon: "S",
    description: "Classify incoming tickets by sentiment, route urgent ones, draft a reply.",
    steps: [
      { kind: "component", componentName: "Sentiment Classifier", componentConfig: { provider: "anthropic", model: "claude-haiku" }, componentRuntime: "hybrid", label: "Sentiment Classifier" },
      { kind: "component", componentName: "Compliance Router", componentConfig: { policy: "urgency" }, componentRuntime: "local", label: "Compliance Router" },
      { kind: "component", componentName: "Summarizer (LLM)", componentConfig: { provider: "openai", model: "gpt-4o-mini" }, componentRuntime: "cloud", label: "Draft Reply (LLM)" },
    ],
  },
  {
    slug: "doc-redaction",
    name: "Document Redaction",
    icon: "R",
    description: "Strip personal information from documents before they leave your environment.",
    steps: [
      { kind: "component", componentName: "Invoice OCR", componentConfig: { engine: "tesseract", languages: ["en"] }, componentRuntime: "local", label: "Document OCR" },
      { kind: "component", componentName: "PII Redactor", componentConfig: { strategy: "regex+ner" }, componentRuntime: "local", label: "PII Redactor" },
      { kind: "transform", builtinConfig: { result: { status: "redacted" } }, label: "Finalize" },
    ],
  },
];

/* ============================================================
   Small components
   ============================================================ */

function StatusPill({ status }: { status?: string }) {
  const s = (status || "unknown").toLowerCase();
  const known = ["queued", "running", "succeeded", "failed"].includes(s) ? s : "";
  return (
    <span className={`pill ${known}`}>
      <span className={`dot ${known === "running" ? "running" : ""}`} />
      {s}
    </span>
  );
}

function KindChip({ kind }: { kind: Kind }) {
  return <span className={`kind-chip ${kind}`}>{kind}</span>;
}

function Toast({
  toast, onClose,
}: {
  toast: { kind: "info" | "error"; title: string; msg?: string } | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, toast.kind === "error" ? 6000 : 3500);
    return () => clearTimeout(t);
  }, [toast, onClose]);
  if (!toast) return null;
  const glyph = toast.kind === "error" ? "!" : "✓";
  return (
    <div className={`toast ${toast.kind === "error" ? "error" : ""}`} onClick={onClose}>
      <div className="glyph">{glyph}</div>
      <div>
        <div className="title">{toast.title}</div>
        {toast.msg && <div className="msg">{toast.msg}</div>}
      </div>
    </div>
  );
}

/* ---------- Animated overview diagram ---------- */

function FlowDiagram() {
  // Three input services flow into a central "solution" → output.
  // Pure CSS-free SVG with subtle animation via SMIL/style.
  return (
    <svg viewBox="0 0 520 320" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="line-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#b45309" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#b45309" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="line-grad-2" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0f766e" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#0f766e" stopOpacity="0.15" />
        </linearGradient>
        <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.6" />
        </filter>
      </defs>

      {/* Connector paths */}
      <path d="M 130 70  C 200 70, 240 160, 270 160" stroke="url(#line-grad)" strokeWidth="1.5" fill="none" />
      <path d="M 130 160 C 200 160, 240 160, 270 160" stroke="url(#line-grad)" strokeWidth="1.5" fill="none" />
      <path d="M 130 250 C 200 250, 240 160, 270 160" stroke="url(#line-grad)" strokeWidth="1.5" fill="none" />
      <path d="M 350 160 C 410 160, 440 160, 480 160" stroke="url(#line-grad-2)" strokeWidth="1.5" fill="none" />

      {/* Flowing dots on each path */}
      {[
        { d: "M 130 70  C 200 70, 240 160, 270 160", dur: "3.2s", delay: "0s" },
        { d: "M 130 160 C 200 160, 240 160, 270 160", dur: "2.6s", delay: "0.4s" },
        { d: "M 130 250 C 200 250, 240 160, 270 160", dur: "3.5s", delay: "0.9s" },
      ].map((p, i) => (
        <circle key={i} r="2.4" fill="#b45309">
          <animateMotion dur={p.dur} repeatCount="indefinite" begin={p.delay} path={p.d} />
        </circle>
      ))}
      <circle r="2.4" fill="#0f766e">
        <animateMotion dur="2s" repeatCount="indefinite" begin="0.2s"
          path="M 350 160 C 410 160, 440 160, 480 160" />
      </circle>

      {/* Service nodes */}
      {[
        { x: 30, y: 50, label: "LLM",       sub: "Summarize",  fill: "#d2ebef", stroke: "#0e7490" },
        { x: 30, y: 140, label: "Transform", sub: "Tag entities", fill: "#e6dffb", stroke: "#6d28d9" },
        { x: 30, y: 230, label: "Router",    sub: "Policy check", fill: "#f5e6c3", stroke: "#a16207" },
      ].map((n, i) => (
        <g key={i}>
          <rect x={n.x} y={n.y} width="100" height="40" rx="6" fill={n.fill} stroke={n.stroke} strokeWidth="1" />
          <text x={n.x + 12} y={n.y + 17} fontFamily="Geist Mono, monospace" fontSize="9" fill={n.stroke} letterSpacing="0.1em">{n.label.toUpperCase()}</text>
          <text x={n.x + 12} y={n.y + 30} fontFamily="Geist, sans-serif" fontSize="11" fill="#1a1715">{n.sub}</text>
        </g>
      ))}

      {/* Solution node — center */}
      <rect x="270" y="125" width="80" height="70" rx="8" fill="#fdfaf3" stroke="#1a1715" strokeWidth="1.5" filter="url(#soft)" />
      <rect x="270" y="125" width="80" height="70" rx="8" fill="#fdfaf3" stroke="#1a1715" strokeWidth="1.5" />
      <text x="310" y="155" fontFamily="Fraunces, serif" fontSize="14" fill="#1a1715" textAnchor="middle" fontWeight="500">Solution</text>
      <text x="310" y="173" fontFamily="Geist Mono, monospace" fontSize="9" fill="#8a8276" textAnchor="middle" letterSpacing="0.1em">WORKFLOW</text>
      <line x1="280" y1="183" x2="340" y2="183" stroke="#e2d9c5" strokeWidth="1" />

      {/* Output bundle */}
      <rect x="445" y="140" width="60" height="40" rx="6" fill="#fbe7c9" stroke="#b45309" strokeWidth="1.5" />
      <text x="475" y="158" fontFamily="Geist Mono, monospace" fontSize="9" fill="#b45309" textAnchor="middle" letterSpacing="0.12em">EXPORT</text>
      <text x="475" y="171" fontFamily="Geist, sans-serif" fontSize="10" fill="#1a1715" textAnchor="middle">.json bundle</text>
    </svg>
  );
}

/* ============================================================
   Sidebar
   ============================================================ */

const TAB_META: Record<Tab, { label: string; glyph: string }> = {
  overview: { label: "Overview",         glyph: "○" },
  catalog:  { label: "Service Catalog",  glyph: "◇" },
  builder:  { label: "Solution Builder", glyph: "△" },
  runs:     { label: "Runs",             glyph: "▷" },
};

function Sidebar({
  tab, setTab, counts, hasComponents, onOpenTemplates,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  counts: { components: number; workflows: number; runs: number };
  hasComponents: boolean;
  onOpenTemplates: () => void;
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="dot" />
        Orchestrator
      </div>
      <span className="tag">AI workflow platform</span>

      <nav>
        {(["overview", "catalog", "builder", "runs"] as Tab[]).map(t => {
          const meta = TAB_META[t];
          const num = t === "catalog" ? counts.components :
                       t === "builder" ? counts.workflows :
                       t === "runs"    ? counts.runs : undefined;
          return (
            <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
              <span className="glyph">{meta.glyph}</span>
              {meta.label}
              {typeof num === "number" && <span className="num">{num}</span>}
            </button>
          );
        })}
      </nav>

      {!hasComponents && (
        <div className="promo">
          <div className="t">Start with a template</div>
          <div className="d">
            Clone a pre-built solution in one click — services, wiring, and all.
          </div>
          <button className="accent sm" onClick={onOpenTemplates}>Browse templates →</button>
        </div>
      )}

      <div className="footer">
        <div className="tenant"><span className="pulse" /> {TENANT_ID}</div>
        <div style={{ marginTop: 6 }}>Local environment</div>
      </div>
    </aside>
  );
}

/* ============================================================
   Overview tab
   ============================================================ */

function Overview({
  counts, setTab, onUseTemplate, templatesAvailable,
}: {
  counts: { components: number; workflows: number; runs: number };
  setTab: (t: Tab) => void;
  onUseTemplate: (t: SolutionTemplate) => void;
  templatesAvailable: boolean;
}) {
  return (
    <div className="tab-enter">
      <div className="hero">
        <div>
          <div className="eyebrow">Welcome</div>
          <h1>Turn AI services into shippable solutions.</h1>
          <p className="lede" style={{ marginTop: 18 }}>
            Onboard AI capabilities — LLM calls, OCR, transforms, routers — as reusable services.
            Chain them into solutions you can run locally, in the cloud, or hybrid. Export any
            solution as a portable bundle to share or deploy elsewhere.
          </p>
          <div style={{ marginTop: 24, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="accent lg" onClick={() => setTab("catalog")}>Onboard a service →</button>
            <button className="lg" onClick={() => setTab("builder")}>Open the builder</button>
          </div>
        </div>
        <div className="visual">
          <FlowDiagram />
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 8 }}>
        <div className="card metric"><div className="label">Services in catalog</div><div className="value">{counts.components}</div><div className="sub">Reusable building blocks</div></div>
        <div className="card metric teal"><div className="label">Solutions composed</div><div className="value">{counts.workflows}</div><div className="sub">Workflows ready to run</div></div>
        <div className="card metric ink"><div className="label">Executions</div><div className="value">{counts.runs}</div><div className="sub">This session</div></div>
      </div>

      <div className="divider">How it works</div>
      <div className="qs-list" style={{ marginBottom: 40 }}>
        <div className="qs-step">
          <div className="n">01</div>
          <div className="t">Onboard a service</div>
          <div className="d">Register an AI capability — LLM, OCR, transform — with its runtime mode and config.</div>
        </div>
        <div className="qs-step">
          <div className="n">02</div>
          <div className="t">Publish to catalog</div>
          <div className="d">Mark services as public so other teams can discover and reuse them.</div>
        </div>
        <div className="qs-step">
          <div className="n">03</div>
          <div className="t">Compose a solution</div>
          <div className="d">Chain services in the builder. Each solution is a versioned workflow.</div>
        </div>
        <div className="qs-step">
          <div className="n">04</div>
          <div className="t">Run &amp; download</div>
          <div className="d">Execute against real input, monitor results, export as a portable JSON bundle.</div>
        </div>
      </div>

      <div className="divider">Start from a template</div>
      <p style={{ color: "var(--ink-2)", marginBottom: 18, fontSize: 14, maxWidth: "62ch" }}>
        Each template seeds the necessary services into your catalog and wires them into a
        ready-to-run solution. Click one to clone it.
      </p>
      <div className="grid grid-3">
        {SOLUTION_TEMPLATES.map(t => (
          <div key={t.slug} className="tpl" onClick={() => onUseTemplate(t)}>
            <div className="icon">{t.icon}</div>
            <h3>{t.name}</h3>
            <div className="d">{t.description}</div>
            <div className="steps">
              {t.steps.map((s, i) => (
                <span key={i}>{s.label}</span>
              ))}
            </div>
            <div className="cta">
              {templatesAvailable ? "Use template →" : "Connecting…"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   Onboard service modal
   ============================================================ */

function OnboardModal({
  open, onClose, onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (c: any) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Kind>("llm");
  const [version, setVersion] = useState("1.0.0");
  const [runtime, setRuntime] = useState("hybrid");
  const [configText, setConfigText] = useState('{\n  "provider": "openai",\n  "model": "gpt-4o-mini"\n}');
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName(""); setKind("llm"); setVersion("1.0.0");
      setRuntime("hybrid"); setConfigText('{\n  "provider": "openai",\n  "model": "gpt-4o-mini"\n}');
      setIsPublic(true); setErr(null); setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    setErr(null);
    if (!name.trim()) { setErr("Name is required"); return; }
    let cfg: any = {};
    try { cfg = configText.trim() ? JSON.parse(configText) : {}; }
    catch { setErr("Config must be valid JSON"); return; }
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(), kind, version, runtime_mode: runtime,
        input_schema: {}, output_schema: {},
        config: cfg, is_public: isPublic,
      });
      onClose();
    } catch (e: any) {
      setErr(e.response?.data?.detail || e.message || "Failed to register service");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="hd">
          <h2>Onboard a service</h2>
          <span className="sub">New catalog entry</span>
        </div>
        <div className="body">
          <div>
            <label>Service name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Invoice OCR" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label>Kind</label>
              <select value={kind} onChange={e => setKind(e.target.value as Kind)}>
                <option value="llm">LLM</option>
                <option value="transform">Transform</option>
                <option value="router">Router</option>
                <option value="component">Component</option>
              </select>
            </div>
            <div>
              <label>Version</label>
              <input value={version} onChange={e => setVersion(e.target.value)} />
            </div>
            <div>
              <label>Runtime</label>
              <select value={runtime} onChange={e => setRuntime(e.target.value)}>
                <option value="local">Local</option>
                <option value="hybrid">Hybrid</option>
                <option value="cloud">Cloud</option>
              </select>
            </div>
          </div>
          <div>
            <label>Config (JSON)</label>
            <textarea rows={6} value={configText} onChange={e => setConfigText(e.target.value)} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, textTransform: "none", letterSpacing: 0, fontSize: 13, color: "var(--ink)", marginBottom: 0, fontFamily: "var(--font-sans)" }}>
            <input type="checkbox" style={{ width: "auto" }} checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />
            Publish to the catalog (visible to other teams)
          </label>
          {err && <div style={{ color: "var(--rose)", fontSize: 12.5 }}>{err}</div>}
        </div>
        <div className="ft">
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button className="accent" onClick={submit} disabled={submitting}>
            {submitting ? "Registering…" : "Register service"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Catalog tab
   ============================================================ */

function Catalog({
  components, onOnboard, onSeedSamples,
}: {
  components: Component[];
  onOnboard: () => void;
  onSeedSamples: () => void;
}) {
  const [q, setQ] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | Kind>("all");

  const filtered = useMemo(() => components.filter(c =>
    (kindFilter === "all" || c.kind === kindFilter) &&
    (!q || c.name.toLowerCase().includes(q.toLowerCase()))
  ), [components, q, kindFilter]);

  const grouped = useMemo(() => {
    const groups: Record<Kind, Component[]> = { llm: [], transform: [], router: [], component: [] };
    for (const c of filtered) groups[c.kind].push(c);
    return groups;
  }, [filtered]);

  const KIND_TITLE: Record<Kind, string> = {
    llm: "LLM services", transform: "Transforms", router: "Routers", component: "Custom components",
  };

  return (
    <div className="tab-enter">
      <header>
        <div className="eyebrow">Step 1 — Onboard</div>
        <h1>Service Catalog</h1>
        <p className="lede">
          Each card below is a reusable AI capability. Register them once, then drop them into
          any solution you build. Color stripes indicate the kind of service.
        </p>
      </header>

      <div className="toolbar">
        <input className="search" placeholder="Search services…" value={q} onChange={e => setQ(e.target.value)} />
        <select value={kindFilter} onChange={e => setKindFilter(e.target.value as any)} style={{ maxWidth: 180 }}>
          <option value="all">All kinds</option>
          <option value="llm">LLM</option>
          <option value="transform">Transform</option>
          <option value="router">Router</option>
          <option value="component">Component</option>
        </select>
        <div style={{ flex: 1 }} />
        <button className="accent" onClick={onOnboard}>+ Onboard service</button>
      </div>

      {components.length === 0 ? (
        <div className="empty">
          <h3>Your catalog is empty.</h3>
          <p>
            Register your first AI service to make it available across solutions — or load six
            sample services to explore the platform end-to-end.
          </p>
          <div className="cta">
            <button className="accent lg" onClick={onOnboard}>+ Onboard your first service</button>
            <button className="lg" onClick={onSeedSamples}>Load sample services</button>
          </div>
        </div>
      ) : (
        (["llm", "transform", "router", "component"] as Kind[]).map(k => (
          grouped[k].length > 0 && (
            <div key={k}>
              <div className="section-hd">
                <KindChip kind={k} />
                <h2>{KIND_TITLE[k]}</h2>
                <span className="count">· {grouped[k].length}</span>
              </div>
              <div className="grid grid-3">
                {grouped[k].map(c => (
                  <div key={c.id} className="tile">
                    <div className={`stripe ${c.kind}`} />
                    <div className="inner">
                      <div className="top">
                        <div>
                          <h3>{c.name}</h3>
                          <div className="meta" style={{ marginTop: 6 }}>
                            <span>v{c.version}</span>
                            <span>{c.runtime_mode}</span>
                          </div>
                        </div>
                        <span className="pill">{c.is_public ? "public" : "private"}</span>
                      </div>
                      <div className="desc">
                        {Object.keys(c.config || {}).length
                          ? Object.entries(c.config).slice(0, 3).map(([k, v]) => `${k}: ${typeof v === "object" ? "…" : String(v)}`).join(" · ")
                          : "No additional configuration."}
                      </div>
                      <div className="id">ID {short(c.id, 12)}…</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        ))
      )}
    </div>
  );
}

/* ============================================================
   Builder tab
   ============================================================ */

function Builder({
  components, workflows, onSave, onDownloadPreview, onRunFromBuilder,
}: {
  components: Component[];
  workflows: Workflow[];
  onSave: (name: string, steps: BuilderStep[]) => Promise<void>;
  onDownloadPreview: (wf: Workflow) => void;
  onRunFromBuilder: (wfId: string) => void;
}) {
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<BuilderStep[]>([]);
  const [pickerAt, setPickerAt] = useState<number | null>(null);
  const [pickerMode, setPickerMode] = useState<"service" | "builtin">("service");
  const [saving, setSaving] = useState(false);

  const insertAt = (i: number, step: BuilderStep) => {
    setSteps(prev => {
      const next = [...prev];
      next.splice(i, 0, step);
      return next;
    });
    setPickerAt(null);
  };

  const removeStep = (uidv: string) => setSteps(steps.filter(s => s.uid !== uidv));

  const openPicker = (at: number, mode: "service" | "builtin") => {
    setPickerMode(mode); setPickerAt(at);
  };

  const save = async () => {
    if (!name.trim() || steps.length === 0) return;
    setSaving(true);
    try {
      await onSave(name.trim(), steps);
      setName(""); setSteps([]);
    } finally { setSaving(false); }
  };

  const pickService = (c: Component) => {
    if (pickerAt === null) return;
    insertAt(pickerAt, {
      uid: uid(), kind: c.kind, component_id: c.id, label: c.name, config: c.config,
    });
  };
  const pickBuiltin = (k: Kind) => {
    if (pickerAt === null) return;
    const defaultConfig =
      k === "transform" ? { result: { msg: "hello" } } :
      k === "router" ? { policy: "default" } :
      k === "llm" ? { prompt: "Describe the input" } : {};
    insertAt(pickerAt, {
      uid: uid(), kind: k,
      label: `${k.charAt(0).toUpperCase() + k.slice(1)} step`,
      config: defaultConfig,
    });
  };

  return (
    <div className="tab-enter">
      <header>
        <div className="eyebrow">Step 3 — Compose</div>
        <h1>Solution Builder</h1>
        <p className="lede">
          Drag services from your catalog into a left-to-right pipeline. Each step's output flows
          into the next. Save the result as a workflow you can run, share, or download.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24, alignItems: "start" }}>
        {/* Pipeline editor */}
        <div>
          <div className="card" style={{ padding: 22, marginBottom: 18 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <label>Solution name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Invoice intake pipeline" />
              </div>
              <span className="pill">{steps.length} step{steps.length === 1 ? "" : "s"}</span>
              <button className="accent" onClick={save} disabled={saving || !name.trim() || steps.length === 0}>
                {saving ? "Saving…" : "Save solution"}
              </button>
            </div>
          </div>

          <div className="pipeline-wrap">
            {steps.length === 0 ? (
              <div className="pipeline">
                <div className="input">
                  <div className="glyph">⤓</div>
                  Input
                </div>
                <button className="add-here" onClick={() => openPicker(0, "service")} title="Add step">+</button>
                <div className="empty-hint">
                  Add steps from your catalog or built-ins to build the pipeline.
                  <br />
                  <button className="ghost sm" style={{ marginTop: 10 }} onClick={() => openPicker(0, "builtin")}>or insert a built-in step</button>
                </div>
              </div>
            ) : (
              <div className="pipeline">
                <div className="input">
                  <div className="glyph">⤓</div>
                  Input
                </div>
                {steps.flatMap((s, i) => [
                  <div key={`add-${i}`} style={{ display: "flex", alignItems: "center" }}>
                    <button className="add-here" title="Insert here"
                            onClick={() => openPicker(i, components.length > 0 ? "service" : "builtin")}>+</button>
                  </div>,
                  <div key={s.uid} style={{ display: "flex", alignItems: "center" }}>
                    <div className="step-card">
                      <div className="idx">{i + 1}</div>
                      <button className="x" onClick={() => removeStep(s.uid)}>×</button>
                      <KindChip kind={s.kind} />
                      <div className="name">{s.label}</div>
                      {s.config && Object.keys(s.config).length > 0 && (
                        <div className="cfg">{JSON.stringify(s.config)}</div>
                      )}
                    </div>
                    {i < steps.length - 1 && <div className="connector" />}
                  </div>,
                ])}
                <div style={{ display: "flex", alignItems: "center" }}>
                  <div className="connector" />
                  <button className="add-here" title="Add step"
                          onClick={() => openPicker(steps.length, components.length > 0 ? "service" : "builtin")}>+</button>
                </div>
                <div className="output">
                  <div className="glyph">⤒</div>
                  Output
                </div>
              </div>
            )}
          </div>

          {steps.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--ink-3)", display: "flex", gap: 10, alignItems: "center" }}>
              <span>Tip:</span> click any <span className="mono" style={{ color: "var(--accent)" }}>+</span> to insert a step at that position.
            </div>
          )}
        </div>

        {/* Solutions list */}
        <div className="card bare">
          <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--line)" }}>
            <h2 style={{ fontSize: 18 }}>Existing solutions</h2>
            <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 4 }}>
              {workflows.length} saved · click <span className="mono">Download</span> to export
            </div>
          </div>
          {workflows.length === 0 ? (
            <div style={{ padding: 32, color: "var(--ink-3)", fontSize: 13, textAlign: "center", lineHeight: 1.5 }}>
              Saved solutions appear here once you save your first one.
            </div>
          ) : (
            workflows.map(w => (
              <div key={w.id} className="sol-row">
                <div className="name">{w.name}</div>
                <div className="meta">
                  {w.definition?.nodes?.length || 0} step{w.definition?.nodes?.length === 1 ? "" : "s"} · ID {short(w.id, 10)}…
                </div>
                <div className="acts">
                  <button className="sm" onClick={() => onRunFromBuilder(w.id)}>Run →</button>
                  <button className="sm" onClick={() => onDownloadPreview(w)}>Download .json</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Picker modal */}
      {pickerAt !== null && (
        <div className="scrim" onClick={() => setPickerAt(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="hd">
              <h2>{pickerMode === "service" ? "Pick a service" : "Pick a built-in step"}</h2>
              <span className="sub">Inserting at position {pickerAt + 1}</span>
            </div>
            <div className="body">
              <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                <button className={pickerMode === "service" ? "primary sm" : "sm"} onClick={() => setPickerMode("service")} disabled={components.length === 0}>
                  From catalog ({components.length})
                </button>
                <button className={pickerMode === "builtin" ? "primary sm" : "sm"} onClick={() => setPickerMode("builtin")}>
                  Built-in
                </button>
              </div>
              {pickerMode === "service" && (
                components.length === 0
                  ? <div style={{ color: "var(--ink-3)", fontSize: 13 }}>No services in catalog yet.</div>
                  : components.map(c => (
                      <button key={c.id} className="list-btn" onClick={() => pickService(c)}>
                        <KindChip kind={c.kind} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500 }}>{c.name}</div>
                          <div className="meta">v{c.version} · {c.runtime_mode}</div>
                        </div>
                      </button>
                    ))
              )}
              {pickerMode === "builtin" && (
                (["transform", "llm", "router"] as Kind[]).map(k => (
                  <button key={k} className="list-btn" onClick={() => pickBuiltin(k)}>
                    <KindChip kind={k} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, textTransform: "capitalize" }}>{k}</div>
                      <div className="meta">
                        {k === "transform" && "Reshape data without external calls"}
                        {k === "llm" && "Stub LLM call (replace with real adapter later)"}
                        {k === "router" && "Branch the workflow based on policy"}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="ft">
              <button className="ghost" onClick={() => setPickerAt(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Download preview modal
   ============================================================ */

function DownloadPreviewModal({
  open, bundle, filename, onConfirm, onClose,
}: {
  open: boolean;
  bundle: any | null;
  filename: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open || !bundle) return null;
  const size = estimateSize(bundle);
  const nSteps = bundle.workflow?.definition?.nodes?.length || 0;
  const nComps = bundle.components?.length || 0;
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal wide" onClick={e => e.stopPropagation()}>
        <div className="hd">
          <h2>Download solution</h2>
          <span className="sub">{filename}</span>
        </div>
        <div className="body">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--line-soft)", borderRadius: 6, padding: 14 }}>
              <div className="eyebrow">Workflow</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 24, marginTop: 8 }}>{nSteps}</div>
              <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 2 }}>step{nSteps === 1 ? "" : "s"}</div>
            </div>
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--line-soft)", borderRadius: 6, padding: 14 }}>
              <div className="eyebrow">Bundled services</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 24, marginTop: 8 }}>{nComps}</div>
              <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 2 }}>inlined</div>
            </div>
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--line-soft)", borderRadius: 6, padding: 14 }}>
              <div className="eyebrow">File size</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 24, marginTop: 8 }}>{size}</div>
              <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 2 }}>uncompressed</div>
            </div>
          </div>
          <div>
            <label>Bundle preview</label>
            <pre className="json">{JSON.stringify(bundle, null, 2)}</pre>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
            This single JSON file is self-contained: the workflow definition plus every service
            it references. Share it with another tenant or stash it in version control — the
            recipient has everything needed to re-create the solution.
          </div>
        </div>
        <div className="ft">
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button className="accent" onClick={onConfirm}>Download {filename}</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Runs tab
   ============================================================ */

function Runs({
  workflows, runs, addRun, refreshRun, preselectedWfId,
}: {
  workflows: Workflow[];
  runs: RunRecord[];
  addRun: (workflowId: string, input: any) => Promise<void>;
  refreshRun: (runId: string) => Promise<void>;
  preselectedWfId?: string;
}) {
  const [wfId, setWfId] = useState<string>(preselectedWfId || workflows[0]?.id || "");
  const [input, setInput] = useState('{\n  "query": "test"\n}');
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (preselectedWfId) setWfId(preselectedWfId);
    else if (!wfId && workflows[0]) setWfId(workflows[0].id);
  }, [workflows, wfId, preselectedWfId]);

  const start = async () => {
    if (!wfId) return;
    let parsed: any;
    try { parsed = JSON.parse(input); } catch { return; }
    setRunning(true);
    try { await addRun(wfId, parsed); }
    finally { setRunning(false); }
  };

  return (
    <div className="tab-enter">
      <header>
        <div className="eyebrow">Step 4 — Execute</div>
        <h1>Run &amp; Monitor</h1>
        <p className="lede">
          Run any saved solution against real input. Each execution is tracked with its status,
          output, and any errors so you can iterate quickly.
        </p>
      </header>

      <div className="card" style={{ marginBottom: 28, padding: 24 }}>
        <div className="card-hd"><h2>Start a run</h2></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div>
            <label>Solution</label>
            <select value={wfId} onChange={e => setWfId(e.target.value)}>
              {workflows.length === 0 && <option value="">No saved solutions</option>}
              {workflows.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <div style={{ marginTop: 14 }}>
              <label>Input data (JSON)</label>
              <textarea rows={7} value={input} onChange={e => setInput(e.target.value)} />
            </div>
            <div style={{ marginTop: 14 }}>
              <button className="accent" onClick={start} disabled={!wfId || running}>
                {running ? "Starting…" : "Run solution →"}
              </button>
            </div>
          </div>
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--line-soft)", borderRadius: 8, padding: 18, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55 }}>
            <div style={{ fontWeight: 500, color: "var(--ink)", marginBottom: 8, fontSize: 14 }}>How runs work</div>
            When you start a run, the orchestrator topologically sorts the solution's steps,
            queues the first one to Celery via Redis, and walks the chain. Refresh a row below
            to pull its latest status from the backend.
          </div>
        </div>
      </div>

      <div className="card bare">
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--line)" }}>
          <h2 style={{ fontSize: 18 }}>Recent runs</h2>
        </div>
        {runs.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)", fontSize: 13, lineHeight: 1.5 }}>
            No runs yet. Start one above to see it tracked here.
          </div>
        ) : (
          <>
            <div className="run-row" style={{ background: "var(--surface-2)", fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-3)" }}>
              <div>Solution</div>
              <div>Status</div>
              <div>Started</div>
              <div></div>
            </div>
            {runs.map(r => (
              <div key={r.run_id}>
                <div className="run-row">
                  <div>
                    <div style={{ fontWeight: 500 }}>{r.workflow_name}</div>
                    <div className="id">run {short(r.run_id, 14)}…</div>
                  </div>
                  <div><StatusPill status={r.status} /></div>
                  <div className="ts">{fmt(r.started_at)}</div>
                  <div className="acts">
                    <button className="ghost sm" onClick={() => refreshRun(r.run_id)}>↻ Refresh</button>
                    <button className="ghost sm" onClick={() => setExpanded(expanded === r.run_id ? null : r.run_id)}>
                      {expanded === r.run_id ? "Hide" : "View"}
                    </button>
                  </div>
                </div>
                {expanded === r.run_id && (
                  <div style={{ padding: "0 22px 18px" }}>
                    {r.error && (
                      <div style={{ background: "var(--rose-soft)", color: "var(--rose)", padding: 12, borderRadius: 5, fontFamily: "var(--font-mono)", fontSize: 12.5, marginBottom: 10 }}>
                        {r.error}
                      </div>
                    )}
                    <div className="json">{JSON.stringify(r.output ?? { hint: "Refresh to fetch latest output" }, null, 2)}</div>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   App
   ============================================================ */

export default function App() {
  const [tab, setTab] = useState<Tab>("overview");
  const [components, setComponents] = useState<Component[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [preselectedWfId, setPreselectedWfId] = useState<string | undefined>();
  const [downloadPreview, setDownloadPreview] = useState<{ bundle: any; filename: string } | null>(null);
  const [backendReady, setBackendReady] = useState(false);
  const [toast, setToast] = useState<{ kind: "info" | "error"; title: string; msg?: string } | null>(null);

  const counts = { components: components.length, workflows: workflows.length, runs: runs.length };

  const announce = (title: string, msg?: string) => setToast({ kind: "info", title, msg });
  const fail = (title: string, msg?: string) => setToast({ kind: "error", title, msg });

  const load = async () => {
    try {
      const c = await api.get("/components");
      setComponents(c.data || []);
      const w = await api.get("/workflows");
      setWorkflows(w.data || []);
      setBackendReady(true);
    } catch (e: any) {
      setBackendReady(false);
      fail("Couldn't reach backend", e.response?.data?.detail || e.message);
    }
  };

  useEffect(() => { load(); }, []);

  /* ---- Catalog actions ---- */

  const registerComponent = async (c: any) => {
    await api.post("/components", c);
    await load();
    announce("Service registered", c.name);
  };

  const seedSamples = async () => {
    try {
      for (const c of SAMPLE_COMPONENTS) await api.post("/components", c);
      await load();
      announce("Sample services loaded", `${SAMPLE_COMPONENTS.length} services added to your catalog`);
    } catch (e: any) {
      fail("Couldn't load samples", e.response?.data?.detail || e.message);
    }
  };

  /* ---- Builder actions ---- */

  const saveWorkflow = async (name: string, steps: BuilderStep[]) => {
    const nodes = steps.map((s, i) => ({
      id: `n${i + 1}`,
      type: s.kind,
      ...(s.component_id ? { component_id: s.component_id } : {}),
      ...(s.config ? { config: s.config } : {}),
    }));
    const edges = nodes.slice(0, -1).map((n, i) => ({ from: n.id, to: nodes[i + 1].id }));
    try {
      await api.post("/workflows", { name, definition: { nodes, edges } });
      await load();
      announce("Solution saved", name);
    } catch (e: any) {
      fail("Couldn't save solution", e.response?.data?.detail || e.message);
      throw e;
    }
  };

  /* ---- Apply template ----
     For each template step that names a component, find-or-create it in the
     catalog. Then build the workflow nodes referencing the resulting IDs. */

  const applyTemplate = async (tpl: SolutionTemplate) => {
    try {
      // Refresh first so we have the current catalog
      const c = await api.get("/components");
      let current: Component[] = c.data || [];
      const ensureComponent = async (name: string, kindHint: Kind, config: any, runtime: string): Promise<string> => {
        const existing = current.find(x => x.name === name);
        if (existing) return existing.id;
        const created = await api.post("/components", {
          name, kind: kindHint, version: "1.0.0",
          runtime_mode: runtime || "hybrid",
          input_schema: {}, output_schema: {},
          config, is_public: true,
        });
        const newId = created.data.id;
        current = [...current, { id: newId, name, kind: kindHint, version: "1.0.0", runtime_mode: runtime, config, is_public: true }];
        return newId;
      };

      const nodes: any[] = [];
      for (let i = 0; i < tpl.steps.length; i++) {
        const step = tpl.steps[i];
        const node: any = { id: `n${i + 1}`, type: step.kind };
        if (step.componentName) {
          const compId = await ensureComponent(step.componentName, step.kind, step.componentConfig || {}, step.componentRuntime || "hybrid");
          node.component_id = compId;
          if (step.componentConfig) node.config = step.componentConfig;
        } else if (step.builtinConfig) {
          node.config = step.builtinConfig;
        }
        nodes.push(node);
      }
      const edges = nodes.slice(0, -1).map((n, i) => ({ from: n.id, to: nodes[i + 1].id }));

      await api.post("/workflows", { name: tpl.name, definition: { nodes, edges } });
      await load();
      announce("Template applied", `${tpl.name} · ${tpl.steps.length} steps wired and ready to run`);
      setTab("builder");
    } catch (e: any) {
      fail("Couldn't apply template", e.response?.data?.detail || e.message);
    }
  };

  /* ---- Download preview / confirm ---- */

  const openDownloadPreview = (wf: Workflow) => {
    const referencedIds = new Set(
      (wf.definition?.nodes || []).map(n => n.component_id).filter(Boolean) as string[]
    );
    const referenced = components.filter(c => referencedIds.has(c.id));
    const bundle = {
      format: "ai-orchestrator-solution",
      format_version: "1.0",
      exported_at: new Date().toISOString(),
      tenant: TENANT_ID,
      workflow: { id: wf.id, name: wf.name, definition: wf.definition },
      components: referenced.map(c => ({
        id: c.id, name: c.name, kind: c.kind, version: c.version,
        runtime_mode: c.runtime_mode, config: c.config, is_public: c.is_public,
      })),
    };
    const filename = `${slugify(wf.name)}-${short(wf.id, 6)}.solution.json`;
    setDownloadPreview({ bundle, filename });
  };

  const confirmDownload = () => {
    if (!downloadPreview) return;
    downloadJSON(downloadPreview.filename, downloadPreview.bundle);
    announce("Solution downloaded", downloadPreview.filename);
    setDownloadPreview(null);
  };

  /* ---- Run actions ---- */

  const startRun = async (workflowId: string, input: any) => {
    const wf = workflows.find(w => w.id === workflowId);
    if (!wf) return;
    try {
      const r = await api.post("/runs", { workflow_id: workflowId, input_data: input, execution_target: "hybrid" });
      const rec: RunRecord = {
        run_id: r.data.run_id, workflow_id: workflowId,
        workflow_name: wf.name, started_at: new Date().toISOString(),
        status: r.data.status,
      };
      setRuns(rs => [rec, ...rs]);
      announce("Run started", `${wf.name} · ${short(rec.run_id, 8)}…`);
      setTimeout(() => refreshRun(rec.run_id), 1500);
    } catch (e: any) {
      fail("Couldn't start run", e.response?.data?.detail || e.message);
    }
  };

  const refreshRun = async (runId: string) => {
    try {
      const r = await api.get(`/runs/${runId}`);
      const data = r.data;
      setRuns(rs => rs.map(x =>
        x.run_id === runId
          ? { ...x, status: data?.status, output: data?.output_data, error: data?.error }
          : x
      ));
    } catch (e: any) {
      fail("Couldn't refresh run", e.response?.data?.detail || e.message);
    }
  };

  const pickRun = (wfId: string) => {
    setPreselectedWfId(wfId);
    setTab("runs");
  };

  return (
    <div className="app">
      <Sidebar
        tab={tab}
        setTab={setTab}
        counts={counts}
        hasComponents={components.length > 0}
        onOpenTemplates={() => setTab("overview")}
      />
      <main className="main">
        {tab === "overview" && (
          <Overview
            counts={counts}
            setTab={setTab}
            onUseTemplate={applyTemplate}
            templatesAvailable={backendReady}
          />
        )}
        {tab === "catalog" && (
          <Catalog
            components={components}
            onOnboard={() => setOnboardOpen(true)}
            onSeedSamples={seedSamples}
          />
        )}
        {tab === "builder" && (
          <Builder
            components={components}
            workflows={workflows}
            onSave={saveWorkflow}
            onDownloadPreview={openDownloadPreview}
            onRunFromBuilder={pickRun}
          />
        )}
        {tab === "runs" && (
          <Runs
            workflows={workflows}
            runs={runs}
            addRun={startRun}
            refreshRun={refreshRun}
            preselectedWfId={preselectedWfId}
          />
        )}
      </main>

      <OnboardModal
        open={onboardOpen}
        onClose={() => setOnboardOpen(false)}
        onSubmit={registerComponent}
      />

      <DownloadPreviewModal
        open={!!downloadPreview}
        bundle={downloadPreview?.bundle || null}
        filename={downloadPreview?.filename || ""}
        onConfirm={confirmDownload}
        onClose={() => setDownloadPreview(null)}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
