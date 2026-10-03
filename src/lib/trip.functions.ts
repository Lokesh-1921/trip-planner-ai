import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import systemPrompt from "@/data/assistant-prompt.txt?raw";
import { retrieve, type RetrievalResult, type TripInputs } from "./planner";
import { DATASET_VERSION } from "./catalog";
import { callGroq, loadCatalog, MODEL_ID, redact, release, tryAcquire, validateOutput, type AssistantOutput } from "./trip.server";

export type { AssistantOutput };

const PER_MIN = 5, PER_DAY = 50, PROJECT_DAY_CAP = 400; // project cap kept well below Groq Free daily request quota (each turn may use 2 calls)

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
const fault = z.enum(["retrieval", "model", "save"]).nullable().default(null);
const key = z.string().min(8).max(80);
const uuid = z.string().uuid();

type Ctx = { supabase: any; userId: string }; // eslint-disable-line @typescript-eslint/no-explicit-any
type Allowed = Map<string, { total: number; ids: [string, string] }>;

async function rateCheck(ctx: Ctx): Promise<null | "rate_limited" | "daily_limit" | "project_cap"> {
  const since = (ms: number) => new Date(Date.now() - ms).toISOString();
  const count = async (table: string, from: string, extra: (q: any) => any, admin = false) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    let client = ctx.supabase;
    if (admin) client = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const { count: c } = await extra(client.from(table).select("*", { count: "exact", head: true }).gte("created_at", from));
    return c ?? 0;
  };
  const userMsgs = (q: any) => q.eq("role", "user"); // eslint-disable-line @typescript-eslint/no-explicit-any
  const modelTraces = (q: any) => q.not("model_id", "is", null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const min = (await count("messages", since(60_000), userMsgs)) + (await count("retrieval_traces", since(60_000), modelTraces));
  if (min >= PER_MIN) return "rate_limited";
  const day = (await count("messages", since(86_400_000), userMsgs)) + (await count("retrieval_traces", since(86_400_000), modelTraces));
  if (day >= PER_DAY) return "daily_limit";
  try {
    const proj = (await count("messages", since(86_400_000), userMsgs, true)) + (await count("retrieval_traces", since(86_400_000), modelTraces, true));
    if (proj >= PROJECT_DAY_CAP) return "project_cap";
  } catch { /* admin unavailable: per-session limits still apply */ }
  return null;
}

async function runModel(envelope: object, history: { role: string; content: string }[], mode: "extract" | "explain", allowed: Allowed, injectFault: boolean) {
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) return { error: "not_configured" as const };
  if (injectFault) return { error: "fault_injected" as const };
  if (!tryAcquire()) return { error: "busy" as const };
  try {
    const messages = [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: JSON.stringify(envelope) }];
    for (let attempt = 0; attempt < 2; attempt++) { // first try + at most one repair
      const res = await callGroq(apiKey, messages);
      if ("error" in res) return { error: res.error ?? "upstream" };
      const out = validateOutput(res.content, mode, allowed);
      if (out) return { output: out };
      messages.push({ role: "user", content: "Your previous reply failed validation. Return exactly one JSON object with only the six contract keys, using only supplied IDs and totals." });
    }
    return { error: "invalid_output" as const };
  } finally { release(); }
}

async function logEvent(ctx: Ctx, name: string, trip_id: string | null, properties: Record<string, unknown> = {}) {
  await ctx.supabase.from("events").insert({ name, trip_id, owner_id: ctx.userId, properties });
}

async function historyFor(ctx: Ctx, trip_id: string) {
  const { data } = await ctx.supabase.from("messages").select("role, redacted_content").eq("trip_id", trip_id).order("created_at", { ascending: false }).limit(6);
  return ((data ?? []) as { role: string; redacted_content: string }[]).reverse().map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.redacted_content.slice(0, 1000) }));
}

