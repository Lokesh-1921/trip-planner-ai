import { useRef, useState } from "react";
import { Send, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ChatItem =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string; question?: string | null; patch?: Record<string, unknown> }
  | { kind: "notice"; text: string; tone: "info" | "error"; retry?: boolean };

type Props = {
  items: ChatItem[];
  busy: boolean;
  aiReady: boolean | null;
  onSend: (text: string) => void;
  onApplyPatch: (patch: Record<string, unknown>) => void;
  onRetry: () => void;
};

export function ChatPanel({ items, busy, aiReady, onSend, onApplyPatch, onRetry }: Props) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const submit = () => {
    const v = text.trim();
    if (!v || busy) return;
    onSend(v);
    setText("");
    setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 50);
  };
  return (
    <section aria-labelledby="chat-h" className="panel flex min-h-[26rem] flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 id="chat-h" className="text-xl">Trip assistant</h2>
        {aiReady === false && <span className="chip bg-warning-soft text-warning"><AlertTriangle className="size-3" aria-hidden />AI connection not configured</span>}
      </div>
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4" aria-live="polite" aria-busy={busy}>
        {items.length === 0 && (
          <div className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Tell me about your short trip.</p>
            <p className="mt-1">For example: “Mumbai to Goa, 10–13 Nov, two friends, vegetarian, ₹25,000 total, direct flights.” I'll ask about anything missing, and you confirm every detail in the trip summary.</p>
            <p className="mt-2 text-xs">Please don't share ID numbers, card details or health information.</p>
          </div>
        )}
        {items.map((m, i) => {
          if (m.kind === "user") return <p key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">{m.text}</p>;
          if (m.kind === "notice")
            return (
              <div key={i} role={m.tone === "error" ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-sm ${m.tone === "error" ? "bg-destructive/10 text-destructive" : "bg-warning-soft text-foreground"}`}>
                {m.text}
                {m.retry && <Button size="sm" variant="outline" className="ml-2" onClick={onRetry}>Retry</Button>}
              </div>
            );
          return (
            <div key={i} className="max-w-[90%] rounded-2xl rounded-bl-sm bg-secondary px-4 py-3 text-sm text-secondary-foreground">
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.question && <p className="mt-2 font-medium">{m.question}</p>}
              {m.patch && Object.keys(m.patch).length > 0 && (
                <Button size="sm" variant="coral" className="mt-2" onClick={() => onApplyPatch(m.patch!)}>Review suggested changes in summary</Button>
              )}
            </div>
          );
        })}
        {busy && <p className="text-sm text-muted-foreground">Thinking…</p>}
      </div>
      <form className="flex gap-2 border-t border-border p-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <label htmlFor="chat-input" className="sr-only">Message the trip assistant</label>
        <textarea id="chat-input" rows={1} maxLength={1000} className="field resize-none" placeholder="Describe your trip…" value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }} />
        <Button type="submit" size="icon" aria-label="Send" disabled={busy || !text.trim()}><Send aria-hidden /></Button>
      </form>
    </section>
  );
}
