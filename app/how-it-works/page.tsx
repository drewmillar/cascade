import type { Metadata } from "next";

const LINKEDIN_URL = "https://www.linkedin.com/in/drew-millar/";
const GITHUB_URL = "https://github.com/drewmillar/cascade";

export const metadata: Metadata = {
  title: "How it works — Cascade",
  description:
    "The thinking behind Cascade: design as the single source of truth for the documents a factory builds from.",
};

const cascadeNodes: { label: string; tag: string; built: boolean }[] = [
  { label: "BOM", tag: "in this demo", built: true },
  { label: "Tooling list", tag: "in this demo", built: true },
  { label: "Process Flow Chart", tag: "in this demo", built: true },
  { label: "Tech pack", tag: "same approach", built: false },
  { label: "Pattern / shell file", tag: "CAD + human-in-the-loop", built: false },
  { label: "Tooling files", tag: "CAD + human-in-the-loop", built: false },
  { label: "Vendor & tool-shop triggers", tag: "where this goes", built: false },
];

export default function HowItWorks() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="flex items-baseline justify-between border-b border-line pb-4">
        <div>
          <span className="text-[22px] font-black tracking-tight">
            Cascade<span className="text-accent">.</span>
          </span>
          <span className="ml-3 hidden text-sm text-muted sm:inline">
            design as the single source of truth
          </span>
        </div>
        <a href="/" className="text-sm text-accent hover:underline">
          ← Back to the demo
        </a>
      </header>

      <h1 className="mt-10 text-3xl font-semibold leading-tight tracking-tight">
        How it works, and the thinking behind it
      </h1>

      {/* How it works */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          What the demo does
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-foreground">
          The Design tab is a real Alpha Power Elite tech pack — line art,
          pattern shell, numbered materials, and branding details. Hit{" "}
          <strong>Generate Build Docs</strong> and Claude reads it, then produces
          a grouped Bill of Materials and a tooling list — deriving the
          non-visible reinforcements and linings from the outer materials, and
          pulling vendor names through where the design calls them out.
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-foreground">
          It then writes the Process Flow Chart — the manufacturing sequence,
          formatted like a real production PFC. A workflow walks you through
          confirming the materials and the few steps it inferred; the process
          parameters (temperatures, times, pressures) stay as{" "}
          <span className="rounded border border-dashed border-amber-400 bg-amber-50/50 px-1 text-[13px] text-amber-700">
            factory
          </span>{" "}
          fields. Switch to <strong>Edit</strong> to add or remove BOM components
          and PFC steps, <strong>Save</strong> your changes, then{" "}
          <strong>Send to the factory</strong>. Nothing is invented — every gap is
          flagged rather than guessed. The full prompt and schema are{" "}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            in the source
          </a>
          .
        </p>
      </section>

      {/* Why it matters */}
      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Why it matters
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-foreground">
          Starting a shoe is a wall of duplicate data entry. Building the initial
          BOM is about an hour of re-typing what the design already says; the PFC
          takes longer still — and it&apos;s normally written entirely on the
          factory side, after the developer hands off. Cascade generates both from
          the design in about a minute, and changes the shape of the work: instead
          of a one-way handoff, the <strong>developer and the factory</strong>{" "}
          build these documents <strong>together</strong> — the developer confirms
          the design intent, the factory fills the build parameters.
        </p>
      </section>

      {/* Beyond footwear — the generalization */}
      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Beyond footwear
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-foreground">
          Footwear is the proof domain, not the point. The cascade from a
          finished design to the documents a factory builds from is{" "}
          <strong>universal to hardware</strong> — a robot arm, a turbine
          bracket, or a medical device each starts from a finished design and
          fans out into a bill of materials, a build sequence, and tooling,
          today re-entered by hand across disconnected systems.
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-foreground">
          The hard part was never the AI; it&apos;s the{" "}
          <strong>domain judgment</strong> — knowing what a BOM should infer,
          which process steps carry real build risk, and where a model must flag
          a gap instead of guessing. That judgment is what turns a design into a
          true single source of truth, in any industry that builds physical
          things.
        </p>
      </section>

      {/* The bigger cascade */}
      <section className="mt-10 rounded-xl border border-line bg-card p-6">
        <h2 className="text-sm font-semibold">One slice of a bigger cascade</h2>
        <p className="mt-1 max-w-2xl text-[13px] text-muted">
          The same finished design is the single source of truth for everything
          the factory needs. This demo generates the document outputs AI is
          genuinely good at. The geometry outputs need real CAD and engineers; the
          triggers are integration work.
        </p>
        <div className="mt-5 flex flex-col items-start gap-4 md:flex-row md:items-center">
          <div className="rounded-md border border-accent bg-accent-soft px-4 py-3 text-sm font-semibold">
            Finished design
          </div>
          <div className="hidden text-2xl text-line md:block">→</div>
          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {cascadeNodes.map((n) => (
              <div
                key={n.label}
                className={`rounded-md border px-3 py-2 ${
                  n.built
                    ? "border-accent bg-accent-soft"
                    : "border-line bg-background"
                }`}
              >
                <div className="text-[13px] font-medium">{n.label}</div>
                <div
                  className={`text-[11px] ${
                    n.built ? "text-accent" : "text-muted"
                  }`}
                >
                  {n.built ? "✓ " : ""}
                  {n.tag}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The flywheel */}
      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          This is step one of a flywheel
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-foreground">
          A finished, commercialized BOM and a 150-page production PFC carry far
          more than a tech pack does — vendor codes, durometers, weld
          temperatures, supplier names — earned over a 12- to 24-month product
          creation cycle. Cascade doesn&apos;t fake that. It generates the{" "}
          <strong>initial</strong>{" "}
          documents, correct where the design specifies
          and explicitly flagged everywhere it doesn&apos;t.
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-foreground">
          Then every confirmation, every value the factory fills in, every
          revision and wear-test result flows back to sharpen the next draft. And
          the better the upstream design detail, the more of this fills in
          automatically — so the honest gaps become the business case: they&apos;re
          what push designers and the business toward the higher-fidelity inputs
          that make the whole cascade run. Over enough cycles, that accumulated
          history of design → BOM → PFC becomes the real moat: a model that knows
          how <em>this</em> brand builds shoes.
        </p>
      </section>

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
        <a href="/" className="text-accent hover:underline">
          ← Back to the demo
        </a>
      </footer>
    </main>
  );
}
