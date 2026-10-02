import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import systemPrompt from "@/data/assistant-prompt.txt?raw";
import { retrieve, type TripInputs } from "./planner";
import { DATASET_VERSION } from "./catalog";

// Backend configuration is read only inside handlers (server-side). No paid gateway or fallback.
export const getBackendStatus = createServerFn({ method: "GET" }).handler(async () => {
  return {
    groq: Boolean(process.env['GROQ_API_KEY']),
    supabase: Boolean(process.env['SUPABASE_URL'] && process.env['SUPABASE_PUBLISHABLE_KEY']),
  };
});

const tripSchema = z.object({
  origin: z.string().max(60), destination: z.string().max(60),
  start_date: z.string().max(10), end_date: z.string().max(10),
  budget_inr: z.number().int().positive().max(10_000_000).nullable(),
  budget_basis: z.enum(["total", "per_person"]).nullable(),
  adults: z.number().int().min(0).max(6), children_ages: z.array(z.number().int()).max(6),
  group_type: z.enum(["solo", "couple", "friends", "family"]).nullable(),
  diet: z.enum(["none", "vegetarian", "vegan", "jain"]).nullable(),
  personalisation_confirmed: z.boolean(),
  preferences: z.object({
    quiet_required: z.boolean(), step_free_required: z.boolean(), refundable_required: z.boolean(),
    max_stops: z.union([z.literal(0), z.literal(1), z.null()]),
  }),
});

const inputSchema = z.object({
  mode: z.enum(["extract", "explain"]),
  message: z.string().trim().max(1000).optional(),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(1000) })).max(12).default([]),
  trip: tripSchema,
  trip_version: z.number().int().min(0),
});

const ALLOWED_PATCH = new Set(["origin", "destination", "start_date", "end_date", "budget_inr", "budget_basis", "adults", "children_ages", "group_type", "diet", "preferences"]);
const STATUSES = ["clarify", "explain", "no_match", "out_of_scope", "limitation"] as const;
const ACTIONS = new Set(["edit_inputs", "retry", "open_details"]);

const outputSchema = z.object({
  status: z.enum(STATUSES),
  message: z.string().max(900),
  question: z.string().max(400).nullable(),
  input_patch: z.record(z.string(), z.any()),
  options: z.array(z.object({
    option_id: z.string(), total_inr: z.number(), reason: z.string().max(300), tradeoff: z.string().max(300),
    record_ids: z.tuple([z.string(), z.string()]),
  }).strict()).max(3),
  actions: z.array(z.string()),
}).strict();

export type AssistantOutput = z.infer<typeof outputSchema>;

// Redact sensitive identifiers before anything is sent to the model or stored.
export function redact(s: string): string {
  return s
    .replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, "[redacted-id]")
    .replace(/\b(?:\d[ -]?){13,19}\b/g, "[redacted-card]")
    .replace(/\b[A-Z][0-9]{7}\b/g, "[redacted-passport]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[redacted-email]")
    .replace(/\b(?:\+91[- ]?)?[6-9]\d{9}\b/g, "[redacted-phone]")
    .replace(/\b(gsk_|sk-|sb_secret_)[A-Za-z0-9_-]+/g, "[redacted-key]");
}

type Result =
  | { status: "not_configured" }
  | { status: "invalid_input"; issues: string[] }
  | { status: "retrieval_error"; retryable: true }
  | { status: "model_error"; retryable: true; code: string }
  | { status: "ok"; output: AssistantOutput; saved: false; save_note: string; trip_version: number; dataset_version: string };

async function callGroq(key: string, messages: { role: string; content: string }[]) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "llama-3.3-70b-versatile", temperature: 0.2, response_format: { type: "json_object" }, messages }),
    });
    if (res.status === 429) return { error: "quota" as const };
    if (!res.ok) return { error: "upstream" as const };
    const j = await res.json();
    return { content: String(j?.choices?.[0]?.message?.content ?? "") };
  } catch {
    return { error: "timeout" as const };
  } finally {
    clearTimeout(timer);
  }
}

