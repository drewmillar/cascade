"use client";

import { useState } from "react";
import Image from "next/image";
import { CALLOUTS, STYLE_META, TECHPACK_PAGES } from "@/app/lib/design";

// The design board — the real Alpha Power Elite tech-pack pages, with a page
// switcher, the numbered material legend Cascade reads, and the brief's front
// matter. This is the INPUT and it's visible before you run the demo.

export function TechPackBoard({
  revealed,
  activeN,
  reading,
}: {
  revealed: Set<number>;
  activeN: number | null;
  reading: boolean;
}) {
  const [page, setPage] = useState(TECHPACK_PAGES[0].key);
  const current = TECHPACK_PAGES.find((p) => p.key === page) ?? TECHPACK_PAGES[0];

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold">
            {STYLE_META.styleName}{" "}
            <span className="font-normal text-muted">
              · {STYLE_META.styleCode} · {STYLE_META.season}
            </span>
          </h2>
          <p className="text-xs text-muted">
            {STYLE_META.category} · {STYLE_META.gender} — Tech pack (ITP)
          </p>
        </div>
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-accent">
          INPUT — design source of truth
        </span>
      </div>

      <div className="grid grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,260px)]">
        {/* the tech-pack artwork + page switcher */}
        <div className="border-b border-line p-4 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {TECHPACK_PAGES.map((p) => (
              <button
                key={p.key}
                onClick={() => setPage(p.key)}
                className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition ${
                  p.key === page
                    ? "bg-accent text-white"
                    : "border border-line bg-card text-muted hover:bg-accent-soft"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="relative overflow-hidden rounded-md border border-line bg-white">
            <Image
              src={current.src}
              alt={`${STYLE_META.styleName} — ${current.label}`}
              width={1400}
              height={864}
              className="h-auto w-full"
              priority={current.key === "lineart"}
            />
            {reading && (
              <div className="cascade-scan pointer-events-none absolute inset-0" aria-hidden />
            )}
          </div>
          <p className="mt-2 text-[11.5px] text-muted">{current.note}</p>
        </div>

        {/* style details / front matter */}
        <div className="p-4">
          <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted">
            Style details
          </h3>
          <dl className="space-y-2.5">
            {(
              [
                ["Factory", STYLE_META.factory],
                ["Last", STYLE_META.last],
                ["Size run", STYLE_META.sizeRun],
                ["Forecast", STYLE_META.forecast],
                ["Target FOB", STYLE_META.targetFob],
                ["Lead colorway", STYLE_META.leadColorway],
              ] as [string, string][]
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="text-[10px] uppercase tracking-wide text-muted">
                  {k}
                </dt>
                <dd className="text-[12.5px] leading-tight">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* the material legend — full width, below the design */}
      <div className="border-t border-line p-4">
        <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted">
          Nomenclature &amp; materials{" "}
          <span className="font-normal normal-case text-muted/70">
            — the callouts Cascade reads
          </span>
        </h3>
        <ol className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {CALLOUTS.map((c) => {
            const on = revealed.has(c.n);
            const active = activeN === c.n;
            return (
              <li
                key={c.n}
                className={`flex gap-2 rounded-md px-2 py-1.5 transition ${
                  active ? "bg-accent-soft" : ""
                } ${on ? "opacity-100" : "opacity-30"}`}
              >
                <span
                  className={`mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full border text-[10px] font-bold ${
                    on ? "border-accent text-accent" : "border-line text-muted"
                  }`}
                >
                  {c.n}
                </span>
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-medium leading-tight">
                    {c.component}
                  </span>
                  <span className="block font-mono text-[10.5px] leading-snug text-muted">
                    {c.spec}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
