import { Link } from "@tanstack/react-router";

export function SyntheticNotice() {
  return (
    <div role="note" aria-label="Synthetic demo notice" className="sticky top-0 z-40 border-b border-coral/30 bg-coral-soft">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 text-sm">
        <p className="text-foreground">
          <strong className="font-semibold">Synthetic demo</strong> — not an official MakeMyTrip service. All fares, stays and terms are fictional. No real booking is made.
        </p>
        <nav className="flex gap-4 font-medium">
          <Link to="/" className="text-primary underline-offset-4 hover:underline">Planner</Link>
          <Link to="/dataset" className="text-primary underline-offset-4 hover:underline">Dataset</Link>
        </nav>
      </div>
    </div>
  );
}

export function BackendStatus({ groq, supabase }: { groq: boolean | null; supabase: boolean | null }) {
  const item = (ok: boolean | null, label: string, missing: string) => (
    <li className="flex items-start gap-2">
      <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${ok ? "bg-success" : ok === null ? "bg-muted-foreground" : "bg-warning"}`} />
      <span>{ok === null ? `${label}: checking…` : ok ? `${label}: connected` : `${label}: ${missing}`}</span>
    </li>
  );
  return (
    <ul className="space-y-1 text-sm text-muted-foreground" aria-live="polite">
      {item(groq, "AI", "AI connection not configured")}
      {item(supabase, "Private storage", "not configured — nothing is saved")}
    </ul>
  );
}
