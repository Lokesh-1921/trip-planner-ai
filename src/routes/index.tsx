import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import hero from "@/assets/hero-trip.jpg";
import { SyntheticNotice, BackendStatus } from "@/components/trip/SyntheticNotice";
import { TripSummary } from "@/components/trip/TripSummary";
import { ChatPanel, type ChatItem } from "@/components/trip/ChatPanel";
import { OptionCards } from "@/components/trip/OptionCards";
import { emptyTrip, retrieve, validateTrip, type RetrievalResult, type TripInputs } from "@/lib/planner";
import { getBackendStatus, runAssistant, type AssistantOutput } from "@/lib/assistant.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MakeMyTrip AI Trip Assistant — Synthetic student demo" },
      { name: "description", content: "Compare a short domestic trip within your budget using fictional flights and stays. Not an official MakeMyTrip service." },
      { property: "og:title", content: "Compare a short trip within your budget" },
      { property: "og:description", content: "Synthetic demo: flight + stay options with a clear cost breakdown." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [status, setStatus] = useState<{ groq: boolean | null; supabase: boolean | null }>({ groq: null, supabase: null });
  const [trip, setTrip] = useState<TripInputs>(emptyTrip);
  const [version, setVersion] = useState(0);
  const [confirmedVersion, setConfirmedVersion] = useState<number | null>(null);
  const [showIssues, setShowIssues] = useState(false);
  const [result, setResult] = useState<RetrievalResult | null>(null);
  const [explanation, setExplanation] = useState<AssistantOutput | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [lastMsg, setLastMsg] = useState("");

  useEffect(() => { getBackendStatus().then(setStatus).catch(() => setStatus({ groq: false, supabase: false })); }, []);
  const issues = useMemo(() => validateTrip(trip), [trip]);

  const change = (t: TripInputs) => { setTrip(t); setVersion((v) => v + 1); setResult(null); setExplanation(null); setConfirmedVersion(null); };

  const confirm = async () => {
    setShowIssues(true);
    if (issues.length) return;
    const r = retrieve(trip);
    setResult(r); setConfirmedVersion(version); setExplanation(null);
    if (r.status !== "ok") return;
    if (!status.groq) { setNote("AI connection not configured — these are offline deterministic calculations from the synthetic data, without AI explanations. Nothing is saved."); return; }
    setBusy(true);
    try {
      const res = await runAssistant({ data: { mode: "explain", trip, trip_version: version, history: [] } });
      if (res.status === "ok") { setExplanation(res.output); setNote(res.save_note); }
      else setNote(res.status === "model_error" ? "The AI explanation couldn't be produced. The numbers below are still exact. Try again shortly." : "AI explanation unavailable.");
    } catch { setNote("AI service error. The numbers below are still exact."); }
    finally { setBusy(false); }
  };

  const send = async (text: string) => {
    setLastMsg(text);
    setChat((c) => [...c, { kind: "user", text }]);
    if (!status.groq) {
      setChat((c) => [...c, { kind: "notice", tone: "info", text: "AI connection not configured — your message wasn't sent to any model. Please fill in the trip summary instead." }]);
      return;
    }
    setBusy(true);
    try {
      const res = await runAssistant({ data: { mode: "extract", message: text, trip, trip_version: version, history: [] } });
      if (res.status === "ok") setChat((c) => [...c, { kind: "assistant", text: res.output.message, question: res.output.question, patch: res.output.input_patch }]);
      else setChat((c) => [...c, { kind: "notice", tone: "error", retry: true, text: "The assistant couldn't reply right now. Your inputs are kept." }]);
    } catch { setChat((c) => [...c, { kind: "notice", tone: "error", retry: true, text: "Connection problem. Your inputs are kept." }]); }
    finally { setBusy(false); }
  };

  const applyPatch = (p: Record<string, unknown>) => change({ ...trip, ...(p as Partial<TripInputs>), preferences: { ...trip.preferences, ...((p.preferences as object) ?? {}) } });

  return (
    <div>
      <SyntheticNotice />
      <header className="relative overflow-hidden">
        <img src={hero} alt="" width={1600} height={912} className="absolute inset-0 h-full w-full object-cover" />
        <div className="hero-scrim absolute inset-0" />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 text-primary-foreground">
          <p className="text-sm font-semibold uppercase tracking-widest opacity-90">MakeMyTrip AI Trip Assistant · student prototype</p>
          <h1 className="mt-3 max-w-2xl text-4xl leading-tight md:text-6xl">Compare a short trip within your budget</h1>
          <p className="mt-4 max-w-xl text-lg opacity-90">One domestic destination, 2–4 nights, up to six travellers — with every rupee explained.</p>
        </div>
      </header>
      <main className="mx-auto -mt-6 max-w-6xl space-y-8 px-4 pb-16">
        <div className="panel relative p-4"><BackendStatus groq={status.groq} supabase={status.supabase} /></div>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChatPanel items={chat} busy={busy} aiReady={status.groq} onSend={send} onApplyPatch={applyPatch} onRetry={() => lastMsg && send(lastMsg)} />
          <TripSummary trip={trip} onChange={change} issues={issues} showIssues={showIssues} confirmed={confirmedVersion === version} onConfirm={confirm} busy={busy} />
        </div>
        <section aria-labelledby="opts-h">
          <h2 id="opts-h" className="mb-3 text-2xl">Your options</h2>
          {!result && <p className="panel p-5 text-sm text-muted-foreground">Confirm your trip summary to see up to three flight + stay options.</p>}
          {result && result.status !== "invalid" && (
            <OptionCards result={result} trip={trip} explanation={explanation} explanationNote={note} storageReady={Boolean(status.supabase)} />
          )}
        </section>
      </main>
    </div>
  );
}