function envelopeFor(r: Exclude<RetrievalResult, { status: "invalid" }>, trip: TripInputs, version: number) {
  const allowed: Allowed = new Map(r.options.map((o) => [o.option_id, { total: o.breakdown.total_inr, ids: [o.flight.flight_id, o.hotel.hotel_id] }]));
  return {
    allowed,
    envelope: {
      mode: "explain", trip_version: version, dataset_version: DATASET_VERSION, confirmed_inputs: trip,
      retrieval_status: "ok", filters: r.filters, result_count: r.eligible_in_budget, group_budget_inr: r.group_budget_inr,
      eligible_options: r.options.map((o) => ({
        option_id: o.option_id, flight_id: o.flight.flight_id, hotel_id: o.hotel.hotel_id, ...o.breakdown,
        stops_each_way: o.flight.stops_each_way, duration_minutes_each_way: o.flight.duration_minutes_each_way,
        baggage_kg: o.flight.baggage_kg, quiet: o.hotel.quiet, step_free: o.hotel.step_free, diet_tags: o.hotel.diet_tags,
        refundable: o.hotel.refundable, cancellation_terms: o.hotel.cancellation_terms,
      })),
      no_match_diagnostics: r.diagnostics,
      limitations: "Synthetic data. Children 2–17 charged full price. Excludes sightseeing, insurance, extra baggage, shopping.",
    },
  };
}

// ---------- Restore latest saved state (same device / same anonymous session) ----------
export const restoreSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    const { data: trip } = await ctx.supabase.from("trips").select("*").gt("expires_at", new Date().toISOString()).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (!trip) return { trip: null };
    const { data: msgs } = await ctx.supabase.from("messages").select("role, redacted_content, validated_output, trip_version, created_at").eq("trip_id", trip.trip_id).order("created_at", { ascending: true }).limit(40);
    const all = (msgs ?? []) as { role: string; redacted_content: string; validated_output: AssistantOutput | null; trip_version: number }[];
    const explain = [...all].reverse().find((m) => m.role === "assistant" && m.trip_version === trip.trip_version && m.validated_output && (m.validated_output.status === "explain" || m.validated_output.status === "no_match") && m.redacted_content.startsWith("[explain]"));
    let result: RetrievalResult | null = null;
    if (trip.status === "confirmed") {
      try { result = retrieve(trip.confirmed_inputs as TripInputs, await loadCatalog(ctx.supabase)); } catch { result = null; }
    }
    const { data: sel } = await ctx.supabase.from("selections").select("option_id").eq("trip_id", trip.trip_id).eq("trip_version", trip.trip_version).limit(1).maybeSingle();
    return {
      trip: { trip_id: trip.trip_id as string, trip_version: trip.trip_version as number, status: trip.status as string, inputs: trip.confirmed_inputs as TripInputs },
      chat: all.filter((m) => !m.redacted_content.startsWith("[explain]")).map((m) => ({ role: m.role, text: m.role === "assistant" && m.validated_output ? m.validated_output.message : m.redacted_content, question: m.validated_output?.question ?? null })),
      result: result && result.status !== "invalid" ? result : null,
      explanation: explain?.validated_output ?? null,
      selected_option_id: (sel?.option_id as string | undefined) ?? null,
    };
  });

async function ensureTrip(ctx: Ctx, trip_id: string | null, inputs: TripInputs) {
  if (trip_id) {
    const { data } = await ctx.supabase.from("trips").select("trip_id, trip_version").eq("trip_id", trip_id).maybeSingle();
    if (data) return data as { trip_id: string; trip_version: number };
  }
  const { data, error } = await ctx.supabase.from("trips").insert({ owner_id: ctx.userId, dataset_version: DATASET_VERSION, confirmed_inputs: inputs, status: "draft", trip_version: 0 }).select("trip_id, trip_version").single();
  if (error) throw new Error("save_failed");
  await logEvent(ctx, "session_started", data.trip_id);
  return data as { trip_id: string; trip_version: number };
}

