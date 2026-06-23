// Cascade's engine: the extraction schema, the prompts, and the domain rules that
// make the BOM, Tooling table, and PFC read like a real footwear developer's
// INITIAL commercialization documents — structured like the finalized M-BOM and
// 155-page PFC, but honest about everything the design doesn't yet specify.

export const MODEL = "claude-opus-4-8";

// BOM sections, in the order a real grouped M-BOM lists them.
export const BOM_SECTIONS = [
  "Upper",
  "Midsole",
  "Outsole",
  "Sockliner",
  "Packaging",
] as const;

// ---- Structured extraction schema (output_config.format) -------------------
// Every object sets additionalProperties:false; no min/max/length constraints
// (kept inside structured-output limits).

export const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    bom: {
      type: "array",
      description:
        "The initial Bill of Materials, grouped like a real M-BOM. One row per shoe component. Break the upper into real part-level granularity (toe, vamp, quarter, reinforcers/laminations, eyestay, tongue top/lining/foam, collar foam, linings, side accents, heel counter, Strobel board, laces). Finish the rows the developer's partial draft left blank.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          section: { type: "string", enum: BOM_SECTIONS as unknown as string[] },
          partName: { type: "string", description: "Factory part name, e.g. 'VAMP-QUARTER', 'TONGUE FOAM', 'OUTSOLE BASE'." },
          material: {
            type: "string",
            description:
              "PDM-style material name / spec, e.g. 'Synthetic leather, TPU-coated, perforated'. Use the design's material syntax. Do NOT invent a numeric PDM code.",
          },
          supplier: {
            type: "string",
            description:
              "If the design's material spec NAMES a vendor (e.g. Dongjin, San Fang, Baiksan, Sukyoung, Sambu), use that exact name. Otherwise 'TBD — sourcing' or 'Factory in-house'. Never invent a vendor the design didn't name.",
          },
          color: {
            type: "string",
            description:
              "Color for the lead colorway stated in the design front matter. Non-visible parts (reinforcements, laminations, backers) are typically 'Natural'.",
          },
          aiSuggested: {
            type: "boolean",
            description:
              "TRUE for non-visible parts you inferred from the outer material + construction rather than from an explicit design callout — i.e. the reinforcements, laminations, linings, backers, Strobel board a factory needs but the design board doesn't draw. FALSE for parts that map directly to a numbered callout. This flags the rows a developer should confirm.",
          },
          comments: { type: "string", description: "Short note, or empty." },
        },
        required: ["section", "partName", "material", "supplier", "color", "aiSuggested", "comments"],
      },
    },
    tooling: {
      type: "array",
      description:
        "The tooling table — molds/dies needed. One row per tool (outsole, midsole, perf cutting die, etc.).",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          section: { type: "string", description: "e.g. 'Outsole Tooling', 'Midsole Tooling', 'Upper Tooling'." },
          description: { type: "string" },
          toolCode: { type: "string", description: "'TBD' at this stage unless a carryover die exists." },
          supplier: { type: "string", description: "Tool-shop, or 'TBD'." },
          state: { type: "string", description: "'New' or 'Carryover'." },
        },
        required: ["section", "description", "toolCode", "supplier", "state"],
      },
    },
    assumptions: {
      type: "array",
      description:
        "Calls Cascade made that were NOT directly stated in the design. Each is an inference a developer should confirm. This is the credibility valve — never hide an inference here.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          assumption: { type: "string" },
          basis: { type: "string", description: "Which callout/note or construction norm this was inferred from." },
        },
        required: ["assumption", "basis"],
      },
    },
    openQuestions: {
      type: "array",
      description:
        "Specs the developer must resolve before commercialization — missing durometers, dimensions, vendor questions, unconfirmed methods.",
      items: { type: "string" },
    },
  },
  required: ["bom", "tooling", "assumptions", "openQuestions"],
} as const;

export type BomRow = {
  section: (typeof BOM_SECTIONS)[number];
  partName: string;
  material: string;
  supplier: string;
  color: string;
  aiSuggested: boolean;
  comments: string;
};

export type ToolingRow = {
  section: string;
  description: string;
  toolCode: string;
  supplier: string;
  state: string;
};

export type Extraction = {
  bom: BomRow[];
  tooling: ToolingRow[];
  assumptions: { assumption: string; basis: string }[];
  openQuestions: string[];
};

