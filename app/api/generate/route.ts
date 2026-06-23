import Anthropic from "@anthropic-ai/sdk";
import {
  MODEL,
  EXTRACTION_SCHEMA,
  EXTRACTION_SYSTEM,
  EXTRACTION_USER,
  PFC_SYSTEM,
  PFC_USER,
  type Extraction,
} from "@/app/lib/cascade";
import { STYLE_META, CALLOUTS, designAsText } from "@/app/lib/design";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server-Sent-Events helper.
function sse(controller: ReadableStreamDefaultController, obj: unknown) {
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY is not set" }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  const client = new Anthropic();
  const designText = designAsText();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        sse(controller, { type: "meta", meta: STYLE_META });

        // Phase 1 — reading the design board. Reveal the known nomenclature
        // callouts one at a time so the CAD markers light up as Cascade "reads".
        sse(controller, { type: "phase", phase: "reading" });
        for (const c of CALLOUTS) {
          sse(controller, { type: "callout", n: c.n });
          await sleep(180);
        }
        await sleep(300);

        // Phase 2 — structured extraction (real Claude call)
        sse(controller, { type: "phase", phase: "extracting" });
        const extractResp = await client.messages.create({
          model: MODEL,
          max_tokens: 8000,
          system: EXTRACTION_SYSTEM,
          messages: [{ role: "user", content: EXTRACTION_USER(designText) }],
          output_config: {
            format: { type: "json_schema", schema: EXTRACTION_SCHEMA },
          },
        } as Anthropic.MessageCreateParamsNonStreaming);

        const textBlock = extractResp.content.find((b) => b.type === "text");
        const extraction: Extraction = JSON.parse(
          textBlock && "text" in textBlock ? textBlock.text : "{}",
        );

        sse(controller, {
          type: "extraction",
          bom: extraction.bom,
          tooling: extraction.tooling,
          assumptions: extraction.assumptions,
          openQuestions: extraction.openQuestions,
        });

        // Phase 3 — generate the PFC (real streamed Claude call)
        sse(controller, { type: "phase", phase: "generating" });
        const pfcStream = client.messages.stream({
          model: MODEL,
          max_tokens: 6000,
          system: PFC_SYSTEM,
          messages: [{ role: "user", content: PFC_USER(designText, extraction) }],
        });

        let pfc = "";
        for await (const event of pfcStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            pfc += event.delta.text;
            sse(controller, { type: "pfc_delta", text: event.delta.text });
          }
        }

        sse(controller, {
          type: "done",
          data: {
            meta: STYLE_META,
            bom: extraction.bom,
            tooling: extraction.tooling,
            assumptions: extraction.assumptions,
            openQuestions: extraction.openQuestions,
            pfc,
          },
        });
      } catch (err) {
        const message =
          err instanceof Anthropic.APIError
            ? `Claude API error ${err.status}: ${err.message}`
            : err instanceof Error
              ? err.message
              : "Unknown error";
        sse(controller, { type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