// ---------- Chat: extraction (proposed patch only; user must confirm) ----------
export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ trip_id: uuid.nullable(), message: z.string().trim().min(1).max(1000), inputs: tripSchema, idempotency_key: key, fault }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const limited = await rateCheck(ctx);
    if (limited) return { status: limited } as const;
    let trip;
    try { trip = await ensureTrip(ctx, data.trip_id, data.inputs as TripInputs); } catch { return { status: "save_error" } as const; }
    const { data: prior } = await ctx.supabase.from("messages").select("validated_output").eq("idempotency_key", `${data.idempotency_key}:a`).maybeSingle();
    if (prior?.validated_output) return { status: "ok", trip_id: trip.trip_id, output: prior.validated_output as AssistantOutput, saved: true } as const;
    const clean = redact(data.message);
    const history = await historyFor(ctx, trip.trip_id);
    const u = await ctx.supabase.from("messages").upsert({ trip_id: trip.trip_id, owner_id: ctx.userId, trip_version: trip.trip_version, role: "user", redacted_content: clean, idempotency_key: `${data.idempotency_key}:u` }, { onConflict: "owner_id,idempotency_key", ignoreDuplicates: true });
    const res = await runModel({ mode: "extract", trip_version: trip.trip_version, current_trip_state: data.inputs, latest_user_message: clean }, history, "extract", new Map(), data.fault === "model");
    if ("error" in res) {
      await logEvent(ctx, "error_shown", trip.trip_id, { code: res.error, mode: "extract" });
      return { status: res.error === "not_configured" ? "not_configured" : "model_error", code: res.error, trip_id: trip.trip_id } as const;
    }
    let saved = !u.error && data.fault !== "save";
    if (saved) {
      const a = await ctx.supabase.from("messages").insert({ trip_id: trip.trip_id, owner_id: ctx.userId, trip_version: trip.trip_version, role: "assistant", redacted_content: redact(res.output.message), validated_output: res.output, idempotency_key: `${data.idempotency_key}:a` });
      saved = !a.error;
    }
    return { status: "ok", trip_id: trip.trip_id, output: res.output, saved } as const;
  });

// ---------- Confirm trip: versioned save, server retrieval, trace, grounded explanation ----------
export const confirmTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ trip_id: uuid.nullable(), expected_version: z.number().int().min(0), inputs: tripSchema, idempotency_key: key, fault }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const inputs = data.inputs as TripInputs;
    if (data.fault === "retrieval") return { status: "retrieval_error" } as const;
    let cat;
    try { cat = await loadCatalog(ctx.supabase); } catch { return { status: "retrieval_error" } as const; }
    const r = retrieve(inputs, cat);
    if (r.status === "invalid") return { status: "invalid_input", issues: r.issues.map((i) => i.message) } as const;

    // Versioned save with optimistic locking.
    let trip_id = data.trip_id, version = data.expected_version + 1, saved = data.fault !== "save";
    if (saved) {
      if (trip_id) {
        const { data: upd, error } = await ctx.supabase.from("trips").update({ trip_version: version, confirmed_inputs: inputs, status: "confirmed", dataset_version: DATASET_VERSION, updated_at: new Date().toISOString(), expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString() }).eq("trip_id", trip_id).eq("trip_version", data.expected_version).select("trip_id").maybeSingle();
        if (error) saved = false;
        else if (!upd) {
          const { data: latest } = await ctx.supabase.from("trips").select("trip_version, confirmed_inputs").eq("trip_id", trip_id).maybeSingle();
          if (latest) return { status: "conflict", trip_version: latest.trip_version as number, inputs: latest.confirmed_inputs as TripInputs } as const;
          trip_id = null;
        }
      }
      if (saved && !trip_id) {
        const { data: ins, error } = await ctx.supabase.from("trips").insert({ owner_id: ctx.userId, trip_version: version, confirmed_inputs: inputs, status: "confirmed", dataset_version: DATASET_VERSION }).select("trip_id").single();
        if (error) saved = false; else { trip_id = ins.trip_id; await logEvent(ctx, "session_started", trip_id); }
      }
    }

    let explanation: AssistantOutput | null = null;
    let ai_status: string = "ok";
    const limited = await rateCheck(ctx);
    if (limited) ai_status = limited;
    else {
      const { envelope, allowed } = envelopeFor(r, inputs, version);
      const res = await runModel(envelope, [], "explain", allowed, data.fault === "model");
      if ("error" in res) ai_status = res.error === "not_configured" ? "not_configured" : "model_error";
      else if (r.status === "no_match" ? res.output.status !== "no_match" && res.output.status !== "limitation" : res.output.status !== "explain") ai_status = "model_error";
      else explanation = res.output;
    }

    if (saved && trip_id) {
      const t = await ctx.supabase.from("retrieval_traces").insert({
        trip_id, owner_id: ctx.userId, trip_version: version, dataset_version: DATASET_VERSION, filters: r.filters,
        result_count: r.eligible_in_budget, record_ids: r.options.map((o) => [o.flight.flight_id, o.hotel.hotel_id]),
        error_code: ai_status === "ok" ? null : ai_status, model_id: limited ? null : MODEL_ID,
      });
      if (t.error) saved = false;
      if (saved && explanation) {
        const m = await ctx.supabase.from("messages").upsert({ trip_id, owner_id: ctx.userId, trip_version: version, role: "assistant", redacted_content: `[explain] ${redact(explanation.message)}`, validated_output: explanation, idempotency_key: `${data.idempotency_key}:x` }, { onConflict: "owner_id,idempotency_key", ignoreDuplicates: true });
        if (m.error) saved = false;
      }
      await logEvent(ctx, "trip_confirmed", trip_id, { result_count: r.eligible_in_budget, status: r.status });
      if (ai_status !== "ok") await logEvent(ctx, "error_shown", trip_id, { code: ai_status, mode: "explain" });
    }
    return { status: "ok", trip_id, trip_version: version, result: r, explanation, ai_status, saved } as const;
  });

