"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { CALLOUTS, STYLE_META } from "@/app/lib/design";
import { BOM_SECTIONS, type BomRow, type ToolingRow } from "@/app/lib/cascade";
import rawGoldenRun from "@/app/lib/golden-run.json";
import { TechPackBoard } from "@/app/components/TechPackBoard";
import {
  exportBomCsv,
  exportBomPdf,
  exportPfcPdf,
  type BomExportRow,
  type PfcExportSection,
} from "@/app/lib/export";

const LINKEDIN_URL = "https://www.linkedin.com/in/drew-millar/";
const GITHUB_URL = "https://github.com/drewmillar/cascade";

// The "golden run" — one real generation, captured and cached so the public
// site replays it instantly (and for free) instead of calling Opus per visitor.
// Live generation stays available behind NEXT_PUBLIC_CASCADE_LIVE for Drew.
const GOLDEN_RUN = rawGoldenRun as unknown as {
  bom: BomRow[];
  tooling: ToolingRow[];
  assumptions: { assumption: string; basis: string }[];
  openQuestions: string[];
  pfc: string;
};
const ALLOW_LIVE = process.env.NEXT_PUBLIC_CASCADE_LIVE === "1";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Phase = "reading" | "extracting" | "generating";
type Assumption = { assumption: string; basis: string };
type View = "design" | "bom" | "pfc" | "tooling" | "upper";

type BomReviewState = { status: "accepted" | "rejected"; material?: string };
type StepReviewState = { status: "confirmed" | "rejected" };
type PfcStep = { stepId: string; sectionTitle: string; text: string };
type AddedSection = { title: string; steps: string[] };

type StreamEvent =
  | { type: "meta"; meta: typeof STYLE_META }
  | { type: "phase"; phase: Phase }
  | { type: "callout"; n: number }
  | {
      type: "extraction";
      bom: BomRow[];
      tooling: ToolingRow[];
      assumptions: Assumption[];
      openQuestions: string[];
    }
  | { type: "pfc_delta"; text: string }
  | { type: "done"; data: unknown }
  | { type: "error"; message: string };

type Status = "idle" | "running" | "done" | "error";

export default function Home() {
  const [status, setStatus] = useState<Status>("idle");
  const [phase, setPhase] = useState<Phase | null>(null);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [activeN, setActiveN] = useState<number | null>(null);
  const [bom, setBom] = useState<BomRow[]>([]);
  const [tooling, setTooling] = useState<ToolingRow[]>([]);
  const [pfc, setPfc] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("design");

  // Manual edits (edit mode)
  const [editMode, setEditMode] = useState(false);
  const [addedBom, setAddedBom] = useState<BomRow[]>([]);
  const [addedSteps, setAddedSteps] = useState<Record<string, string[]>>({});
  const [addedSections, setAddedSections] = useState<AddedSection[]>([]);
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const [bomEdits, setBomEdits] = useState<Record<string, Partial<BomRow>>>({});
  const [stepEdits, setStepEdits] = useState<Record<string, string>>({});

  // Review workflow state
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewSeg, setReviewSeg] = useState<"bom" | "pfc">("bom");
  const [bomReview, setBomReview] = useState<Record<number, BomReviewState>>({});
  const [stepReview, setStepReview] = useState<Record<string, StepReviewState>>(
    {},
  );
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [sent, setSent] = useState(false);

  const running = useRef(false);

  const handleEvent = useCallback((evt: StreamEvent) => {
    switch (evt.type) {
      case "phase":
        setPhase(evt.phase);
        if (evt.phase !== "reading") setActiveN(null);
        if (evt.phase === "generating") setView("pfc");
        break;
      case "callout":
        setRevealed((s) => new Set(s).add(evt.n));
        setActiveN(evt.n);
        break;
      case "extraction":
        setBom(evt.bom);
        setTooling(evt.tooling);
        setView("bom");
        break;
      case "pfc_delta":
        setPfc((p) => p + evt.text);
        break;
      case "done":
        setStatus("done");
        setPhase(null);
        setActiveN(null);
        break;
      case "error":
        setError(evt.message);
        setStatus("error");
        break;
    }
  }, []);

  const resetForRun = useCallback(() => {
    setStatus("running");
    setPhase("reading");
    setRevealed(new Set());
    setActiveN(null);
    setBom([]);
    setTooling([]);
    setPfc("");
    setError(null);
    setBomReview({});
    setStepReview({});
    setAddedBom([]);
    setAddedSteps({});
    setAddedSections([]);
    setDeleted(new Set());
    setBomEdits({});
    setStepEdits({});
    setEditMode(false);
    setReviewOpen(false);
    setActiveTargetId(null);
    setSaved(false);
    setSent(false);
    setView("design");
  }, []);

  // Live generation — the real Opus pipeline. Used by the optional "Run live"
  // control (gated by NEXT_PUBLIC_CASCADE_LIVE) so the public site never calls it.
  const runDemo = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    resetForRun();

    try {
      const res = await fetch("/api/generate", { method: "POST" });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const line = chunk.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          handleEvent(JSON.parse(line.slice(6)) as StreamEvent);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    } finally {
      running.current = false;
    }
  }, [handleEvent, resetForRun]);

  // Cached replay — synthesizes the same event sequence (with the reveal
  // animation) from the captured golden run. Instant, free, abuse-proof.
  const replayDemo = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    resetForRun();

    try {
      const g = GOLDEN_RUN;
      handleEvent({ type: "meta", meta: STYLE_META });
      handleEvent({ type: "phase", phase: "reading" });
      for (const c of CALLOUTS) {
        handleEvent({ type: "callout", n: c.n });
        await sleep(95);
      }
      await sleep(260);

      handleEvent({ type: "phase", phase: "extracting" });
      await sleep(520);
      handleEvent({
        type: "extraction",
        bom: g.bom,
        tooling: g.tooling,
        assumptions: g.assumptions,
        openQuestions: g.openQuestions,
      });
      await sleep(360);

      handleEvent({ type: "phase", phase: "generating" });
      // Reveal the PFC in a bounded number of steps. Each delta re-renders the
      // whole (growing) doc, so we cap the count to keep the replay snappy while
      // preserving the live-typing reveal.
      const STEPS = 18;
      const size = Math.ceil(g.pfc.length / STEPS);
      for (let i = 0; i < g.pfc.length; i += size) {
        handleEvent({ type: "pfc_delta", text: g.pfc.slice(i, i + size) });
        await sleep(40);
      }

      handleEvent({ type: "done", data: g });
    } finally {
      running.current = false;
    }
  }, [handleEvent, resetForRun]);

  // The primary button is always the instant cached replay (the showcase).
  // "Run live" is a separate, optional control shown only when live is enabled.
  const onGenerate = replayDemo;

  useEffect(() => {
    if (!activeTargetId) return;
    const el = document.getElementById(activeTargetId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeTargetId]);

  const started = status !== "idle";
  const generating = phase === "generating";

  const pfcSections = parsePfc(pfc);
  const aiRows = bom
    .map((r, i) => ({ r, i }))
    .filter((x) => x.r.aiSuggested && !deleted.has(`b${x.i}`));
  const inferredSteps = buildInferredSteps(pfcSections).filter(
    (s) => !deleted.has(s.stepId),
  );
  const pfcPageCount = pfcSections.length + addedSections.length;
  const totalGaps = aiRows.length + inferredSteps.length;
  const resolvedGaps =
    Object.keys(bomReview).length + Object.keys(stepReview).length;
  const pendingGaps = Math.max(0, totalGaps - resolvedGaps);
  const bomCount =
    bom.filter((_, i) => !deleted.has(`b${i}`)).length +
    addedBom.filter((_, j) => !deleted.has(`am${j}`)).length;

  const openWorkflow = (seg: "bom" | "pfc") => {
    setReviewSeg(seg);
    setView(seg === "bom" ? "bom" : "pfc");
    setReviewOpen(true);
  };
  const setSeg = (seg: "bom" | "pfc") => {
    setReviewSeg(seg);
    setView(seg === "bom" ? "bom" : "pfc");
  };

  const del = (id: string) => setDeleted((s) => new Set(s).add(id));
  const editBom = (key: string, patch: Partial<BomRow>) =>
    setBomEdits((s) => ({ ...s, [key]: { ...s[key], ...patch } }));
  const editStep = (id: string, text: string) =>
    setStepEdits((s) => ({ ...s, [id]: text }));

  const acceptAllBom = () =>
    setBomReview((s) => {
      const n = { ...s };
      aiRows.forEach(({ i }) => {
        if (!n[i]) n[i] = { status: "accepted" };
      });
      return n;
    });
  const confirmAllSteps = () =>
    setStepReview((s) => {
      const n = { ...s };
      inferredSteps.forEach((st) => {
        if (!n[st.stepId]) n[st.stepId] = { status: "confirmed" };
      });
      return n;
    });

  const addBomRow = (
    section: BomRow["section"],
    row: Omit<BomRow, "section" | "aiSuggested" | "comments">,
  ) =>
    setAddedBom((a) => [
      ...a,
      { ...row, section, aiSuggested: false, comments: "added by developer" },
    ]);
  const addStep = (si: number, after: number, text: string) =>
    setAddedSteps((s) => {
      const k = `${si}:${after}`;
      return { ...s, [k]: [...(s[k] ?? []), text] };
    });
  const addSection = (title: string) =>
    setAddedSections((s) => [...s, { title, steps: [] }]);
  const addSectionStep = (idx: number, text: string) =>
    setAddedSections((s) =>
      s.map((sec, i) =>
        i === idx ? { ...sec, steps: [...sec.steps, text] } : sec,
      ),
    );

  return (
    <main
      className={`w-full px-6 py-10 ${
        reviewOpen ? "max-w-none lg:pr-[460px]" : "mx-auto max-w-5xl"
      }`}
    >
      <Header />

      {!started && <Hero />}

      <div className="mt-8 flex flex-col gap-5">
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {sent && (
          <SentBanner
            bomCount={bomCount}
            pfcCount={pfcPageCount}
            toolingCount={tooling.length}
          />
        )}

        <TopTabs
          view={view}
          setView={setView}
          started={started}
          generating={generating}
          status={status}
          pendingGaps={pendingGaps}
          saved={saved}
          sent={sent}
          editMode={editMode}
          onToggleEdit={() => setEditMode((e) => !e)}
          onGenerate={onGenerate}
          onRunLive={ALLOW_LIVE ? runDemo : undefined}
          onWorkflow={() => openWorkflow(reviewSeg)}
          onSend={() => setSent(true)}
        />

        {generating && <StatusStrip phase={phase} status={status} />}
        {editMode && (
          <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-[12.5px] text-amber-800">
            <span>
              ✎ Edit mode — add or remove BOM components and PFC steps. The
              workflow and document are otherwise view-only.
            </span>
            <button
              onClick={() => setEditMode(false)}
              className="font-semibold text-amber-900 hover:underline"
            >
              Done
            </button>
          </div>
        )}

        <div>
          {view === "design" && (
            <TechPackBoard
              revealed={revealed}
              activeN={activeN}
              reading={phase === "reading" || phase === "extracting"}
            />
          )}
          {view === "bom" &&
            (bom.length > 0 ? (
              <BomDoc
                apiRows={bom}
                addedRows={addedBom}
                review={bomReview}
                activeId={activeTargetId}
                saved={saved}
                sent={sent}
                editMode={editMode}
                deleted={deleted}
                onDelete={del}
                bomEdits={bomEdits}
                onEditBom={editBom}
                onWorkflow={() => openWorkflow("bom")}
                onAddBom={addBomRow}
              />
            ) : (
              <Pending label="Extracting the Bill of Materials…" />
            ))}
          {view === "pfc" && (
            <PfcDoc
              text={pfc}
              generating={generating}
              bom={[...bom, ...addedBom]}
              stepReview={stepReview}
              activeId={activeTargetId}
              saved={saved}
              sent={sent}
              editMode={editMode}
              deleted={deleted}
              onDelete={del}
              stepEdits={stepEdits}
              onEditStep={editStep}
              addedSteps={addedSteps}
              addedSections={addedSections}
              onAddStep={addStep}
              onAddSection={addSection}
              onAddSectionStep={addSectionStep}
            />
          )}
          {view === "tooling" &&
            (tooling.length > 0 ? (
              <ToolingDoc rows={tooling} />
            ) : (
              <Pending label="Extracting tooling…" />
            ))}
          {view === "upper" && <UpperComingSoon />}
        </div>
      </div>

      <Footer />

      {reviewOpen && (
        <ReviewPanel
          seg={reviewSeg}
          setSeg={setSeg}
          onClose={() => setReviewOpen(false)}
          total={totalGaps}
          resolved={resolvedGaps}
          pending={pendingGaps}
          saved={saved}
          onSave={() => {
            setSaved(true);
            setReviewOpen(false);
          }}
          activeId={activeTargetId}
          onHover={setActiveTargetId}
          aiRows={aiRows}
          bomReview={bomReview}
          onBom={(i, st, material) =>
            setBomReview((s) => ({ ...s, [i]: { status: st, material } }))
          }
          onBomUndo={(i) =>
            setBomReview((s) => {
              const n = { ...s };
              delete n[i];
              return n;
            })
          }
          onAcceptAllBom={acceptAllBom}
          steps={inferredSteps}
          stepReview={stepReview}
          onStep={(id, st) =>
            setStepReview((s) => ({ ...s, [id]: { status: st } }))
          }
          onStepUndo={(id) =>
            setStepReview((s) => {
              const n = { ...s };
              delete n[id];
              return n;
            })
          }
          onConfirmAllSteps={confirmAllSteps}
        />
      )}
    </main>
  );
}