export const runAssistant = createServerFn({ method: "POST" })
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data }): Promise<Result> => {
    const key = process.env['GROQ_API_KEY'];
    if (!key) return { status: "not_configured" };

    const trip = data.trip as TripInputs;
    let envelope: Record<string, unknown>;
    let allowed: Map<string, { total: number; ids: [string, string] }> = new Map();

    if (data.mode === "explain") {
      let r;
      try { r = retrieve(trip); } catch { return { status: "retrieval_error", retryable: true }; }
      if (r.status === "invalid") return { status: "invalid_input", issues: r.issues.map((i) => i.message) };
      allowed = new Map(r.options.map((o) => [o.option_id, { total: o.breakdown.total_inr, ids: [o.flight.flight_id, o.hotel.hotel_id] }]));
      envelope = {
        mode: "explain", trip_version: data.trip_version, dataset_version: DATASET_VERSION, confirmed_inputs: trip,
        retrieval_status: "ok", filters: r.filters, result_count: r.eligible_in_budget, group_budget_inr: r.group_budget_inr,
        eligible_options: r.options.map((o) => ({
          option_id: o.option_id, flight_id: o.flight.flight_id, hotel_id: o.hotel.hotel_id, ...o.breakdown,
          stops_each_way: o.flight.stops_each_way, duration_minutes_each_way: o.flight.duration_minutes_each_way,
          baggage_kg: o.flight.baggage_kg, quiet: o.hotel.quiet, step_free: o.hotel.step_free, diet_tags: o.hotel.diet_tags,
          refundable: o.hotel.refundable, cancellation_terms: o.hotel.cancellation_terms,
        })),
        no_match_diagnostics: r.diagnostics,
        limitations: "Synthetic data. Children 2–17 charged full price. Excludes sightseeing, insurance, extra baggage, shopping.",
      };
    } else {
      envelope = { mode: "extract", trip_version: data.trip_version, current_trip_state: trip, latest_user_message: redact(data.message ?? "") };
    }

    const messages = [
      { role: "system", content: systemPrompt },
      ...data.history.map((h) => ({ role: h.role, content: redact(h.content) })),
      { role: "user", content: JSON.stringify(envelope) },
    ];

    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await callGroq(key, messages);
      if ("error" in res) return { status: "model_error", retryable: true, code: res.error ?? "upstream" };
      const parsed = validateOutput(res.content, data.mode, allowed);
      if (parsed) {
        return { status: "ok", output: parsed, saved: false, save_note: "Database not connected — this reply was not saved.", trip_version: data.trip_version, dataset_version: DATASET_VERSION };
      }
      messages.push({ role: "user", content: "Your previous reply failed validation. Return exactly one JSON object matching the output contract, using only supplied IDs and totals." });
    }
    return { status: "model_error", retryable: true, code: "invalid_output" };
  });

function validateOutput(raw: string, mode: "extract" | "explain", allowed: Map<string, { total: number; ids: [string, string] }>): AssistantOutput | null {
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return null; }
  const p = outputSchema.safeParse(json);
  if (!p.success) return null;
  const o = p.data;
  if (/<[a-z/][^>]*>|https?:\/\//i.test(o.message)) return null;
  if (!o.actions.every((a) => ACTIONS.has(a))) return null;
  if (Object.keys(o.input_patch).some((k) => !ALLOWED_PATCH.has(k))) return null;
  if (mode === "extract" && o.options.length) return null;
  if (o.status !== "explain" && o.options.length) return null;
  for (const opt of o.options) {
    const a = allowed.get(opt.option_id);
    if (!a || a.total !== opt.total_inr || a.ids[0] !== opt.record_ids[0] || a.ids[1] !== opt.record_ids[1]) return null;
  }
  if (o.status === "explain" && !o.message.includes("Synthetic demo")) return null;
  return o;
}
