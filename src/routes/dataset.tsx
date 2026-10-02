import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SyntheticNotice } from "@/components/trip/SyntheticNotice";
import { getCatalog } from "@/lib/catalog";

export const Route = createFileRoute("/dataset")({
  head: () => ({
    meta: [
      { title: "Synthetic dataset reference — Trip Assistant demo" },
      { name: "description", content: "All 20 destinations, 25 origins, 960 flights and 60 stays used by the synthetic trip demo." },
      { property: "og:title", content: "Synthetic dataset reference" },
      { property: "og:description", content: "Fictional inventory only. No private conversations." },
    ],
  }),
  component: Dataset,
});

const TABLES = ["destinations", "origins", "flights", "hotels"] as const;

function Dataset() {
  const [tab, setTab] = useState<(typeof TABLES)[number]>("destinations");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const rows = getCatalog().raw[tab].filter((r) => !q || Object.values(r).join(" ").toLowerCase().includes(q.toLowerCase()));
  const cols = Object.keys(getCatalog().raw[tab][0] ?? {});
  const view = rows.slice(page * 50, page * 50 + 50);
  return (
    <div>
      <SyntheticNotice />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-3xl">Synthetic dataset</h1>
        <p className="mt-1 text-sm text-muted-foreground">Version 1.0. Fictional inventory only — never private conversations.</p>
        <div className="mt-4 flex flex-wrap gap-2" role="tablist">
          {TABLES.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setPage(0); }}
              className={`chip min-h-10 px-4 ${tab === t ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              {t} ({getCatalog().raw[t].length})
            </button>
          ))}
          <input aria-label="Filter rows" className="field max-w-xs" placeholder="Filter…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        </div>
        <div className="panel mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead><tr>{cols.map((c) => <th key={c} className="border-b p-2">{c}</th>)}</tr></thead>
            <tbody>{view.map((r, i) => <tr key={i} className="border-b">{cols.map((c) => <td key={c} className="p-2">{r[c]}</td>)}</tr>)}</tbody>
          </table>
          {!view.length && <p className="p-4 text-sm">No rows match.</p>}
        </div>
        <div className="mt-3 flex items-center gap-3 text-sm">
          <button className="chip bg-muted min-h-10 px-4" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
          <span>{rows.length} rows · page {page + 1}</span>
          <button className="chip bg-muted min-h-10 px-4" disabled={(page + 1) * 50 >= rows.length} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </main>
    </div>
  );
}