function Header() {
  return (
    <header className="flex items-baseline justify-between border-b border-line pb-4">
      <div>
        <span className="text-[22px] font-black tracking-tight">
          Cascade<span className="text-accent">.</span>
        </span>
        <span className="ml-3 hidden text-sm text-muted sm:inline">
          design as the single source of truth
        </span>
      </div>
      <a href="/how-it-works" className="text-sm text-accent hover:underline">
        How it works
      </a>
    </header>
  );
}

function Hero() {
  const steps = [
    {
      n: 1,
      title: "Read the tech pack",
      body: "Cascade reads the finished design — materials, construction, branding.",
    },
    {
      n: 2,
      title: "Generate the build docs",
      body: "A grouped BOM, a tooling list, and a Process Flow Chart, in about a minute.",
    },
    {
      n: 3,
      title: "Confirm & send to the factory",
      body: "Confirm what it inferred; the factory fills the process specs as they build.",
    },
  ];
  return (
    <section className="mt-10">
      <div className="max-w-2xl">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight">
          A footwear design, turned into the documents the factory builds from.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted">
          Starting a shoe means re-entering everything by hand — building the
          initial Bill of Materials and Process Flow Chart takes hours of
          duplicate data entry and manual work, and the PFC is normally written
          entirely on the factory side. Cascade reads the design and{" "}
          <strong className="text-foreground">
            generates both in about a minute
          </strong>{" "}
          — then the developer and the factory refine them{" "}
          <strong className="text-foreground">together</strong>.
        </p>
      </div>

      {/* before / after */}
      <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <div className="flex-1 rounded-lg border border-line bg-card px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            Today
          </div>
          <div className="mt-0.5 text-[13px] leading-snug">
            Hours of duplicate entry for the BOM &amp; PFC · the PFC written
            factory-side · re-typed by hand
          </div>
        </div>
        <div className="hidden text-xl text-line sm:block">→</div>
        <div className="flex-1 rounded-lg border border-accent bg-accent-soft px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-accent">
            With Cascade
          </div>
          <div className="mt-0.5 text-[13px] font-medium leading-snug">
            ~1 min, generated from the design · developer + factory, collaborating
          </div>
        </div>
      </div>

      {/* 3-step */}
      <ol className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {steps.map((s) => (
          <li
            key={s.n}
            className="rounded-lg border border-line bg-card px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">
                {s.n}
              </span>
              <span className="text-[13px] font-semibold">{s.title}</span>
            </div>
            <p className="mt-1.5 text-[12px] leading-snug text-muted">{s.body}</p>
          </li>
        ))}
      </ol>

      <p className="mt-5 text-[13px] text-muted">
        Built by{" "}
        <a
          href={LINKEDIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-accent hover:underline"
        >
          Drew Millar
        </a>{" "}
        — a former footwear developer and Lead PM on Nike Flow — on a real sample
        shoe, the <strong className="text-foreground">Alpha Power Elite</strong>
        . <a href="/how-it-works" className="text-accent hover:underline">
          The thinking behind it →
        </a>
      </p>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
        Footwear is the proof domain — the same design-to-factory cascade
        applies to any complex hardware, from a robot arm to an aerospace
        bracket.
      </p>
    </section>
  );
}

// A fixed toast so confirming the send is clear without shifting the page.
function SentBanner({
  bomCount,
  pfcCount,
  toolingCount,
}: {
  bomCount: number;
  pfcCount: number;
  toolingCount: number;
}) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <div className="cascade-fade fixed bottom-6 left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2">
      <div className="flex items-start gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-4 shadow-lg">
        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-emerald-600 text-[14px] font-bold text-white">
          ✓
        </span>
        <div className="text-[13px] leading-relaxed text-emerald-900">
          <span className="font-semibold">
            Sent to the factory — FT · VG&nbsp;PCC.
          </span>{" "}
          The confirmed pack ({bomCount} BOM components · {pfcCount} PFC pages ·{" "}
          {toolingCount}&nbsp;tools) is with the factory. They&apos;ll fill the open
          process parameters and quote — and their answers flow back into Cascade.
        </div>
        <button
          onClick={() => setHidden(true)}
          className="ml-1 flex-none text-[15px] leading-none text-emerald-700 hover:text-emerald-900"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ---- Top-level tabs + view / edit / workflow / send controls ---------------

function TopTabs({
  view,
  setView,
  started,
  generating,
  status,
  pendingGaps,
  saved,
  sent,
  editMode,
  onToggleEdit,
  onGenerate,
  onRunLive,
  onWorkflow,
  onSend,
}: {
  view: View;
  setView: (v: View) => void;
  started: boolean;
  generating: boolean;
  status: Status;
  pendingGaps: number;
  saved: boolean;
  sent: boolean;
  editMode: boolean;
  onToggleEdit: () => void;
  onGenerate: () => void;
  onRunLive?: () => void;
  onWorkflow: () => void;
  onSend: () => void;
}) {
  const tabs: { key: View; label: string; always?: boolean; soon?: boolean }[] =
    [
      { key: "design", label: "Design", always: true },
      { key: "bom", label: "Bill of Materials" },
      { key: "pfc", label: "PFC" },
      { key: "tooling", label: "Tooling" },
      { key: "upper", label: "Upper", soon: true },
    ];
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line">
      <div className="flex flex-wrap">
        {tabs.map((t) => {
          const locked = t.soon || (!t.always && !started);
          const active = view === t.key;
          return (
            <button
              key={t.key}
              onClick={() => !locked && setView(t.key)}
              disabled={locked}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition ${
                active
                  ? "border-accent text-foreground"
                  : locked
                    ? "cursor-not-allowed border-transparent text-muted/40"
                    : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {t.label}
              {t.key === "pfc" && generating && (
                <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white">
                  live
                </span>
              )}
              {t.soon && (
                <span className="rounded-full bg-foreground/5 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-muted">
                  soon
                </span>
              )}
              {!t.always && !t.soon && !started && (
                <span className="text-line" aria-hidden>
                  ○
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 pb-1">
        {!started && (
          <button
            onClick={onGenerate}
            className="whitespace-nowrap rounded-md bg-accent px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            ✦ Generate Build Docs
          </button>
        )}
        {!started && onRunLive && (
          <button
            onClick={onRunLive}
            title="Run the real Opus pipeline instead of the cached demo"
            className="whitespace-nowrap rounded-md border border-line px-3 py-2 text-[12.5px] font-medium text-muted transition hover:bg-accent-soft"
          >
            ⚡ Run live
          </button>
        )}
        {generating && (
          <span className="flex items-center gap-2 text-[12.5px] text-muted">
            <span className="cascade-cursor h-3.5" aria-hidden />
            Generating…
          </span>
        )}
        {status === "done" && (
          <>
            <button
              onClick={onToggleEdit}
              className={`whitespace-nowrap rounded-md px-3 py-2 text-[12.5px] font-semibold transition ${
                editMode
                  ? "bg-amber-500 text-white"
                  : "border border-line text-muted hover:bg-accent-soft"
              }`}
            >
              {editMode ? "✓ Done" : "✎ Edit"}
            </button>
            <button
              onClick={onWorkflow}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-4 py-2 text-[13px] font-semibold transition ${
                saved
                  ? "border border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "bg-accent text-white shadow-sm hover:opacity-90"
              }`}
            >
              {saved
                ? "✓ Saved · workflow"
                : pendingGaps > 0
                  ? `✦ Workflow · ${pendingGaps} to confirm`
                  : "✦ Review & save"}
            </button>
            {!sent && saved && (
              <button
                onClick={onSend}
                className="whitespace-nowrap rounded-md bg-accent px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:opacity-90"
              >
                Send to factory ▸
              </button>
            )}
            {sent && (
              <span className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-[13px] font-semibold text-emerald-700">
                ✓ Sent to factory
              </span>
            )}
            <button
              onClick={onGenerate}
              className="whitespace-nowrap rounded-md border border-line px-3 py-2 text-[12.5px] font-medium text-muted hover:bg-accent-soft"
            >
              Regenerate
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function StatusStrip({ phase, status }: { phase: Phase | null; status: Status }) {
  const steps: { key: Phase; label: string }[] = [
    { key: "reading", label: "Reading the tech pack" },
    { key: "extracting", label: "Extracting BOM & tooling" },
    { key: "generating", label: "Writing the Process Flow Chart" },
  ];
  const order: Phase[] = ["reading", "extracting", "generating"];
  const currentIdx = phase ? order.indexOf(phase) : status === "done" ? 3 : -1;

  return (
    <div className="rounded-lg border border-line bg-card px-5 py-3">
      <ol className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
        {steps.map((s, i) => {
          const state =
            i < currentIdx || status === "done"
              ? "done"
              : i === currentIdx
                ? "active"
                : "todo";
          return (
            <li key={s.key} className="flex items-center gap-2.5 text-[13px]">
              <span className={state === "todo" ? "text-line" : "text-accent"}>
                {state === "done" ? "●" : state === "active" ? "◐" : "○"}
              </span>
              <span
                className={
                  state === "todo" ? "text-muted" : "font-medium text-foreground"
                }
              >
                {s.label}
              </span>
              {state === "active" && (
                <span className="cascade-cursor h-3.5" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Pending({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-card px-5 py-8 text-[13px] text-muted">
      <span className="cascade-cursor h-3.5" aria-hidden />
      {label}
    </div>
  );
}

function StatusBadge({ saved, sent }: { saved: boolean; sent: boolean }) {
  if (sent)
    return (
      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
        Sent ✓
      </span>
    );
  if (saved)
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
        Saved
      </span>
    );
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
      Draft · in review
    </span>
  );
}

function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Delete"
      className="flex h-4 w-4 flex-none items-center justify-center rounded-full text-[12px] leading-none text-muted transition hover:bg-red-100 hover:text-red-600"
    >
      ✕
    </button>
  );
}

function ExportBtn({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={`Export ${label}`}
      className="flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-[12px] font-medium text-muted transition hover:bg-accent-soft hover:text-foreground"
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="M8 1.5v8M4.8 6.3 8 9.5l3.2-3.2M2.5 13.5h11"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </button>
  );
}

// ---- OUTPUT: grouped BOM ---------------------------------------------------

function BomDoc({
  apiRows,
  addedRows,
  review,
  activeId,
  saved,
  sent,
  editMode,
  deleted,
  onDelete,
  bomEdits,
  onEditBom,
  onWorkflow,
  onAddBom,
}: {
  apiRows: BomRow[];
  addedRows: BomRow[];
  review: Record<number, BomReviewState>;
  activeId: string | null;
  saved: boolean;
  sent: boolean;
  editMode: boolean;
  deleted: Set<string>;
  onDelete: (id: string) => void;
  bomEdits: Record<string, Partial<BomRow>>;
  onEditBom: (key: string, patch: Partial<BomRow>) => void;
  onWorkflow: () => void;
  onAddBom: (
    section: BomRow["section"],
    row: Omit<BomRow, "section" | "aiSuggested" | "comments">,
  ) => void;
}) {
  type Indexed = {
    r: BomRow;
    key: string;
    domId: string;
    reviewIndex: number;
    manual: boolean;
  };
  const rows: Indexed[] = [
    ...apiRows.map((r, i) => ({
      r,
      key: `b${i}`,
      domId: `bomrow-${i}`,
      reviewIndex: i,
      manual: false,
    })),
    ...addedRows.map((r, j) => ({
      r,
      key: `am${j}`,
      domId: `bomadded-${j}`,
      reviewIndex: -1,
      manual: true,
    })),
  ].filter((x) => !deleted.has(x.key));

  const aiCount = rows.filter((x) => x.r.aiSuggested).length;
  const confirmedCount = rows.filter(
    (x) => x.r.aiSuggested && review[x.reviewIndex]?.status === "accepted",
  ).length;
  const pct = aiCount ? (confirmedCount / aiCount) * 100 : 0;
  const exportRows: BomExportRow[] = rows
    .filter((x) => review[x.reviewIndex]?.status !== "rejected")
    .map((x) => {
      const patch = bomEdits[x.key] ?? {};
      return {
        section: x.r.section,
        partName: patch.partName ?? x.r.partName,
        material:
          patch.material ?? review[x.reviewIndex]?.material ?? x.r.material,
        supplier: patch.supplier ?? x.r.supplier,
        color: patch.color ?? x.r.color,
      };
    });
  let display = 0;
  return (
    <section className="cascade-fade overflow-hidden rounded-xl border border-line bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Bill of Materials</h3>
          <StatusBadge saved={saved} sent={sent} />
        </div>
        <div className="flex items-center gap-2">
          <ExportBtn label="CSV" onClick={() => exportBomCsv(exportRows)} />
          <ExportBtn label="PDF" onClick={() => exportBomPdf(exportRows)} />
          {aiCount > 0 && (
            <button
              onClick={onWorkflow}
              className="flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-[12px] font-medium hover:bg-accent-soft"
            >
              <span className="h-1.5 w-16 overflow-hidden rounded-full bg-line">
                <span
                  className="block h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </span>
              {confirmedCount}/{aiCount} confirmed
            </button>
          )}
        </div>
      </div>
      <p className="px-5 pt-2 text-xs text-muted">
        Initial BOM · {rows.length} components · lead colorway:{" "}
        {STYLE_META.leadColorway}
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="bg-background text-left text-muted">
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Part name</th>
              <th className="px-3 py-2 font-medium">Material</th>
              <th className="px-3 py-2 font-medium">Supplier</th>
              <th className="px-3 py-2 font-medium">Color</th>
            </tr>
          </thead>
          <tbody>
            {BOM_SECTIONS.map((section) => {
              const sectionRows = rows.filter((x) => x.r.section === section);
              if (sectionRows.length === 0 && !editMode) return null;
              return (
                <SectionGroup
                  key={section}
                  label={section}
                  count={sectionRows.length}
                >
                  {sectionRows.map((x) => {
                    display += 1;
                    return (
                      <BomRowItem
                        key={x.key}
                        num={display}
                        row={x.r}
                        domId={x.domId}
                        manual={x.manual}
                        patch={bomEdits[x.key]}
                        reviewState={review[x.reviewIndex]}
                        isActive={activeId === x.domId}
                        editMode={editMode}
                        onEdit={(p) => onEditBom(x.key, p)}
                        onDelete={() => onDelete(x.key)}
                      />
                    );
                  })}
                  {editMode && (
                    <AddBomRow section={section} onAdd={onAddBom} />
                  )}
                </SectionGroup>
              );
            })}
          </tbody>
        </table>
      </div>
      <BomLegend editMode={editMode} />
    </section>
  );
}

function BomRowItem({
  num,
  row,
  domId,
  manual,
  patch,
  reviewState,
  isActive,
  editMode,
  onEdit,
  onDelete,
}: {
  num: number;
  row: BomRow;
  domId: string;
  manual: boolean;
  patch?: Partial<BomRow>;
  reviewState?: BomReviewState;
  isActive: boolean;
  editMode: boolean;
  onEdit: (patch: Partial<BomRow>) => void;
  onDelete: () => void;
}) {
  const partName = patch?.partName ?? row.partName;
  const material = patch?.material ?? reviewState?.material ?? row.material;
  const supplier = patch?.supplier ?? row.supplier;
  const color = patch?.color ?? row.color;
  const rejected = reviewState?.status === "rejected";
  const accepted = reviewState?.status === "accepted";
  const showAiChip = row.aiSuggested && !reviewState;

  const [editing, setEditing] = useState(false);
  const [p, setP] = useState(partName);
  const [m, setM] = useState(material);
  const [s, setS] = useState(supplier);
  const [c, setC] = useState(color);
  const start = () => {
    setP(partName);
    setM(material);
    setS(supplier);
    setC(color);
    setEditing(true);
  };
  const save = () => {
    onEdit({ partName: p, material: m, supplier: s, color: c });
    setEditing(false);
  };
  const inp =
    "w-full rounded border border-line bg-card px-1.5 py-1 text-[12px] outline-none focus:border-accent";

  if (editing)
    return (
      <tr className="border-t border-line bg-accent-soft/20 align-top">
        <td className="px-3 py-2 text-muted">{num}</td>
        <td className="px-3 py-2">
          <input
            autoFocus
            value={p}
            onChange={(e) => setP(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            className={inp}
          />
        </td>
        <td className="px-3 py-2">
          <input
            value={m}
            onChange={(e) => setM(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            className={inp}
          />
        </td>
        <td className="px-3 py-2">
          <input
            value={s}
            onChange={(e) => setS(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            className={inp}
          />
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1">
            <input
              value={c}
              onChange={(e) => setC(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              className={inp}
            />
            <button
              onClick={save}
              className="rounded bg-accent px-2 py-1 text-[11px] font-semibold text-white"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-1 text-[13px] text-muted hover:text-foreground"
            >
              ✕
            </button>
          </div>
        </td>
      </tr>
    );

  return (
    <tr
      id={domId}
      className={`border-t border-line align-top scroll-mt-24 transition-colors ${
        isActive ? "bg-accent-soft" : rejected ? "opacity-40" : ""
      }`}
    >
      <td className="px-3 py-2 text-muted">{num}</td>
      <td className="px-3 py-2 font-medium">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className={rejected ? "line-through" : ""}>{partName}</span>
          {showAiChip && <AiChip />}
          {accepted && (
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-emerald-700">
              ✓ confirmed
            </span>
          )}
          {rejected && (
            <span className="rounded bg-foreground/5 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-muted">
              rejected
            </span>
          )}
          {manual && (
            <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-accent">
              added
            </span>
          )}
        </span>
      </td>
      <td className="px-3 py-2">{material}</td>
      <td className="px-3 py-2 text-muted">
        <SupplierCell value={supplier} />
      </td>
      <td className="px-3 py-2">
        <span className="flex items-center justify-between gap-2">
          {color}
          {editMode && (
            <span className="flex flex-none items-center gap-0.5">
              <EditBtn onClick={start} />
              <DeleteBtn onClick={onDelete} />
            </span>
          )}
        </span>
      </td>
    </tr>
  );
}

function AddBomRow({
  section,
  onAdd,
}: {
  section: BomRow["section"];
  onAdd: (
    section: BomRow["section"],
    row: Omit<BomRow, "section" | "aiSuggested" | "comments">,
  ) => void;
}) {
  const [open, setOpen] = useState(false);
  const [p, setP] = useState("");
  const [m, setM] = useState("");
  const [s, setS] = useState("");
  const [c, setC] = useState("");
  const reset = () => {
    setP("");
    setM("");
    setS("");
    setC("");
  };
  const save = () => {
    if (!p.trim()) return;
    onAdd(section, {
      partName: p.trim().toUpperCase(),
      material: m.trim() || "—",
      supplier: s.trim() || "TBD — sourcing",
      color: c.trim() || "—",
    });
    reset();
    setOpen(false);
  };
  const inp =
    "w-full rounded border border-line bg-card px-1.5 py-1 text-[12px] outline-none focus:border-accent";

  if (!open)
    return (
      <tr className="border-t border-line">
        <td colSpan={5} className="px-3 py-1.5">
          <button
            onClick={() => setOpen(true)}
            className="text-[11.5px] font-medium text-accent hover:underline"
          >
            + Add component
          </button>
        </td>
      </tr>
    );
  return (
    <tr className="border-t border-line bg-accent-soft/20 align-top">
      <td className="px-3 py-2 text-muted">+</td>
      <td className="px-3 py-2">
        <input
          autoFocus
          value={p}
          onChange={(e) => setP(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="Part name"
          className={inp}
        />
      </td>
      <td className="px-3 py-2">
        <input
          value={m}
          onChange={(e) => setM(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="Material"
          className={inp}
        />
      </td>
      <td className="px-3 py-2">
        <input
          value={s}
          onChange={(e) => setS(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="Supplier"
          className={inp}
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <input
            value={c}
            onChange={(e) => setC(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="Color"
            className={inp}
          />
          <button
            onClick={save}
            className="rounded bg-accent px-2 py-1 text-[11px] font-semibold text-white"
          >
            Add
          </button>
          <button
            onClick={() => {
              reset();
              setOpen(false);
            }}
            className="px-1 text-[13px] text-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>
      </td>
    </tr>
  );
}

function AiChip() {
  return (
    <span
      className="rounded bg-violet-100 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-violet-700"
      title="Inferred from the outer material + construction — confirm in the workflow"
    >
      AI · confirm
    </span>
  );
}

function BomLegend({ editMode }: { editMode: boolean }) {
  return (
    <div className="border-t border-line px-5 py-2.5 text-[11.5px] text-muted">
      <span className="mr-1.5 rounded bg-violet-100 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-violet-700">
        AI · confirm
      </span>
      = a non-visible reinforcement, lamination, or lining Cascade derived from the
      outer material. Confirm each in the workflow
      {editMode ? ", or add and delete components in edit mode." : "."}
    </div>
  );
}

function SectionGroup({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <>
      <tr className="border-t border-line bg-accent-soft/40">
        <td
          colSpan={5}
          className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent"
        >
          {label} <span className="font-normal text-muted">({count})</span>
        </td>
      </tr>
      {children}
    </>
  );
}

function SupplierCell({ value }: { value: string }) {
  const isTbd = /tbd|sourcing/i.test(value);
  return <span className={isTbd ? "text-amber-600" : ""}>{value}</span>;
}

// ---- The review workflow drawer --------------------------------------------

function ReviewPanel({
  seg,
  setSeg,
  onClose,
  total,
  resolved,
  pending,
  saved,
  onSave,
  activeId,
  onHover,
  aiRows,
  bomReview,
  onBom,
  onBomUndo,
  onAcceptAllBom,
  steps,
  stepReview,
  onStep,
  onStepUndo,
  onConfirmAllSteps,
}: {
  seg: "bom" | "pfc";
  setSeg: (s: "bom" | "pfc") => void;
  onClose: () => void;
  total: number;
  resolved: number;
  pending: number;
  saved: boolean;
  onSave: () => void;
  activeId: string | null;
  onHover: (id: string | null) => void;
  aiRows: { r: BomRow; i: number }[];
  bomReview: Record<number, BomReviewState>;
  onBom: (i: number, status: "accepted" | "rejected", material?: string) => void;
  onBomUndo: (i: number) => void;
  onAcceptAllBom: () => void;
  steps: PfcStep[];
  stepReview: Record<string, StepReviewState>;
  onStep: (id: string, status: "confirmed" | "rejected") => void;
  onStepUndo: (id: string) => void;
  onConfirmAllSteps: () => void;
}) {
  const pct = total ? Math.round((resolved / total) * 100) : 0;
  const bomPending = aiRows.filter((x) => !bomReview[x.i]).length;
  const pfcPending = steps.filter((s) => !stepReview[s.stepId]).length;

  return (
    <>
      <div
        className="fixed inset-0 z-30 bg-black/20 lg:hidden"
        onClick={onClose}
        aria-hidden
      />
      <aside className="fixed right-0 top-0 z-40 flex h-full w-full max-w-[440px] flex-col border-l border-line bg-card shadow-xl">
        <div className="border-b border-line px-5 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Resolve with the developer</h3>
            <button
              onClick={onClose}
              className="text-[18px] leading-none text-muted hover:text-foreground"
              aria-label="Close workflow"
            >
              ✕
            </button>
          </div>
          <p className="mt-1 text-[12px] leading-snug text-muted">
            Confirm the materials and steps Cascade inferred — hover any item to
            jump to it. Process parameters are left as blanks for the factory.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[11px] font-medium text-muted">
              {resolved}/{total}
            </span>
          </div>
          <div className="mt-3 flex gap-1 rounded-md bg-background p-1">
            <SegBtn
              active={seg === "bom"}
              onClick={() => setSeg("bom")}
              label="BOM materials"
              badge={bomPending}
            />
            <SegBtn
              active={seg === "pfc"}
              onClick={() => setSeg("pfc")}
              label="PFC steps"
              badge={pfcPending}
            />
          </div>
          {seg === "bom" && bomPending > 0 && (
            <button
              onClick={onAcceptAllBom}
              className="mt-2 text-[11.5px] font-medium text-accent hover:underline"
            >
              Accept all {bomPending} suggestions
            </button>
          )}
          {seg === "pfc" && pfcPending > 0 && (
            <button
              onClick={onConfirmAllSteps}
              className="mt-2 text-[11.5px] font-medium text-accent hover:underline"
            >
              Confirm all {pfcPending} steps
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {seg === "bom" ? (
            aiRows.length === 0 ? (
              <EmptyReview label="No AI-suggested materials to confirm." />
            ) : (
              <div className="flex flex-col gap-2.5">
                {aiRows.map(({ r, i }) => (
                  <div key={i} onMouseEnter={() => onHover(`bomrow-${i}`)}>
                    <BomReviewCard
                      row={r}
                      state={bomReview[i]}
                      active={activeId === `bomrow-${i}`}
                      onAccept={(m) => onBom(i, "accepted", m)}
                      onReject={() => onBom(i, "rejected")}
                      onUndo={() => onBomUndo(i)}
                    />
                  </div>
                ))}
              </div>
            )
          ) : steps.length === 0 ? (
            <EmptyReview label="No inferred steps — every PFC step came straight from the design." />
          ) : (
            <div className="flex flex-col gap-2.5">
              {steps.map((s) => (
                <div key={s.stepId} onMouseEnter={() => onHover(s.stepId)}>
                  <StepReviewCard
                    step={s}
                    state={stepReview[s.stepId]}
                    active={activeId === s.stepId}
                    onConfirm={() => onStep(s.stepId, "confirmed")}
                    onReject={() => onStep(s.stepId, "rejected")}
                    onUndo={() => onStepUndo(s.stepId)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-line px-5 py-3">
          {pending > 0 && (
            <div className="mb-2 text-center text-[11.5px] text-muted">
              {pending} item{pending === 1 ? "" : "s"} still unconfirmed
            </div>
          )}
          <button
            onClick={onSave}
            className="w-full rounded-md bg-emerald-600 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:opacity-90"
          >
            {saved ? "Save changes" : "Save changes"}
          </button>
        </div>
      </aside>
    </>
  );
}

function SegBtn({
  active,
  onClick,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-[12.5px] font-medium transition ${
        active ? "bg-card text-foreground shadow-sm" : "text-muted"
      }`}
    >
      {label}
      {badge > 0 && (
        <span className="rounded-full bg-violet-100 px-1.5 text-[10px] font-bold text-violet-700">
          {badge}
        </span>
      )}
    </button>
  );
}

function EmptyReview({ label }: { label: string }) {
  return (
    <div className="px-2 py-10 text-center text-[13px] text-muted">{label}</div>
  );
}

function BomReviewCard({
  row,
  state,
  active,
  onAccept,
  onReject,
  onUndo,
}: {
  row: BomRow;
  state?: BomReviewState;
  active: boolean;
  onAccept: (material?: string) => void;
  onReject: () => void;
  onUndo: () => void;
}) {
  const [val, setVal] = useState("");
  const ring = active ? "ring-2 ring-accent" : "";

  if (state) {
    const accepted = state.status === "accepted";
    return (
      <div
        className={`rounded-lg border px-3 py-2.5 text-[12.5px] ${ring} ${
          accepted ? "border-emerald-200 bg-emerald-50" : "border-line bg-background"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold">{row.partName}</span>
          <span
            className={`flex-none text-[11px] font-semibold ${
              accepted ? "text-emerald-700" : "text-muted"
            }`}
          >
            {accepted ? "✓ Confirmed" : "Rejected"}
          </span>
        </div>
        <div
          className={`mt-0.5 text-[11.5px] ${
            accepted ? "text-emerald-800" : "text-muted line-through"
          }`}
        >
          {state.material ?? row.material}
        </div>
        <button
          onClick={onUndo}
          className="mt-1 text-[11px] text-accent hover:underline"
        >
          Undo
        </button>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border border-violet-200 bg-violet-50/50 px-3 py-2.5 ${ring}`}
    >
      <div className="flex items-center gap-1.5">
        <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-700">
          AI suggested
        </span>
        <span className="text-[12.5px] font-semibold">{row.partName}</span>
      </div>
      <div className="mt-1 text-[12px] text-foreground">{row.material}</div>
      {row.comments && (
        <div className="mt-0.5 text-[11px] italic text-muted">{row.comments}</div>
      )}
      <div className="mt-2 flex gap-1.5">
        <button
          onClick={() => onAccept()}
          className="rounded bg-emerald-600 px-2.5 py-1 text-[11.5px] font-semibold text-white hover:opacity-90"
        >
          Accept
        </button>
        <button
          onClick={onReject}
          className="rounded border border-line bg-card px-2.5 py-1 text-[11.5px] text-muted hover:bg-background"
        >
          Reject
        </button>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && val.trim()) onAccept(val.trim());
          }}
          placeholder="or write your own material…"
          className="flex-1 rounded border border-line bg-card px-2 py-1 text-[11.5px] outline-none focus:border-accent"
        />
        <button
          onClick={() => val.trim() && onAccept(val.trim())}
          disabled={!val.trim()}
          className="rounded border border-line bg-card px-2 py-1 text-[11.5px] font-medium text-accent disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function StepReviewCard({
  step,
  state,
  active,
  onConfirm,
  onReject,
  onUndo,
}: {
  step: PfcStep;
  state?: StepReviewState;
  active: boolean;
  onConfirm: () => void;
  onReject: () => void;
  onUndo: () => void;
}) {
  const ring = active ? "ring-2 ring-accent" : "";
  const clean = step.text.replace(/\[factory:[^\]]*\]/gi, "▮");

  if (state) {
    const confirmedState = state.status === "confirmed";
    return (
      <div
        className={`rounded-lg border px-3 py-2.5 text-[12.5px] ${ring} ${
          confirmedState
            ? "border-emerald-200 bg-emerald-50"
            : "border-line bg-background"
        }`}
      >
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
          {step.sectionTitle}
        </div>
        <div className="mt-0.5 flex items-start justify-between gap-2">
          <span
            className={`leading-snug ${
              confirmedState ? "" : "text-muted line-through"
            }`}
          >
            {clean}
          </span>
          <span
            className={`flex-none text-[11px] font-semibold ${
              confirmedState ? "text-emerald-700" : "text-muted"
            }`}
          >
            {confirmedState ? "✓ Kept" : "Removed"}
          </span>
        </div>
        <button
          onClick={onUndo}
          className="mt-1 text-[11px] text-accent hover:underline"
        >
          Undo
        </button>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-violet-200 bg-violet-50/50 px-3 py-2.5 ${ring}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
          {step.sectionTitle}
        </span>
        <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-700">
          Cascade added
        </span>
      </div>
      <div className="mt-1 text-[12px] leading-snug">{clean}</div>
      <div className="mt-2 flex gap-1.5">
        <button
          onClick={onConfirm}
          className="rounded bg-emerald-600 px-2.5 py-1 text-[11.5px] font-semibold text-white hover:opacity-90"
        >
          Keep step
        </button>
        <button
          onClick={onReject}
          className="rounded border border-line bg-card px-2.5 py-1 text-[11.5px] text-muted hover:bg-background"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

// ---- OUTPUT: tooling -------------------------------------------------------

function ToolingDoc({ rows }: { rows: ToolingRow[] }) {
  return (
    <section className="cascade-fade overflow-hidden rounded-xl border border-line bg-card">
      <DocHeader
        title="Tooling"
        sub={`${rows.length} tools · molds, plates & cutting dies`}
        tag="OUTPUT"
      />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="bg-background text-left text-muted">
              <th className="px-3 py-2 font-medium">Section</th>
              <th className="px-3 py-2 font-medium">Tool</th>
              <th className="px-3 py-2 font-medium">Tool code</th>
              <th className="px-3 py-2 font-medium">Tool-shop</th>
              <th className="px-3 py-2 font-medium">State</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-line align-top">
                <td className="px-3 py-2 text-muted">{r.section}</td>
                <td className="px-3 py-2 font-medium">{r.description}</td>
                <td className="px-3 py-2 font-mono text-[11.5px]">
                  <SupplierCell value={r.toolCode} />
                </td>
                <td className="px-3 py-2 text-muted">
                  <SupplierCell value={r.supplier} />
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] ${
                      /carryover/i.test(r.state)
                        ? "bg-accent-soft text-accent"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {r.state}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---- OUTPUT: PFC -----------------------------------------------------------

type PfcSection = { title: string; note: string; steps: string[] };

function parsePfc(text: string): PfcSection[] {
  const sections: PfcSection[] = [];
  let cur: PfcSection | null = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("## ")) {
      cur = { title: line.replace(/^##\s*/, ""), note: "", steps: [] };
      sections.push(cur);
      continue;
    }
    if (!cur) continue;
    const m = line.match(/^(\d+)\.\s+(.*)$/);
    if (m) cur.steps.push(m[2]);
    else if (!cur.note) cur.note = line.replace(/^[-•]\s*/, "");
    else cur.note += " " + line.replace(/^[-•]\s*/, "");
  }
  return sections;
}

function buildInferredSteps(sections: PfcSection[]): PfcStep[] {
  const items: PfcStep[] = [];
  sections.forEach((s, si) => {
    s.steps.forEach((step, sti) => {
      if (/^\[\+\]/.test(step)) {
        items.push({
          stepId: `pfcstep-${si}-${sti}`,
          sectionTitle: s.title,
          text: step.replace(/^\[\+\]\s*/, ""),
        });
      }
    });
  });
  return items;
}

function PfcDoc({
  text,
  generating,
  bom,
  stepReview,
  activeId,
  saved,
  sent,
  editMode,
  deleted,
  onDelete,
  stepEdits,
  onEditStep,
  addedSteps,
  addedSections,
  onAddStep,
  onAddSection,
  onAddSectionStep,
}: {
  text: string;
  generating: boolean;
  bom: BomRow[];
  stepReview: Record<string, StepReviewState>;
  activeId: string | null;
  saved: boolean;
  sent: boolean;
  editMode: boolean;
  deleted: Set<string>;
  onDelete: (id: string) => void;
  stepEdits: Record<string, string>;
  onEditStep: (id: string, text: string) => void;
  addedSteps: Record<string, string[]>;
  addedSections: AddedSection[];
  onAddStep: (si: number, after: number, text: string) => void;
  onAddSection: (title: string) => void;
  onAddSectionStep: (idx: number, text: string) => void;
}) {
  if (!text && !generating)
    return <Pending label="Writing the Process Flow Chart…" />;
  const sections = parsePfc(text);

  const fmt = (t: string) =>
    t
      .replace(/^\[\+\]\s*/, "")
      .replace(/\[(?:factory|confirm):\s*([^\]]*)\]/gi, "____ ($1)");
  const buildExport = (): PfcExportSection[] => {
    const out: PfcExportSection[] = [];
    sections.forEach((s, si) => {
      const steps: string[] = [];
      (addedSteps[`${si}:-1`] ?? []).forEach((t, j) => {
        const id = `ms-${si}--1-${j}`;
        if (!deleted.has(id)) steps.push(fmt(stepEdits[id] ?? t));
      });
      s.steps.forEach((st, i) => {
        const stepId = `pfcstep-${si}-${i}`;
        if (!deleted.has(stepId)) steps.push(fmt(stepEdits[stepId] ?? st));
        (addedSteps[`${si}:${i}`] ?? []).forEach((t, j) => {
          const id = `ms-${si}-${i}-${j}`;
          if (!deleted.has(id)) steps.push(fmt(stepEdits[id] ?? t));
        });
      });
      out.push({ title: s.title, note: fmt(s.note), steps });
    });
    addedSections.forEach((sec, idx) => {
      if (deleted.has(`asec-${idx}`)) return;
      const steps: string[] = [];
      sec.steps.forEach((t, j) => {
        const id = `ass-${idx}-${j}`;
        if (!deleted.has(id)) steps.push(fmt(stepEdits[id] ?? t));
      });
      out.push({ title: `${sec.title} (added)`, note: "", steps });
    });
    return out;
  };

  return (
    <div className="cascade-fade flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Process Flow Chart</h3>
          {!generating && <StatusBadge saved={saved} sent={sent} />}
        </div>
        <div className="flex items-center gap-2">
          {!generating && (
            <ExportBtn label="PDF" onClick={() => exportPfcPdf(buildExport())} />
          )}
          <span className="rounded-full bg-foreground/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
            OUTPUT · HERO · {sections.length || "…"}/13
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-700">
            +
          </span>
          step Cascade added — you confirm
        </span>
        <span className="flex items-center gap-1.5">
          <span className="rounded border border-dashed border-amber-400 bg-amber-50/50 px-1.5 text-[10px] text-amber-700">
            factory
          </span>
          parameter the factory fills during build
        </span>
      </div>
      {sections.map((s, si) => (
        <PfcPage
          key={si}
          section={s}
          sectionIndex={si}
          bom={bom}
          stepReview={stepReview}
          activeId={activeId}
          complete={si < sections.length - 1 || !generating}
          editMode={editMode}
          deleted={deleted}
          onDelete={onDelete}
          stepEdits={stepEdits}
          onEditStep={onEditStep}
          added={addedSteps}
          onAddStep={onAddStep}
        />
      ))}
      {addedSections.map((sec, idx) =>
        deleted.has(`asec-${idx}`) ? null : (
          <AddedPfcPage
            key={`added-${idx}`}
            section={sec}
            idx={idx}
            editMode={editMode}
            deleted={deleted}
            onDelete={onDelete}
            stepEdits={stepEdits}
            onEditStep={onEditStep}
            onAddStep={(t) => onAddSectionStep(idx, t)}
          />
        ),
      )}
      {editMode && !generating && <AddSectionControl onAdd={onAddSection} />}
      {generating && (
        <div className="flex items-center gap-2 text-[13px] text-muted">
          <span className="cascade-cursor h-3.5" aria-hidden />
          writing the next process page…
        </div>
      )}
    </div>
  );
}

function PfcChrome({
  title,
  onDelete,
}: {
  title: string;
  onDelete?: () => void;
}) {
  return (
    <div className="border-b border-line">
      <div className="flex items-stretch text-[10px]">
        <div className="bg-amber-200/70 px-3 py-1 font-bold uppercase tracking-wide text-amber-900">
          Initial PFC
        </div>
        <div className="flex-1 px-3 py-1 text-muted">
          <span className="font-semibold text-foreground">
            {STYLE_META.styleName}
          </span>{" "}
          · {STYLE_META.productCode}
        </div>
        <div className="px-3 py-1 uppercase tracking-wide text-muted">
          Colorway 630780
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-line px-4 py-2">
        <h4 className="text-[13px] font-semibold">{title}</h4>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-muted">
            {STYLE_META.styleCode}
          </span>
          {onDelete && <DeleteBtn onClick={onDelete} />}
        </div>
      </div>
    </div>
  );
}

function PfcPage({
  section,
  sectionIndex,
  bom,
  stepReview,
  activeId,
  complete,
  editMode,
  deleted,
  onDelete,
  stepEdits,
  onEditStep,
  added,
  onAddStep,
}: {
  section: PfcSection;
  sectionIndex: number;
  bom: BomRow[];
  stepReview: Record<string, StepReviewState>;
  activeId: string | null;
  complete: boolean;
  editMode: boolean;
  deleted: Set<string>;
  onDelete: (id: string) => void;
  stepEdits: Record<string, string>;
  onEditStep: (id: string, text: string) => void;
  added: Record<string, string[]>;
  onAddStep: (si: number, after: number, text: string) => void;
}) {
  const isCutting = /cutting|die/i.test(section.title);
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-card">
      <PfcChrome title={section.title} />
      <div className="px-4 py-4">
        {section.note && (
          <div className="mb-3 flex overflow-hidden rounded-md border border-line">
            <div className="flex w-24 flex-none items-center bg-background px-2.5 py-1.5 text-[10px] font-semibold uppercase leading-tight tracking-wide text-muted">
              Material description
            </div>
            <div className="flex-1 px-3 py-2 text-[12.5px] leading-relaxed">
              {renderStepBody(section.note, editMode)}
            </div>
          </div>
        )}
        {isCutting && <DieSchedule bom={bom} />}
        <BoxFlow
          steps={section.steps}
          sectionIndex={sectionIndex}
          stepReview={stepReview}
          activeId={activeId}
          complete={complete}
          editMode={editMode}
          deleted={deleted}
          onDelete={onDelete}
          stepEdits={stepEdits}
          onEditStep={onEditStep}
          added={added}
          onAddStep={onAddStep}
        />
      </div>
    </section>
  );
}

function BoxFlow({
  steps,
  sectionIndex,
  stepReview,
  activeId,
  complete,
  editMode,
  deleted,
  onDelete,
  stepEdits,
  onEditStep,
  added,
  onAddStep,
}: {
  steps: string[];
  sectionIndex: number;
  stepReview: Record<string, StepReviewState>;
  activeId: string | null;
  complete: boolean;
  editMode: boolean;
  deleted: Set<string>;
  onDelete: (id: string) => void;
  stepEdits: Record<string, string>;
  onEditStep: (id: string, text: string) => void;
  added: Record<string, string[]>;
  onAddStep: (si: number, after: number, text: string) => void;
}) {
  // Build the visible boxes (steps + manual inserts) in order.
  type Box =
    | { kind: "step"; id: string; text: string; after: number }
    | { kind: "manual"; id: string; text: string; after: number };
  const boxes: Box[] = [];
  (added[`${sectionIndex}:-1`] ?? []).forEach((t, j) => {
    const id = `ms-${sectionIndex}--1-${j}`;
    if (!deleted.has(id))
      boxes.push({ kind: "manual", id, text: stepEdits[id] ?? t, after: -1 });
  });
  steps.forEach((s, i) => {
    const stepId = `pfcstep-${sectionIndex}-${i}`;
    if (!deleted.has(stepId))
      boxes.push({
        kind: "step",
        id: stepId,
        text: stepEdits[stepId] ?? s,
        after: i,
      });
    (added[`${sectionIndex}:${i}`] ?? []).forEach((t, j) => {
      const id = `ms-${sectionIndex}-${i}-${j}`;
      if (!deleted.has(id))
        boxes.push({ kind: "manual", id, text: stepEdits[id] ?? t, after: i });
    });
  });

  if (boxes.length === 0 && !complete && !editMode) return null;

  let stepNo = 0;
  return (
    <div className="flex flex-wrap items-stretch gap-y-3">
      {boxes.map((b, idx) => {
        if (b.kind === "step") stepNo += 1;
        return (
          <Fragment key={b.id}>
            {idx > 0 && <FlowArrow />}
            {b.kind === "step" ? (
              <StepBox
                n={stepNo}
                text={b.text}
                stepId={b.id}
                state={stepReview[b.id]}
                active={activeId === b.id}
                editMode={editMode}
                onEdit={(t) => onEditStep(b.id, t)}
                onDelete={editMode ? () => onDelete(b.id) : undefined}
              />
            ) : (
              <ManualStepBox
                text={b.text}
                editMode={editMode}
                onEdit={(t) => onEditStep(b.id, t)}
                onDelete={editMode ? () => onDelete(b.id) : undefined}
              />
            )}
            {editMode && (
              <InsertStep onAdd={(t) => onAddStep(sectionIndex, b.after, t)} />
            )}
          </Fragment>
        );
      })}
      {complete && (
        <>
          {boxes.length > 0 && <FlowArrow />}
          <div className="flex items-center rounded-md border border-dashed border-line bg-card px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Storage / QC
          </div>
        </>
      )}
    </div>
  );
}

function StepBox({
  n,
  text,
  stepId,
  state,
  active,
  editMode,
  onEdit,
  onDelete,
}: {
  n: number;
  text: string;
  stepId: string;
  state?: StepReviewState;
  active: boolean;
  editMode: boolean;
  onEdit: (text: string) => void;
  onDelete?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const inferred = /^\[\+\]/.test(text);
  const body = inferred ? text.replace(/^\[\+\]\s*/, "") : text;
  const rejected = state?.status === "rejected";
  const confirmedStep = state?.status === "confirmed";
  const critical =
    /cement|weld|laminat|\blast|cure|press|inject|activation|bond|mold/i.test(
      body,
    );
  const tone = active
    ? "border-accent ring-2 ring-accent bg-card"
    : inferred && !rejected
      ? "border-violet-300 bg-violet-50"
      : critical
        ? "border-rose-300 bg-rose-50"
        : "border-line bg-background";

  if (editing)
    return (
      <CardEditor
        initial={text}
        onSave={(t) => {
          onEdit(t);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );

  return (
    <div
      id={stepId}
      className={`flex max-w-[250px] items-start gap-2 rounded-md border px-2.5 py-2 text-[12px] leading-snug scroll-mt-24 transition-shadow ${tone} ${
        rejected ? "opacity-40" : ""
      }`}
    >
      <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white">
        {n}
      </span>
      <span className={rejected ? "line-through" : ""}>
        {renderStepBody(body, editMode)}
        {inferred && !state && (
          <span className="ml-1 rounded bg-violet-100 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-700">
            + added
          </span>
        )}
        {confirmedStep && (
          <span className="ml-1 rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-700">
            ✓ kept
          </span>
        )}
      </span>
      {editMode && (
        <span className="ml-0.5 flex flex-none items-center gap-0.5">
          <EditBtn onClick={() => setEditing(true)} />
          {onDelete && <DeleteBtn onClick={onDelete} />}
        </span>
      )}
    </div>
  );
}

function ManualStepBox({
  text,
  editMode,
  onEdit,
  onDelete,
}: {
  text: string;
  editMode: boolean;
  onEdit: (text: string) => void;
  onDelete?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  if (editing)
    return (
      <CardEditor
        initial={text}
        onSave={(t) => {
          onEdit(t);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  return (
    <div className="flex max-w-[250px] items-start gap-2 rounded-md border border-accent/40 bg-accent-soft/40 px-2.5 py-2 text-[12px] leading-snug">
      <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white">
        +
      </span>
      <span>
        {renderStepBody(text, editMode)}
        <span className="ml-1 rounded bg-accent-soft px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-accent">
          added
        </span>
      </span>
      {editMode && (
        <span className="ml-0.5 flex flex-none items-center gap-0.5">
          <EditBtn onClick={() => setEditing(true)} />
          {onDelete && <DeleteBtn onClick={onDelete} />}
        </span>
      )}
    </div>
  );
}

function CardEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState(initial);
  return (
    <div className="flex max-w-[260px] flex-col gap-1.5 rounded-md border border-accent bg-card px-2.5 py-2">
      <textarea
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSave(v.trim());
          if (e.key === "Escape") onCancel();
        }}
        rows={3}
        className="w-full resize-none rounded border border-line px-2 py-1 text-[12px] outline-none focus:border-accent"
      />
      <div className="flex gap-1.5">
        <button
          onClick={() => onSave(v.trim())}
          className="rounded bg-accent px-2.5 py-1 text-[11.5px] font-semibold text-white"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="rounded border border-line px-2.5 py-1 text-[11.5px] text-muted hover:bg-background"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function EditBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Edit"
      className="flex h-4 w-4 flex-none items-center justify-center rounded-full text-[10px] leading-none text-muted transition hover:bg-accent-soft hover:text-accent"
    >
      ✎
    </button>
  );
}

function InsertStep({ onAdd }: { onAdd: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState("");
  const add = () => {
    if (!v.trim()) return;
    onAdd(v.trim());
    setV("");
    setOpen(false);
  };
  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        title="Insert a step here"
        className="mx-0.5 flex h-5 w-5 flex-none items-center justify-center self-center rounded-full border border-dashed border-line text-[12px] text-muted transition hover:border-accent hover:text-accent"
      >
        +
      </button>
    );
  return (
    <div className="mx-1 flex items-center gap-1 self-center">
      <input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") add();
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="New step…"
        className="w-44 rounded border border-accent bg-card px-2 py-1 text-[11.5px] outline-none"
      />
      <button
        onClick={add}
        className="rounded bg-accent px-2 py-1 text-[11px] font-semibold text-white"
      >
        Add
      </button>
      <button
        onClick={() => setOpen(false)}
        className="px-1 text-[13px] text-muted hover:text-foreground"
      >
        ✕
      </button>
    </div>
  );
}

function AddedPfcPage({
  section,
  idx,
  editMode,
  deleted,
  onDelete,
  stepEdits,
  onEditStep,
  onAddStep,
}: {
  section: AddedSection;
  idx: number;
  editMode: boolean;
  deleted: Set<string>;
  onDelete: (id: string) => void;
  stepEdits: Record<string, string>;
  onEditStep: (id: string, text: string) => void;
  onAddStep: (text: string) => void;
}) {
  const steps = section.steps
    .map((t, j) => ({ t, id: `ass-${idx}-${j}` }))
    .filter((x) => !deleted.has(x.id));
  return (
    <section className="overflow-hidden rounded-xl border border-accent/40 bg-card">
      <PfcChrome
        title={`${section.title} · added`}
        onDelete={editMode ? () => onDelete(`asec-${idx}`) : undefined}
      />
      <div className="px-4 py-4">
        <div className="flex flex-wrap items-stretch gap-y-3">
          {steps.map((x, i) => (
            <Fragment key={x.id}>
              {i > 0 && <FlowArrow />}
              <ManualStepBox
                text={stepEdits[x.id] ?? x.t}
                editMode={editMode}
                onEdit={(t) => onEditStep(x.id, t)}
                onDelete={editMode ? () => onDelete(x.id) : undefined}
              />
            </Fragment>
          ))}
          {editMode && (
            <>
              {steps.length > 0 && <FlowArrow />}
              <InsertStep onAdd={onAddStep} />
            </>
          )}
          {!editMode && steps.length === 0 && (
            <span className="text-[12px] text-muted">No steps yet.</span>
          )}
        </div>
      </div>
    </section>
  );
}

function AddSectionControl({ onAdd }: { onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState("");
  const add = () => {
    if (!v.trim()) return;
    onAdd(v.trim());
    setV("");
    setOpen(false);
  };
  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="self-start rounded-md border border-dashed border-line px-3 py-2 text-[12.5px] font-medium text-muted hover:border-accent hover:text-accent"
      >
        + Add process section
      </button>
    );
  return (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") add();
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Section title (e.g. 14. Special Treatment)…"
        className="w-72 rounded border border-accent bg-card px-2 py-1.5 text-[12.5px] outline-none"
      />
      <button
        onClick={add}
        className="rounded bg-accent px-3 py-1.5 text-[12px] font-semibold text-white"
      >
        Add
      </button>
      <button
        onClick={() => setOpen(false)}
        className="px-1 text-[14px] text-muted hover:text-foreground"
      >
        ✕
      </button>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex items-center px-1 text-line" aria-hidden>
      <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
        <path
          d="M1 6 H11 M8 3 L11 6 L8 9"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function DieSchedule({ bom }: { bom: BomRow[] }) {
  const parts = bom
    .filter((r) => r.section === "Upper" && !r.aiSuggested)
    .slice(0, 6);
  if (parts.length === 0) return null;
  return (
    <div className="mb-3 rounded-md border border-line bg-background p-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
        Cutting die schedule · schematic shapes · per-size dims set by the factory
      </div>
      <div className="flex flex-wrap gap-2">
        {parts.map((p, i) => (
          <div
            key={i}
            className="flex w-[118px] flex-col items-center rounded border border-line bg-card p-2 text-center"
          >
            <DieShape i={i} />
            <span className="mt-1 text-[10.5px] font-medium leading-tight">
              {p.partName}
            </span>
            <span className="mt-0.5 rounded border border-dashed border-amber-400 bg-amber-50/50 px-1 text-[9px] text-amber-700">
              A / B · factory
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DieShape({ i }: { i: number }) {
  const paths = [
    "M6 30 C 10 14 40 10 58 18 L 58 34 C 40 40 14 40 6 34 Z",
    "M6 36 C 22 30 42 18 60 8 C 50 24 32 34 10 40 Z",
    "M20 6 H44 V42 H20 Z",
    "M10 12 C 30 6 52 14 56 36 L 46 38 C 42 20 26 16 14 20 Z",
    "M16 8 H48 V30 C 48 39 40 44 32 44 C 24 44 16 39 16 30 Z",
    "M8 24 C 8 12 24 8 33 8 C 50 8 58 18 58 26 L 48 28 C 46 18 38 16 32 16 C 22 16 18 20 18 26 Z",
  ];
  return (
    <svg width="62" height="46" viewBox="0 0 64 48" fill="none" aria-hidden>
      <path
        d={paths[i % paths.length]}
        stroke="var(--foreground)"
        strokeWidth="1.3"
        strokeDasharray="3 2"
      />
    </svg>
  );
}

function renderStepBody(text: string, editMode: boolean) {
  const parts = text.split(/(\[(?:factory|confirm):[^\]]*\])/gi);
  return parts.map((p, i) =>
    /^\[(?:factory|confirm):/i.test(p) ? (
      <FactoryField
        key={i}
        editMode={editMode}
        label={p.replace(/^\[(?:factory|confirm):\s*/i, "").replace(/\]$/, "")}
      />
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

// A process parameter the factory fills — editable only in edit mode.
function FactoryField({ label, editMode }: { label: string; editMode: boolean }) {
  const [v, setV] = useState("");
  const width = `${Math.min(220, Math.max(74, label.length * 6.4))}px`;
  if (!editMode)
    return (
      <span
        title="The factory fills this in during build"
        className="mx-0.5 inline-block truncate rounded border border-dashed border-amber-300 bg-amber-50/40 px-1 align-baseline text-[11px] text-amber-700/90"
        style={{ width, maxWidth: 220 }}
      >
        {v || label}
      </span>
    );
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      placeholder={label}
      title="The factory fills this in during build"
      className="mx-0.5 inline-block rounded border border-dashed border-amber-400 bg-amber-50/50 px-1 align-baseline text-[11px] text-amber-800 placeholder:text-amber-600/70 outline-none focus:border-amber-500 focus:bg-white"
      style={{ width }}
    />
  );
}

function UpperComingSoon() {
  return (
    <section className="rounded-xl border border-dashed border-line bg-card p-8 text-center">
      <h3 className="text-sm font-semibold">Upper — pattern / shell file</h3>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-muted">
        The flattened 2D pattern (the cut pieces, with seam allowance and nesting)
        is the next artifact in the cascade. Unlike the BOM and PFC, it&apos;s true
        geometry — it needs real CAD with an engineer in the loop, not just an LLM.
        On the roadmap.
      </p>
      <span className="mt-4 inline-block rounded-full bg-foreground/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
        Coming soon
      </span>
    </section>
  );
}

function DocHeader({
  title,
  sub,
  tag,
}: {
  title: string;
  sub: string;
  tag: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted">{sub}</p>
      </div>
      <span className="rounded-full bg-foreground/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
        {tag}
      </span>
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-12 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-5 text-[13px] text-muted">
      <span>
        Built by{" "}
        <a
          href={LINKEDIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          Drew Millar
        </a>{" "}
        — a former footwear developer and Lead PM on Nike Flow.
      </span>
      <a
        href={GITHUB_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent hover:underline"
      >
        Source on GitHub
      </a>
      <a href="/how-it-works" className="text-accent hover:underline">
        How it works
      </a>
    </footer>
  );
}
