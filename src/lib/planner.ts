// Deterministic validation, retrieval, budget and ranking per retrieval-and-workflows.md v1.0.
import { getCatalog, type Catalog, type Flight, type Hotel, type Destination } from "./catalog";

export const HORIZON_START = "2026-11-01";
export const HORIZON_END = "2027-03-31";

export type BudgetBasis = "total" | "per_person";
export type GroupType = "solo" | "couple" | "friends" | "family";
export type Diet = "none" | "vegetarian" | "vegan" | "jain";

export type TripInputs = {
  origin: string;
  destination: string;
  start_date: string;
  end_date: string;
  budget_inr: number | null;
  budget_basis: BudgetBasis | null;
  adults: number;
  children_ages: number[];
  group_type: GroupType | null;
  diet: Diet | null;
  personalisation_confirmed: boolean; // explicit "none" or chosen flags
  preferences: {
    quiet_required: boolean;
    step_free_required: boolean;
    refundable_required: boolean;
    max_stops: 0 | 1 | null; // null = any
  };
};

export const emptyTrip = (): TripInputs => ({
  origin: "", destination: "", start_date: "", end_date: "",
  budget_inr: null, budget_basis: null, adults: 1, children_ages: [],
  group_type: null, diet: null, personalisation_confirmed: false,
  preferences: { quiet_required: false, step_free_required: false, refundable_required: false, max_stops: null },
});

export type Issue = { field: keyof TripInputs | "party"; message: string };

function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y = 0, m = 0, d = 0] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

