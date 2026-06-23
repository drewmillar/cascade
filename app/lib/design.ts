// The demo design — the "Alpha Power Elite," an anonymized American-football
// cleat (Flyknit bootie, cabled lacing, injected TPU plate, drop-in midsole).
// The design board is the tech-pack artwork (in /public/techpack); the callouts
// below are the material legend off the nomenclature page, and the front matter
// / construction / tooling are from the tech-pack brief. Cascade reads this and
// generates the initial BOM + PFC from it.
//
// NOTE: real (lightly confidential) sample for now — swap to a generic design
// file before any public deploy.

// ---- The tech-pack pages shown in the design board -------------------------

export type TechPackPage = {
  key: string;
  label: string;
  src: string;
  note: string;
};

export const TECHPACK_PAGES: TechPackPage[] = [
  {
    key: "lineart",
    label: "Line art",
    src: "/techpack/lineart-v2.png",
    note: "Lateral + medial proportion / silhouette.",
  },
  {
    key: "shell",
    label: "Pattern shell",
    src: "/techpack/shell-v2.png",
    note: "Construction — stitch & bond lines, cable routing, cut pieces.",
  },
  {
    key: "materials",
    label: "Materials",
    src: "/techpack/nomenclature-v2.png",
    note: "Numbered material callouts — the legend Cascade reads.",
  },
  {
    key: "branding",
    label: "Branding details",
    src: "/techpack/external-v2.png",
    note: "Branding — swoosh, cord-release logo, heel pull tab, screenprints.",
  },
];

// ---- Front matter (the tech-pack brief header) -----------------------------

export const STYLE_META = {
  styleName: "Alpha Power Elite",
  styleCode: "CT6648",
  productCode: "CT6648",
  category: "American Football · Cleated",
  gender: "Men's",
  season: "SU21",
  factory: "FT",
  last: "X3208H-Core",
  sizeRun: "7–15, 16",
  drop: "—",
  forecast: "11k",
  targetFob: "$49.50 + $5.00 tooling",
  construction: "Flyknit bootie, center-seam · drop-in midsole · injected TPU plate",
  colorways: ["Black / White / Iron Grey / Volt (630780)"],
  leadColorway: "Black / White / Iron Grey",
} as const;

// ---- Numbered nomenclature callouts (real legend, nomenclature page) --------
// `spec` is the verbatim material spec from the tech pack. `component` is the
// developer's read of what the number points to. Many specs are still proto-
// stage ("as per current proto", option lists) — that rawness is real, and is
// exactly what the BOM has to resolve.

export type Callout = {
  n: number;
  component: string;
  spec: string;
};

export const CALLOUTS: Callout[] = [
  {
    n: 1,
    component: "Flyknit bootie (main upper)",
    spec: "FLYKNIT. Please use existing pullover materials for first proto.",
  },
  {
    n: 2,
    component: "Rip-stop TPU shroud",
    spec: "OPT.1: Sukyoung Textile, SSF TPU TEX-1 (SY-SFT-01), foil + coating. OPT.2: Sambu Jeno Lami Pack, M-TEX, PS-TPU .06mm + Jeno pure ripstop .1mm. OPT.3: bond 2 layers — base: Suk Young Nemo TPU TEX-1 reflective yarn face side; top: Duragon Stretch .23mm clear.",
  },
  {
    n: 3,
    component: "Bootie collar / inner sleeve",
    spec: "OPT.1: Flyknit. OPT.2: Dongjin, DJT-6242, Veletta Span CDP.",
  },
  {
    n: 4,
    component: "Swoosh (lateral / medial)",
    spec: "HF weld TPU, San Fang, Smiley-Cygni, 1.0mm. RP: ESR180SK2, black base w/ red sparkles.",
  },
  {
    n: 5,
    component: "Hologram film detail",
    spec: "Duragon Stretch, .23mm. RP: new hologram.",
  },
  {
    n: 6,
    component: "Littlefoot lace cable",
    spec: "Stretch cord as per current proto.",
  },
  {
    n: 7,
    component: "Molded rubber detail",
    spec: 'Molded rubber: see "Details" page in techpack.',
  },
  {
    n: 8,
    component: "Stretch cord (secondary)",
    spec: "Stretch cord as per current proto.",
  },
  {
    n: 9,
    component: "Synthetic reinforcement (lateral)",
    spec: "Baiksan, Hirun D, .09mm. Nike Mat #: 92045.",
  },
  {
    n: 10,
    component: "Synthetic reinforcement (medial)",
    spec: "Baiksan, Hirun D, .09mm. Nike Mat #: 92045.",
  },
  {
    n: 11,
    component: "Laminated cable pads",
    spec: "Laminated pads under cables will be incorporated into Flyknit. Please make as per pullovers for first proto.",
  },
  {
    n: 12,
    component: "Hologram tape",
    spec: "Duragon Stretch, .23mm. RP: new hologram.",
  },
  {
    n: 13,
    component: "Hologram tape (6mm, lateral)",
    spec: "Duragon Stretch, .23mm. RP: new hologram. 6mm wide tape.",
  },
  {
    n: 14,
    component: "Hologram tape (6mm, medial)",
    spec: "Duragon Stretch, .23mm. RP: new hologram. 6mm wide tape.",
  },
  {
    n: 15,
    component: "Outsole plate",
    spec: "PLATE — injected TPU plate (NFL cleated bottom).",
  },
];

