// Server-only helpers: catalog loaded from the connected database, redaction, Groq call and strict output validation.
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Catalog } from "./catalog";

export const MODEL_ID = "openai/gpt-oss-20b";

let cachedCatalog: { at: number; cat: Catalog } | null = null;

// Reads the four read-only synthetic tables (RLS: is_synthetic = true). Cached briefly per worker.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadCatalog(sb: SupabaseClient<any>): Promise<Catalog> {
  if (cachedCatalog && Date.now() - cachedCatalog.at < 10 * 60_000) return cachedCatalog.cat;
  const [d, o, f, h] = await Promise.all([
    sb.from("destinations").select("*"),
    sb.from("origins").select("*"),
    sb.from("flights").select("*").range(0, 1999),
    sb.from("hotels").select("*"),
  ]);
  if (d.error || o.error || f.error || h.error) throw new Error("catalog_unavailable");
  if (!d.data?.length || !o.data?.length || !f.data?.length || !h.data?.length) throw new Error("catalog_empty");
  const cat: Catalog = {
    raw: { destinations: [], origins: [], flights: [], hotels: [] },
    destinations: d.data.map((r) => ({ ...r, description: r.description ?? "" })),
    origins: o.data,
    flights: f.data,
    hotels: h.data.map((r) => ({
      ...r,
      diet_tags: String(r.diet_tags ?? "").split(/[|;]/).map((s: string) => s.trim().toLowerCase()).filter(Boolean),
    })),
  };
  cachedCatalog = { at: Date.now(), cat };
  return cat;
}

export function redact(s: string): string {
  return s
    .replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, "[redacted-id]")
    .replace(/\b(?:\d[ -]?){13,19}\b/g, "[redacted-card]")
    .replace(/\b[A-Z][0-9]{7}\b/g, "[redacted-passport]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[redacted-email]")
    .replace(/\b(?:\+91[- ]?)?[6-9]\d{9}\b/g, "[redacted-phone]")
    .replace(/\b(gsk_|sk-|sb_secret_|sb_publishable_)[A-Za-z0-9_-]+/g, "[redacted-key]");
}

let inFlight = 0;
export const MAX_CONCURRENT = 2;
export function tryAcquire() { if (inFlight >= MAX_CONCURRENT) return false; inFlight++; return true; }
export function release() { inFlight = Math.max(0, inFlight - 1); }

export async function callGroq(key: string, messages: { role: string; content: string }[]) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL_ID, temperature: 0.2, response_format: { type: "json_object" }, messages }),
    });
    if (res.status === 429) return { error: "quota" as const };
    if (res.status === 401 || res.status === 403) return { error: "auth" as const };
    if (!res.ok) { console.error("groq status", res.status); return { error: "upstream" as const }; }
    const j = await res.json();
    return { content: String(j?.choices?.[0]?.message?.content ?? "") };
  } catch {
    return { error: "timeout" as const };
  } finally {
    clearTimeout(timer);
  }
}

const ALLOWED_PATCH = new Set(["origin", "destination", "start_date", "end_date", "budget_inr", "budget_basis", "adults", "children_ages", "group_type", "diet", "preferences"]);
const ACTIONS = new Set(["edit_inputs", "retry", "open_details"]);
const PREF_KEYS = new Set(["quiet_required", "step_free_required", "refundable_required", "max_stops"]);

export const outputSchema = z.object({
  status: z.enum(["clarify", "explain", "no_match", "out_of_scope", "limitation"]),
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

const patchSchema = z.object({
  origin: z.string().max(60), destination: z.string().max(60),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  budget_inr: z.number().int().positive().max(10_000_000), budget_basis: z.enum(["total", "per_person"]),
  adults: z.number().int().min(1).max(6), children_ages: z.array(z.number().int().min(0).max(17)).max(5),
  group_type: z.enum(["solo", "couple", "friends", "family"]), diet: z.enum(["none", "vegetarian", "vegan", "jain"]),
  preferences: z.object({
    quiet_required: z.boolean(), step_free_required: z.boolean(), refundable_required: z.boolean(),
    max_stops: z.union([z.literal(0), z.literal(1), z.null()]),
  }).partial().strict(),
}).partial().strict();

export function validateOutput(raw: string, mode: "extract" | "explain", allowed: Map<string, { total: number; ids: [string, string] }>): AssistantOutput | null {
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return null; }
  const p = outputSchema.safeParse(json);
  if (!p.success) return null;
  const o = p.data;
  const text = [o.message, o.question ?? "", ...o.options.flatMap((x) => [x.reason, x.tradeoff])].join(" ");
  if (/<[a-z/][^>]*>|https?:\/\/|```/i.test(text)) return null;
  if (/(gsk_|sk-|sb_secret_)/.test(text)) return null;
  if (!o.actions.every((a) => ACTIONS.has(a))) return null;
  if (Object.keys(o.input_patch).some((k) => !ALLOWED_PATCH.has(k))) return null;
  const pp = o.input_patch["preferences"];
  if (pp && (typeof pp !== "object" || Object.keys(pp).some((k) => !PREF_KEYS.has(k)))) return null;
  if (!patchSchema.safeParse(o.input_patch).success) return null;
  if (mode === "explain" && Object.keys(o.input_patch).length) return null;
  if (mode === "extract" && (o.options.length || o.status === "explain" || o.actions.includes("open_details"))) return null;
  if (o.status !== "explain" && o.options.length) return null;
  if (o.status === "explain" && !o.options.length) return null;
  const seen = new Set<string>();
  for (const opt of o.options) {
    const a = allowed.get(opt.option_id);
    if (!a || seen.has(opt.option_id) || a.total !== opt.total_inr || a.ids[0] !== opt.record_ids[0] || a.ids[1] !== opt.record_ids[1]) return null;
    seen.add(opt.option_id);
  }
  if (o.status === "explain" && !o.message.includes("Synthetic demo")) return null;
  return o;
}
