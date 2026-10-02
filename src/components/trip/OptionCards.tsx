import { Link } from "@tanstack/react-router";
import { Plane, BedDouble, ExternalLink, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { encodeTrip, inr, type RetrievalResult, type TripInputs, type TripOption } from "@/lib/planner";
import type { AssistantOutput } from "@/lib/assistant.functions";

type Props = {
  result: Exclude<RetrievalResult, { status: "invalid" }>;
  trip: TripInputs;
  explanation: AssistantOutput | null;
  explanationNote: string | null;
  storageReady: boolean;
};

export function OptionCards({ result, trip, explanation, explanationNote, storageReady }: Props) {
  if (result.status === "no_match") {
    const d = result.diagnostics;
    return (
      <div className="panel border-warning/40 bg-warning-soft p-5" role="status">
        <h3 className="text-lg">No option fits these exact requirements</h3>
        <p className="mt-1 text-sm">{d.reason}</p>
        {d.cheapest_excluded_total != null && (
          <p className="mt-2 text-sm">The cheapest matching combination would cost <strong>{inr(d.cheapest_excluded_total)}</strong> — above your budget, so it isn't recommended.</p>
        )}
        <p className="mt-2 text-sm text-muted-foreground">Nothing has been relaxed automatically. You could raise the budget, change dates or remove one requirement in the trip summary.</p>
      </div>
    );
  }
  const t = encodeTrip(trip);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {result.eligible_in_budget} combination{result.eligible_in_budget === 1 ? "" : "s"} fit your group budget of {inr(result.group_budget_inr)}. Showing the top {result.options.length}.
      </p>
      {explanationNote && <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{explanationNote}</p>}
      <ol className="grid gap-4 lg:grid-cols-3">
        {result.options.map((o, i) => (
          <Card key={o.option_id} o={o} rank={i + 1} t={t} ai={explanation?.options.find((x) => x.option_id === o.option_id)} storageReady={storageReady} />
        ))}
      </ol>
    </div>
  );
}

function Card({ o, rank, t, ai, storageReady }: { o: TripOption; rank: number; t: string; ai?: AssistantOutput["options"][number] | undefined; storageReady: boolean }) {
  const b = o.breakdown;
  const line = (l: string, v: number, hint: string) => (
    <div className="flex justify-between gap-2 py-1"><dt className="text-muted-foreground">{l} <span className="text-xs">({hint})</span></dt><dd className="tabular-nums">{inr(v)}</dd></div>
  );
  return (
    <li className="panel flex flex-col p-5 transition-shadow hover:shadow-lift">
      <div className="flex items-start justify-between gap-2">
        <span className="chip bg-primary text-primary-foreground">Option {rank}</span>
        <code className="text-xs text-muted-foreground">{o.option_id}</code>
      </div>
      <p className="mt-3 font-display text-3xl tabular-nums">{inr(b.total_inr)}</p>
      <p className="text-sm text-success">{inr(o.remaining_inr)} left in budget</p>

      <div className="mt-4 space-y-2 text-sm">
        <p className="flex gap-2"><Plane className="mt-0.5 size-4 text-primary" aria-hidden /><span><strong>{o.flight.label}</strong><br />{o.flight.stops_each_way === 0 ? "Direct" : `${o.flight.stops_each_way} stop`} each way · {Math.floor(o.flight.duration_minutes_each_way / 60)}h {o.flight.duration_minutes_each_way % 60}m · {o.flight.baggage_kg} kg</span></p>
        <p className="flex gap-2"><BedDouble className="mt-0.5 size-4 text-primary" aria-hidden /><span><strong>{o.hotel.label}</strong><br />{[o.hotel.quiet && "Quiet", o.hotel.step_free && "Step-free", o.hotel.refundable ? "Refundable" : "Non-refundable"].filter(Boolean).join(" · ")}<br /><span className="text-muted-foreground">Diet tags: {o.hotel.diet_tags.join(", ") || "none"}</span></span></p>
      </div>

      {ai && (
        <div className="mt-3 rounded-lg bg-accent p-3 text-sm">
          <p><strong>Why:</strong> {ai.reason}</p>
          <p className="mt-1"><strong>Trade-off:</strong> {ai.tradeoff}</p>
        </div>
      )}

      <dl className="mt-4 border-t border-border pt-3 text-sm">
        {line("Flights", b.flights_inr, `${b.P} × round trip`)}
        {line("Stay", b.stay_inr, `${b.R} room × ${b.N} nights`)}
        {line("Meals", b.meals_inr, `${b.P} × ${b.N + 1} days`)}
        {line("Transfers", b.transfers_inr, "group allowance")}
        {line("Buffer", b.buffer_inr, "10%, rounded up")}
        <div className="flex justify-between border-t border-border pt-2 font-semibold"><dt>Total</dt><dd className="tabular-nums">{inr(b.total_inr)}</dd></div>
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">Record IDs: <code>{o.flight.flight_id}</code> · <code>{o.hotel.hotel_id}</code> · fictional taxes included</p>

      <div className="mt-auto flex flex-col gap-2 pt-4">
        <Button asChild variant="outline">
          <Link to="/details/$optionId" params={{ optionId: o.option_id }} search={{ t }} target="_blank" rel="noopener">
            Details <ExternalLink aria-hidden /> <span className="sr-only">(opens in new tab)</span>
          </Link>
        </Button>
        <Button variant="default" disabled={!storageReady} aria-describedby={`sel-${o.option_id}`}>
          <CheckCircle2 aria-hidden /> Simulate selection
        </Button>
        {!storageReady && <p id={`sel-${o.option_id}`} className="text-xs text-muted-foreground">Needs private storage, which isn't connected yet. No booking is ever made.</p>}
      </div>
    </li>
  );
}