// ---- Branding / external specs (the ITP "External" page) -------------------

export const BRANDING = [
  "Swoosh: HF-welded TPU (San Fang Smiley-Cygni 1.0mm), lateral + medial.",
  'Cord-release logo: Littlefoot triangle mark at the cable release.',
  '"ALPHA" graphic: screenprint, lateral + medial quarter.',
  "Heel pull tab: Littlefoot tab, screen graphic.",
  "Screenprints: lateral + medial placements per External page.",
];

// ---- Construction / shell notes (the ITP "Shell" page + brief) -------------

export const CONSTRUCTION = [
  "Flyknit bootie upper, center-seam construction.",
  "Internal medial/lateral shroud; stretchy rip-stop shroud over the throat.",
  "Littlefoot (Alpha 4) lacing mechanism — stretch cables with laminated pads under the cables, incorporated into the Flyknit.",
  "Synthetic reinforcements (Baiksan Hirun D) at lateral/medial high-wear zones.",
  "Drop-in midsole seats into the lasted bootie.",
  "Injected TPU plate (cleated bottom) attached to the bottom unit; molded rubber detail pods.",
];

// ---- Tooling brief (drop-in / plate / midsole) -----------------------------

export const TOOLING_BRIEF = [
  "New injected TPU plate at Evertech — plate material AZZ439.",
  "New drop-in midsole at FT.",
  "Molded rubber outsole detail (see Details page).",
  "Existing last: X3208H-Core.",
];

// ---- Developer notes + open items (the tech-pack brief) --------------------

export const DEV_NOTES = [
  "SU21 — early samples for Pro Bowl. Promo: yes (larger sizes for promo).",
  "TD code V1. Target FOB $49.50 + $5.00 tooling. Forecast 11k.",
  "Wear-test plan: 1st round (pre-IDR) 4/1, 2nd round (IDR) 8/1, 3rd round (PRO) 4/1.",
  "Confirm plate material AZZ439 with Evertech; confirm drop-in midsole interface at FT.",
  "Several callouts are proto-stage ('as per current proto', option lists) — resolve to a single spec for the BOM.",
];

// ---- Flatten everything to the text payload Cascade reads ------------------

export function designAsText(): string {
  const front = [
    `STYLE: ${STYLE_META.styleName} (${STYLE_META.styleCode}) — ${STYLE_META.productCode}`,
    `${STYLE_META.category} · ${STYLE_META.gender} · ${STYLE_META.season}`,
    `Factory: ${STYLE_META.factory} · Last: ${STYLE_META.last}`,
    `Construction: ${STYLE_META.construction}`,
    `Size run: ${STYLE_META.sizeRun} · Forecast: ${STYLE_META.forecast} · Target FOB: ${STYLE_META.targetFob}`,
    `Lead colorway: ${STYLE_META.leadColorway} · Colorways: ${STYLE_META.colorways.join(" · ")}`,
  ].join("\n");

  const callouts = CALLOUTS.map(
    (c) => `  [${c.n}] ${c.component}: ${c.spec}`,
  ).join("\n");

  const section = (title: string, lines: readonly string[]) =>
    `### ${title}\n${lines.map((l) => `- ${l}`).join("\n")}`;

  return [
    `### FRONT MATTER (tech-pack brief)\n${front}`,
    `### NOMENCLATURE — numbered material callouts (from the tech pack)\n${callouts}`,
    section("BRANDING / EXTERNAL", BRANDING),
    section("CONSTRUCTION / SHELL", CONSTRUCTION),
    section("TOOLING BRIEF", TOOLING_BRIEF),
    section("DEVELOPER NOTES / OPEN ITEMS", DEV_NOTES),
  ].join("\n\n");
}
