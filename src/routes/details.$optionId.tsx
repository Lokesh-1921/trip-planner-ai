import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { SyntheticNotice } from "@/components/trip/SyntheticNotice";
import { decodeTrip, retrieve, inr } from "@/lib/planner";

export const Route = createFileRoute("/details/$optionId")({
  validateSearch: (s) => z.object({ t: z.string().default("") }).parse(s),
  head: () => ({ meta: [{ title: "Option details — Synthetic trip demo" }, { name: "robots", content: "noindex" }] }),
  component: Details,
});

function Details() {
  const { optionId } = Route.useParams();
  const { t } = Route.useSearch();
  const trip = decodeTrip(t);
  const r = trip ? retrieve(trip) : null;
  const o = r && r.status !== "invalid" ? r.options.find((x) => x.option_id === optionId) : undefined;
  return (
    <div>
      <SyntheticNotice />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-3xl">Option details</h1>
        {!o ? (
          <p className="mt-4 text-muted-foreground">This option is no longer current for the trip. Go back and re-check options. <Link to="/" className="text-primary underline">Planner</Link></p>
        ) : (
          <div className="panel mt-6 space-y-2 p-6 text-sm">
            <p><code>{o.option_id}</code> · Offline reference view, not live and not saved.</p>
            <p><strong>{o.flight.label}</strong> ({o.flight.flight_id}) · {o.flight.stops_each_way} stop(s) · cancellation {inr(o.flight.cancellation_inr_per_person)}/person</p>
            <p><strong>{o.hotel.label}</strong> ({o.hotel.hotel_id}) · {o.hotel.cancellation_terms}</p>
            <p className="text-lg font-semibold">Total {inr(o.breakdown.total_inr)}</p>
            <p className="text-muted-foreground">Diet tags aren't allergen guarantees; step-free isn't an accessibility certification. No booking is made.</p>
          </div>
        )}
      </main>
    </div>
  );
}
