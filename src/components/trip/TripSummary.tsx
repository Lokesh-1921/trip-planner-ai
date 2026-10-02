import { getCatalog } from "@/lib/catalog";
import { HORIZON_END, HORIZON_START, nightsBetween, type Issue, type TripInputs } from "@/lib/planner";
import { Button } from "@/components/ui/button";
import { useMemo, useState, useEffect } from "react";

type Props = {
  trip: TripInputs;
  onChange: (t: TripInputs) => void;
  issues: Issue[];
  showIssues: boolean;
  confirmed: boolean;
  onConfirm: () => void;
  busy: boolean;
};

const Err = ({ issues, field, show }: { issues: Issue[]; field: string; show: boolean }) => {
  const m = issues.find((i) => i.field === field);
  if (!show || !m) return null;
  return <p id={`err-${field}`} className="mt-1 text-xs text-destructive">{m.message}</p>;
};

export function TripSummary({ trip, onChange, issues, showIssues, confirmed, onConfirm, busy }: Props) {
  const cat = getCatalog();
  const set = <K extends keyof TripInputs>(k: K, v: TripInputs[K]) => onChange({ ...trip, [k]: v });
  const setPref = <K extends keyof TripInputs["preferences"]>(k: K, v: TripInputs["preferences"][K]) =>
    onChange({ ...trip, preferences: { ...trip.preferences, [k]: v } });
  const [agesText, setAgesText] = useState(trip.children_ages.join(", "));
  useEffect(() => setAgesText(trip.children_ages.join(", ")), [trip.children_ages]);
  const nights = useMemo(() => nightsBetween(trip.start_date, trip.end_date), [trip.start_date, trip.end_date]);
  const P = trip.adults + trip.children_ages.length;
  const label = "mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground";
  const inv = (f: string) => showIssues && issues.some((i) => i.field === f);

  return (
    <section aria-labelledby="summary-h" className="panel p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 id="summary-h" className="text-xl">Your trip summary</h2>
        <span className={`chip ${confirmed ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
          {confirmed ? "Confirmed" : "Draft — edit freely"}
        </span>
      </div>

      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={(e) => { e.preventDefault(); onConfirm(); }}
        noValidate
      >
        <div>
          <label className={label} htmlFor="origin">From</label>
          <select id="origin" className="field" value={trip.origin} aria-invalid={inv("origin")} onChange={(e) => set("origin", e.target.value)}>
            <option value="">Choose city</option>
            {cat.origins.map((o) => <option key={o.origin_id} value={o.city}>{o.city}</option>)}
          </select>
          <Err issues={issues} field="origin" show={showIssues} />
        </div>
        <div>
          <label className={label} htmlFor="destination">To</label>
          <select id="destination" className="field" value={trip.destination} aria-invalid={inv("destination")} onChange={(e) => set("destination", e.target.value)}>
            <option value="">Choose destination</option>
            {cat.destinations.map((d) => <option key={d.destination_id} value={d.city}>{d.city}</option>)}
          </select>
          <Err issues={issues} field="destination" show={showIssues} />
        </div>
        <div>
          <label className={label} htmlFor="start">Depart</label>
          <input id="start" type="date" className="field" min={HORIZON_START} max={HORIZON_END} value={trip.start_date} onChange={(e) => set("start_date", e.target.value)} />
          <Err issues={issues} field="start_date" show={showIssues} />
        </div>
        <div>
          <label className={label} htmlFor="end">Return</label>
          <input id="end" type="date" className="field" min={HORIZON_START} max={HORIZON_END} value={trip.end_date} onChange={(e) => set("end_date", e.target.value)} />
          <Err issues={issues} field="end_date" show={showIssues} />
        </div>
        <p className="col-span-2 -mt-1 text-xs text-muted-foreground">
          {nights && nights > 0 ? `${nights} night${nights > 1 ? "s" : ""} · ` : ""}2–4 nights between 1 Nov 2026 and 31 Mar 2027.
        </p>

        <div>
          <label className={label} htmlFor="budget">Budget (₹)</label>
          <input id="budget" type="number" inputMode="numeric" min={1} className="field" value={trip.budget_inr ?? ""}
            onChange={(e) => set("budget_inr", e.target.value ? Math.round(Number(e.target.value)) : null)} />
          <Err issues={issues} field="budget_inr" show={showIssues} />
        </div>
        <fieldset>
          <legend className={label}>Budget is</legend>
          <div className="flex gap-2" role="radiogroup">
            {(["total", "per_person"] as const).map((b) => (
              <label key={b} className={`field flex cursor-pointer items-center justify-center text-sm ${trip.budget_basis === b ? "border-primary bg-accent font-semibold" : ""}`}>
                <input type="radio" name="basis" className="sr-only" checked={trip.budget_basis === b} onChange={() => set("budget_basis", b)} />
                {b === "total" ? "Group total" : "Per person"}
              </label>
            ))}
          </div>
          <Err issues={issues} field="budget_basis" show={showIssues} />
        </fieldset>

        <div>
          <label className={label} htmlFor="adults">Adults</label>
          <input id="adults" type="number" min={1} max={6} className="field" value={trip.adults} onChange={(e) => set("adults", Math.max(0, Math.round(Number(e.target.value) || 0)))} />
          <Err issues={issues} field="adults" show={showIssues} />
        </div>
        <div>
          <label className={label} htmlFor="kids">Children's ages</label>
          <input id="kids" className="field" placeholder="e.g. 8, 12" value={agesText}
            onChange={(e) => setAgesText(e.target.value)}
            onBlur={() => set("children_ages", agesText.split(/[,\s]+/).filter(Boolean).map(Number).filter((n) => !Number.isNaN(n)))} />
          <Err issues={issues} field="children_ages" show={showIssues} />
        </div>
        <Err issues={issues} field="party" show={showIssues} />

        <div>
          <label className={label} htmlFor="group">Group</label>
          <select id="group" className="field" value={trip.group_type ?? ""} onChange={(e) => set("group_type", (e.target.value || null) as TripInputs["group_type"])}>
            <option value="">Choose</option>
            <option value="solo">Solo</option><option value="couple">Couple</option>
            <option value="friends">Friends</option><option value="family">Family</option>
          </select>
          <Err issues={issues} field="group_type" show={showIssues} />
        </div>
        <div>
          <label className={label} htmlFor="diet">Diet</label>
          <select id="diet" className="field" value={trip.diet ?? ""} onChange={(e) => set("diet", (e.target.value || null) as TripInputs["diet"])}>
            <option value="">Choose</option>
            <option value="none">None</option><option value="vegetarian">Vegetarian</option>
            <option value="vegan">Vegan</option><option value="jain">Jain</option>
          </select>
          <Err issues={issues} field="diet" show={showIssues} />
        </div>

        <fieldset className="col-span-2 rounded-lg border border-border p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Personalisation (hard filters)</legend>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {([["quiet_required", "Quiet stay"], ["step_free_required", "Step-free stay"], ["refundable_required", "Refundable stay"]] as const).map(([k, l]) => (
              <label key={k} className="flex min-h-11 items-center gap-2">
                <input type="checkbox" className="size-4 accent-primary" checked={trip.preferences[k]} onChange={(e) => onChange({ ...trip, personalisation_confirmed: true, preferences: { ...trip.preferences, [k]: e.target.checked } })} />
                {l}
              </label>
            ))}
            <label className="flex min-h-11 items-center gap-2">
              <span className="shrink-0">Max stops</span>
              <select className="field" aria-label="Maximum stops each way" value={trip.preferences.max_stops ?? "any"}
                onChange={(e) => setPref("max_stops", e.target.value === "any" ? null : (Number(e.target.value) as 0 | 1))}>
                <option value="any">Any</option><option value="0">Direct only</option><option value="1">Up to 1</option>
              </select>
            </label>
          </div>
          <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-primary" checked={trip.personalisation_confirmed} onChange={(e) => set("personalisation_confirmed", e.target.checked)} />
            I've reviewed these (none is fine)
          </label>
          <Err issues={issues} field="personalisation_confirmed" show={showIssues} />
        </fieldset>

        <p className="col-span-2 text-xs text-muted-foreground">
          {P} traveller{P === 1 ? "" : "s"} · {Math.ceil(P / 2)} room{Math.ceil(P / 2) === 1 ? "" : "s"} of two. Children 2–17 are priced as full passengers in this demo.
        </p>
        <Button type="submit" variant="coral" size="lg" className="col-span-2" disabled={busy}>
          {busy ? "Comparing…" : confirmed ? "Re-check options" : "Confirm trip & compare"}
        </Button>
      </form>
    </section>
  );
}