export const EXTRACTION_SYSTEM = `You are Cascade, an extraction engine built by a footwear developer. You read one footwear design (its tech-pack brief, numbered material callouts, branding, construction, and tooling notes) and produce the INITIAL commercialization documents: a grouped Bill of Materials and a Tooling table, plus an explicit list of assumptions and open questions.

This is the FIRST draft that kicks off the project — not the finalized, pinned M-BOM. So:
- Build the BOM with real factory part granularity. A real upper is 30+ parts, and most of them are NON-VISIBLE: ~75% of a BOM is reinforcements, laminations, backers, linings, and structural parts that aren't drawn on the design board. The visible callouts are only the outer materials — you must derive the inner package from them. The toe, vamp, and quarter each spawn reinforcers and laminations; tongue splits into top, lining, and foam; there are linings, bindings, side accents, a heel counter, a Strobel board, and laces.
- Derive the non-visible package from the OUTER material + construction. Each outer panel typically needs its reinforcement/lamination/lining chosen to match that outer material's type, weight, and the construction (e.g. a perforated synthetic forefoot needs a backer that doesn't bridge the perfs; a stitched overlap needs a lamination). Set aiSuggested=TRUE on every such inferred row and ALSO log it in "assumptions". Set aiSuggested=FALSE for parts that map directly to a numbered design callout.
- Group rows into sections: Upper, Midsole, Outsole, Sockliner, Packaging. Include standard Packaging rows (toe stuffing, C/O label, inner box, outer carton, tissue) — these are always present (and are aiSuggested=TRUE).
- One color column only — the lead colorway from the design front matter. Non-visible parts are usually "Natural".
- Be specific and use real footwear material names (PDM-style). NEVER invent a numeric PDM material code, a durometer, a weld temperature, a stud height, or a dimension that the design did not state. If a spec is missing and matters, it goes in openQuestions, not the BOM.
- For suppliers: the design's material specs name real vendors (e.g. Dongjin, San Fang, Baiksan, Sukyoung, Sambu) — pull those names through onto the matching BOM rows. Where no vendor is named, use "TBD — sourcing" or "Factory in-house"; the factory sources the rest. Never invent a vendor the design didn't name.
- Tooling codes are "TBD" at this stage unless the design states a carryover die.`;

export const EXTRACTION_USER = (designText: string) =>
  `Here is the full design for one footwear style. Produce the initial grouped BOM, the Tooling table, the assumptions, and the open questions.\n\n${designText}`;

// ---- PFC generation (streamed) ---------------------------------------------
// The Process Flow Chart is the hero. A real production PFC runs ~150 pages and
// indexes dozens of process specs. We generate the INITIAL PFC: the correct
// manufacturing spine, sectioned exactly like a real PFC index, sparse where the
// design can't yet specify, with [confirm: …] in place of invented numbers.

export const PFC_SYSTEM = `You are Cascade, writing the INITIAL Process Flow Chart (PFC) for a footwear factory — the manufacturing sequence that a real shoe's production PFC documents across ~150 pages and dozens of process specs.

Follow the real PFC index order. Emit these sections, each as a level-2 markdown header "## N. SECTION NAME", with a one-line setup note then numbered steps:

## 1. Lamination
## 2. Cutting — Die Schedule
## 3. Skiving & Perforation
## 4. Logo, Screen Print & HF Welding
## 5. Computer Stitching
## 6. Upper Assembly & Strobel Close
## 7. Plate Injection (Outside Vendor)
## 8. EVA / Phylon Midsole
## 9. Stockfitting (Midsole → Outsole)
## 10. Sockliner
## 11. Assembly — Lasting & Bottom Attach
## 12. Cleated Toe Spring & QC
## 13. Packing

Rules:
- Use the actual materials, parts, and construction from the design and the extracted BOM. Reference parts by their BOM names.
- This is the INITIAL PFC and the first step of a 12–24 month project. The tech developer defines the step SEQUENCE and the materials; the FACTORY determines the process parameters (temperatures, times, pressures, durometers, dimensions) later, while actually building the shoe.
- Be correct and concrete, not exhaustive — a few real steps per section.
- FACTORY FIELDS: never invent a process parameter. Where a step needs a temperature, time, pressure, durometer, or dimension, write a blank factory field as "[factory: <what>]" (e.g. "HF weld at [factory: temp/time/pressure]"). These are blanks the FACTORY fills in during build — not the developer. Use them sparingly: at most ONE [factory: …] per step, consolidating multiple parameters into a single field.
- INFERRED STEPS: most steps follow directly from the design and BOM — leave those unmarked. But when YOU introduce a step the design did not explicitly call out — e.g., cutting or prepping a material that wasn't a design callout, or a reinforcement/lamination step you inferred — begin that step with "[+] " so the developer can confirm it. Only a few steps across the whole PFC should be marked [+].
- Plain markdown: "## " section headers, numbered steps ("1.", "2."). No preamble, no closing summary — start with "## 1. Lamination".`;

export const PFC_USER = (designText: string, extraction: Extraction) =>
  `Design:\n\n${designText}\n\nExtracted BOM (grouped) and tooling:\n${JSON.stringify(
    { bom: extraction.bom, tooling: extraction.tooling },
    null,
    2,
  )}\n\nWrite the initial Process Flow Chart for the Falcon TR-1.`;