// ---------- Details: owner + version checks ----------
export const getDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ trip_id: uuid, trip_version: z.number().int(), option_id: z.string().max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { data: trip } = await ctx.supabase.from("trips").select("trip_version, confirmed_inputs, status").eq("trip_id", data.trip_id).maybeSingle();
    if (!trip) return { status: "not_found" } as const;
    if (trip.trip_version !== data.trip_version || trip.status !== "confirmed") return { status: "stale" } as const;
    let r;
    try { r = retrieve(trip.confirmed_inputs as TripInputs, await loadCatalog(ctx.supabase)); } catch { return { status: "retrieval_error" } as const; }
    const o = r.status !== "invalid" ? r.options.find((x) => x.option_id === data.option_id) : undefined;
    if (!o) return { status: "stale" } as const;
    await logEvent(ctx, "details_opened", data.trip_id, { option_id: o.option_id });
    return { status: "ok", option: o } as const;
  });

// ---------- Simulated selection: idempotent, requires saved current option ----------
export const selectOption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ trip_id: uuid, trip_version: z.number().int(), option_id: z.string().max(40), idempotency_key: key }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { data: trip } = await ctx.supabase.from("trips").select("trip_version, confirmed_inputs, status").eq("trip_id", data.trip_id).maybeSingle();
    if (!trip) return { status: "not_found" } as const;
    if (trip.trip_version !== data.trip_version || trip.status !== "confirmed") return { status: "stale" } as const;
    const { data: trace } = await ctx.supabase.from("retrieval_traces").select("record_ids").eq("trip_id", data.trip_id).eq("trip_version", data.trip_version).limit(1).maybeSingle();
    if (!trace) return { status: "not_saved" } as const;
    let r;
    try { r = retrieve(trip.confirmed_inputs as TripInputs, await loadCatalog(ctx.supabase)); } catch { return { status: "retrieval_error" } as const; }
    if (r.status === "invalid" || !r.options.some((o) => o.option_id === data.option_id)) return { status: "stale" } as const;
    const ins = await ctx.supabase.from("selections").upsert({ trip_id: data.trip_id, owner_id: ctx.userId, trip_version: data.trip_version, option_id: data.option_id, simulated: true, idempotency_key: data.idempotency_key }, { onConflict: "owner_id,idempotency_key", ignoreDuplicates: true });
    if (ins.error) return { status: "save_error" } as const;
    const { data: sel } = await ctx.supabase.from("selections").select("selection_id, option_id").eq("idempotency_key", data.idempotency_key).maybeSingle();
    await logEvent(ctx, "selection_simulated", data.trip_id, { option_id: data.option_id });
    return { status: "ok", selection_id: sel?.selection_id as string, option_id: (sel?.option_id as string) ?? data.option_id } as const;
  });

// ---------- Clear my session: removes only the caller's private rows ----------
export const clearSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    const a = await ctx.supabase.from("trips").delete().eq("owner_id", ctx.userId); // children cascade
    const b = await ctx.supabase.from("events").delete().eq("owner_id", ctx.userId);
    return { ok: !a.error && !b.error };
  });
