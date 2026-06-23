# Cascade — Roadmap to Deploy

**Goal:** turn Cascade into a deployable portfolio piece that signals bits-and-atoms
PM + footwear-domain expertise, then use it to open the job-search outreach.

**Timeline:** ~1 hr/day of Drew's review next week; Claude builds. Wrap + deploy by
next weekend, then start nudging the people Drew reached out to.

**Where we are:** real Alpha Menace Elite 3 tech pack as the input; live generation of
a grouped BOM (with AI-derived non-visible package), a tooling table, and a 13-section
box-flow PFC; assumptions + open questions; the cascade/flywheel framing. Solid core —
the rest is UX, journey, and deploy-readiness.

**Parallel track to start NOW (external dependency):** Drew emails a designer friend for
a generic, anonymizable design file (layered AI or hi-res PNG/PDF). The board is
image-driven, so it's a drop-in swap at deploy time — but the file needs lead time.

---

**Sequencing note (Drew, 6/20):** the "golden run" cache is a *snapshot* of the output, so it
belongs LAST — caching mid-week would just go stale after every BOM/PFC/UX change. We run
live all week to see our edits; cache + deploy at the end. The 70–90s live wait is a dev-time
annoyance, not a blocker — do a quick perf pass mid-week only if it slows iteration.

## Priorities (≈ one per day)

### 1. Suggestions UX — how you address what the AI proposes
**Why:** Drew's question. Today the AI-derived rows and assumptions are *shown* but not
*actionable*. Making them confirmable is the single highest-signal product move — it's the
flywheel made tangible (every confirm = a labeled datapoint for the future engine).
**Do:** per AI-suggested BOM row + per assumption: **Accept / Edit / Reject**, with a running
"X of Y confirmed" state and a subtle "this is how the model learns" note. The doc visibly
firms up as you confirm.

### 2. Artifact journey — what happens once the docs exist
**Why:** Drew's question. Right now generation is a dead-end; a real workflow has a life
after the draft.
**Do:** give each artifact a state — **Draft → In review → Confirmed** — driven by #1, plus a
clear "next action" at each step. A small stepper/status so it reads as a process, not a
one-shot toy.

### 3. Send-to-factory / export — the handoff
**Why:** Drew's question. The whole thesis is "design cascades to the factory floor," so the
handoff has to be visible.
**Do:** **export** the BOM (CSV/PDF) and PFC (PDF), and a **"share with factory / PCC"** action
(generate a link, or an email/handoff stub). Even a designed stub shows the journey ends at
the factory, not in the app.

### 4. Narrative & UX polish — less generic, more intuitive
**Why:** Drew's theme. A founder with no footwear background should "get it" in 30 seconds,
and it should feel crafted, not template-y.
**Do:** tighten the hero/story, the cascade diagram, and Drew's credibility framing (Shoe Dog
hook / Nike Flow); de-generic the visual language; microcopy pass; responsive/mobile check.

### 5. Anonymize, cache & deploy — the finish line
**Why:** real Nike marks out, real links in, outputs final → now safe to snapshot and ship.
**Do:** swap in the generic design file (friend's, or anonymize the Menace — strip Nike marks,
rename); set the real GitHub + LinkedIn links; **then the "golden run"** — pre-generate the
result once, cache it, replay instantly with the reveal animation (so the public site is
instant, free, and abuse-proof; keep a small "Run live" button to prove it's real); final QA;
deploy to Vercel (+ domain). Then Drew starts the outreach.

---

## Explicitly de-prioritized (for now)
- **More PFC visual fidelity** — Drew's call: it needn't match Nike's old-school format; it's good.
- **True CAD outputs** (pattern flattening, real die/nesting geometry, tooling files) — needs real
  CAD + an engineer; stays "coming soon" in the cascade diagram. This is vision, not demo.

## Status log
- [x] 1. Suggestions UX — workflow drawer (accept / free-text / reject + defer), BOM⇄PFC toggle, progress, reflects into the BOM table. (2026-06-20)
- [x] 2. Artifact journey — DONE (2026-06-20). Draft·in-review → Confirmed status badges on BOM/PFC; workflow item ↔ document linkage (hover an item → main scrolls + highlights the matching BOM row / PFC step); PFC "specs" re-pointed to the real [confirm:] spots so resolving turns them green in-place (parity with BOM); "Confirm engineering docs" when all resolved.
- [x] 3. Send-to-factory / export — DONE. Send-to-factory (Save→top-right Send→green Sent banner) + EXPORT: BOM→CSV & PDF, PFC→PDF, buttons on each artifact header, reflect current edits/deletes/confirms. (jspdf + jspdf-autotable, dynamic-imported; `app/lib/export.ts`.)
- [~] 4. Narrative & UX polish — IN PROGRESS. Done: hero rewrite (time-savings: BOM ≈ 1hr duplicate entry, PFC longer + factory-only → ~1 min generated; collaboration: dev+factory build together; Today→With Cascade contrast; 3-step how-it-works; credibility byline). Renamed "Generate engineering docs" → "Generate Build Docs". Moved "One slice of a bigger cascade" + the why/flywheel off the main page into a new /how-it-works page (main screen = pure demo). Still TODO: visual craft polish + mobile/responsive pass.
- [ ] 5. Anonymize, cache (golden run) & deploy

## PFC persona split + bulk actions (2026-06-20, Drew's domain insight)
- Drew: the tech developer (now) owns BOM materials + the step SEQUENCE; the FACTORY (later, during build) owns process parameters (temp/time/pressure/durometer). A developer would never fill those up front. So:
  - PFC workflow items = ONLY inferred steps (prompt marks them `[+]`); confirm/remove. ~2–6, was ~29.
  - Process params render as `[factory: …]` → fillable dashed amber blanks IN the PFC boxes (real inputs the "factory" types into), NOT workflow items.
  - Total "to confirm" dropped 46 → ~18 (BOM + few steps).
- Bulk actions: "Accept all N suggestions" (BOM), "Confirm all N steps" (PFC) in the drawer.

## Structural changes (2026-06-20, Drew's review)
- Design is now a top-level TAB, not a banner above the outputs. Tabs: Design · Bill of Materials · PFC · Tooling · Upper(soon). Non-design tabs locked until you hit **Generate artifacts**.
- Design sub-tabs reordered/renamed: Line art · Pattern shell · Materials · Branding details (was Nomenclature/Line art/Shell/External).
- Workflow drawer modeled on Claude Code: each item = accept the AI suggestion, write your own (free text), or reject/defer.