export function nightsBetween(a: string, b: string): number | null {
  const da = parseDate(a), db = parseDate(b);
  if (!da || !db) return null;
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

const norm = (s: string) => s.trim().toLowerCase();

export function resolveOrigin(city: string, cat: Catalog = getCatalog()) {
  return cat.origins.find((o) => norm(o.city) === norm(city)) ?? null;
}
export function resolveDestination(city: string, cat: Catalog = getCatalog()) {
  return cat.destinations.find((d) => norm(d.city) === norm(city)) ?? null;
}

export function validateTrip(t: TripInputs, cat: Catalog = getCatalog()): Issue[] {
  const issues: Issue[] = [];
  if (!t.origin.trim()) issues.push({ field: "origin", message: "Where are you starting from?" });
  else if (!resolveOrigin(t.origin, cat)) issues.push({ field: "origin", message: `“${t.origin}” isn't in this synthetic dataset. Pick one of the 25 listed starting cities.` });
  if (!t.destination.trim()) issues.push({ field: "destination", message: "Which destination would you like to compare?" });
  else if (!resolveDestination(t.destination, cat)) issues.push({ field: "destination", message: `“${t.destination}” isn't one of the 20 domestic demo destinations.` });
  if (t.origin.trim() && norm(t.origin) === norm(t.destination)) issues.push({ field: "destination", message: "Origin and destination must be different cities." });

  const ds = parseDate(t.start_date), de = parseDate(t.end_date);
  if (!t.start_date) issues.push({ field: "start_date", message: "Add a departure date." });
  else if (!ds) issues.push({ field: "start_date", message: "That departure date isn't a real calendar date." });
  if (!t.end_date) issues.push({ field: "end_date", message: "Add a return date." });
  else if (!de) issues.push({ field: "end_date", message: "That return date isn't a real calendar date." });
  if (ds && de) {
    const n = nightsBetween(t.start_date, t.end_date)!;
    if (n <= 0) issues.push({ field: "end_date", message: "Return must be after departure." });
    else if (n < 2 || n > 4) issues.push({ field: "end_date", message: `Stays must be 2–4 nights (you have ${n}).` });
    if (t.start_date < HORIZON_START || t.end_date > HORIZON_END)
      issues.push({ field: "start_date", message: "Supported travel dates are 1 Nov 2026 to 31 Mar 2027." });
  }

  if (t.budget_inr == null || !Number.isFinite(t.budget_inr) || t.budget_inr <= 0) issues.push({ field: "budget_inr", message: "Add a budget in INR." });
  if (!t.budget_basis) issues.push({ field: "budget_basis", message: "Is the budget a group total or per person?" });

  const P = t.adults + t.children_ages.length;
  if (!Number.isInteger(t.adults) || t.adults < 1) issues.push({ field: "adults", message: "At least one adult is required." });
  if (P > 6) issues.push({ field: "party", message: "This demo supports 1–6 travellers." });
  if (t.children_ages.some((a) => !Number.isInteger(a) || a < 2 || a > 17))
    issues.push({ field: "children_ages", message: "Children must be aged 2–17. Infants under 2 aren't supported in this demo." });

  if (!t.group_type) issues.push({ field: "group_type", message: "Who is travelling — solo, couple, friends or family?" });
  if (!t.diet) issues.push({ field: "diet", message: "Any diet preference? Choose “none” if not." });
  if (!t.personalisation_confirmed) issues.push({ field: "personalisation_confirmed", message: "Confirm stay preferences (or choose “no special needs”)." });
  return issues;
}

export type Breakdown = {
  P: number; R: number; N: number;
  flights_inr: number; stay_inr: number; meals_inr: number; transfers_inr: number;
  subtotal_inr: number; buffer_inr: number; total_inr: number;
};

export function calculate(f: Flight, h: Hotel, d: Destination, P: number, N: number): Breakdown {
  const R = Math.ceil(P / 2);
  const flights_inr = P * f.roundtrip_inr_per_person;
  const stay_inr = R * N * h.nightly_inr_per_room;
  const meals_inr = P * (N + 1) * d.meal_inr_per_person_day;
  const transfers_inr = d.transfer_inr_per_group;
  const subtotal_inr = flights_inr + stay_inr + meals_inr + transfers_inr;
  const buffer_inr = Math.ceil(0.1 * subtotal_inr);
  return { P, R, N, flights_inr, stay_inr, meals_inr, transfers_inr, subtotal_inr, buffer_inr, total_inr: subtotal_inr + buffer_inr };
}

export type TripOption = {
  option_id: string; flight: Flight; hotel: Hotel; destination: Destination;
  breakdown: Breakdown; score: number; remaining_inr: number;
};

export type RetrievalResult =
  | { status: "invalid"; issues: Issue[] }
  | {
      status: "ok" | "no_match";
      group_budget_inr: number;
      options: TripOption[];
      eligible_in_budget: number;
      filters: Record<string, unknown>;
      diagnostics: { flights_found: number; stays_found: number; combinations: number; cheapest_excluded_total: number | null; reason: string | null };
    };

const covers = (row: { valid_from: string; valid_to: string }, a: string, b: string) => row.valid_from <= a && row.valid_to >= b;

export function retrieve(t: TripInputs, cat: Catalog = getCatalog()): RetrievalResult {
  const issues = validateTrip(t, cat);
  if (issues.length) return { status: "invalid", issues };
  const o = resolveOrigin(t.origin, cat)!, d = resolveDestination(t.destination, cat)!;
  const P = t.adults + t.children_ages.length;
  const N = nightsBetween(t.start_date, t.end_date)!;
  const R = Math.ceil(P / 2);
  const group_budget_inr = t.budget_basis === "per_person" ? t.budget_inr! * P : t.budget_inr!;
  const p = t.preferences;

  const flights = cat.flights.filter((f) =>
    f.origin_id === o.origin_id && f.destination_id === d.destination_id && covers(f, t.start_date, t.end_date) &&
    (p.max_stops == null || f.stops_each_way <= p.max_stops));
  const stays = cat.hotels.filter((h) =>
    h.destination_id === d.destination_id && covers(h, t.start_date, t.end_date) &&
    (t.diet === "none" || h.diet_tags.includes(t.diet!)) &&
    (!p.quiet_required || h.quiet) && (!p.step_free_required || h.step_free) && (!p.refundable_required || h.refundable) &&
    R <= h.max_rooms);

  const all: TripOption[] = [];
  for (const f of flights) for (const h of stays) {
    const breakdown = calculate(f, h, d, P, N);
    all.push({ option_id: `O-${f.flight_id}-${h.hotel_id}`, flight: f, hotel: h, destination: d, breakdown, score: 0, remaining_inr: group_budget_inr - breakdown.total_inr });
  }
  const inBudget = all.filter((x) => x.breakdown.total_inr <= group_budget_inr);
  const excluded = all.filter((x) => x.breakdown.total_inr > group_budget_inr);
  const family = t.group_type === "family";
  for (const x of inBudget) {
    const cost = 1 - x.breakdown.total_inr / group_budget_inr;
    const comfort = ((x.flight.stops_each_way === 0 ? 1 : 0) + (x.hotel.quiet ? 1 : 0)) / 2;
    x.score = family ? 0.5 * cost + 0.5 * comfort : 0.9 * cost + 0.1 * comfort;
  }
  inBudget.sort((a, b) => b.score - a.score || a.breakdown.total_inr - b.breakdown.total_inr || a.option_id.localeCompare(b.option_id));

  let reason: string | null = null;
  if (!flights.length) reason = p.max_stops === 0 ? "No direct synthetic flights match this route and dates." : "No synthetic flights match this route and dates.";
  else if (!stays.length) {
    const req = [t.diet !== "none" && `${t.diet}-tagged`, p.quiet_required && "quiet", p.step_free_required && "step-free", p.refundable_required && "refundable"].filter(Boolean).join(", ");
    reason = `No synthetic stay in ${d.city} meets your requirements${req ? ` (${req})` : ""} for ${R} room${R > 1 ? "s" : ""}.`;
  } else if (!inBudget.length) reason = `Every matching combination is above your group budget of ₹${group_budget_inr.toLocaleString("en-IN")}.`;

  const cheapest = excluded.length ? Math.min(...excluded.map((x) => x.breakdown.total_inr)) : null;
  return {
    status: inBudget.length ? "ok" : "no_match",
    group_budget_inr,
    options: inBudget.slice(0, 3),
    eligible_in_budget: inBudget.length,
    filters: { origin_id: o.origin_id, destination_id: d.destination_id, nights: N, travellers: P, rooms: R, diet: t.diet, ...p },
    diagnostics: { flights_found: flights.length, stays_found: stays.length, combinations: all.length, cheapest_excluded_total: inBudget.length ? null : cheapest, reason },
  };
}

export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function encodeTrip(t: TripInputs): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(t))));
}
export function decodeTrip(s: string): TripInputs | null {
  try { return { ...emptyTrip(), ...JSON.parse(decodeURIComponent(escape(atob(s)))) }; } catch { return null; }
}
