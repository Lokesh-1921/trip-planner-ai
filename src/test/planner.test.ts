import { describe, it, expect } from "vitest";
import { getCatalog } from "@/lib/catalog";
import { retrieve, emptyTrip, validateTrip, type TripInputs } from "@/lib/planner";

const base = (): TripInputs => ({
  ...emptyTrip(), origin: "Mumbai", destination: "Goa", start_date: "2026-11-10", end_date: "2026-11-13",
  budget_inr: 25000, budget_basis: "total", adults: 2, group_type: "friends", diet: "vegetarian", personalisation_confirmed: true,
});

describe("catalog", () => {
  it("preserves every row", () => {
    const c = getCatalog();
    expect([c.destinations.length, c.origins.length, c.flights.length, c.hotels.length]).toEqual([20, 25, 960, 60]);
    expect(new Set(c.flights.map((f) => f.flight_id)).size).toBe(960);
  });
});

describe("worked example", () => {
  it("direct F0101D + H01B totals 20900", () => {
    const r = retrieve({ ...base(), preferences: { ...base().preferences, max_stops: 0 } });
    expect(r.status).toBe("ok");
    if (r.status === "invalid") return;
    const o = r.options.find((x) => x.option_id === "O-F0101D-H01B")!;
    expect(o.breakdown).toMatchObject({ flights_inr: 9000, stay_inr: 4800, meals_inr: 4000, transfers_inr: 1200, buffer_inr: 1900, total_inr: 20900 });
    expect(r.options.find((x) => x.option_id === "O-F0101D-H01C")?.breakdown.total_inr).toBe(23210);
  });
  it("one-stop F0101E totals 18920", () => {
    const r = retrieve(base());
    if (r.status === "invalid") throw new Error();
    expect(r.options.find((x) => x.option_id === "O-F0101E-H01B")?.breakdown.total_inr).toBe(18920);
  });
  it("rejects impossible dates and asks budget basis", () => {
    const issues = validateTrip({ ...base(), start_date: "2027-02-30", budget_basis: null });
    expect(issues.some((i) => i.field === "start_date")).toBe(true);
    expect(issues.some((i) => i.field === "budget_basis")).toBe(true);
  });
  it("unrealistic budget is a no-match with cheapest estimate", () => {
    const r = retrieve({ ...base(), budget_inr: 1000 });
    expect(r.status).toBe("no_match");
    if (r.status === "no_match") expect(r.diagnostics.cheapest_excluded_total).toBeGreaterThan(1000);
  });
});
