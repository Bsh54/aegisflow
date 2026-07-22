"use client";

import { useEffect, useState } from "react";
import { VERDICT_LABELS, EXPLORER, GATE_ADDRESS } from "@/lib/contract";
import { ExternalLink, ShieldCheck } from "@/components/icons";

interface Row {
  addressHash: string;
  verdict: number;
  timestamp: number;
  fdcVerified: boolean;
  tx: string;
}

const BADGE: Record<number, string> = {
  1: "text-clear bg-clear/10 border-clear/30",
  2: "text-review bg-review/10 border-review/30",
  3: "text-blocked bg-blocked/10 border-blocked/30",
};

export default function Dashboard() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/screenings", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        setRows(data.rows);
      } catch (e: any) {
        setError(e.message ?? String(e));
      }
    })();
  }, []);

  const stats = [
    { label: "cleared", v: rows?.filter((r) => r.verdict === 1).length, cls: "text-clear" },
    { label: "blocked", v: rows?.filter((r) => r.verdict === 3).length, cls: "text-blocked" },
    { label: "FDC-verified", v: rows?.filter((r) => r.fdcVerified).length, cls: "text-gold" },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Compliance dashboard</h1>
      <p className="text-mutedfg mb-10">
        Live on-chain screening log — read directly from the gate contract on Coston2.
      </p>

      <div className="grid grid-cols-3 gap-5 mb-10">
        {stats.map((s) => (
          <div key={s.label} className="card p-6">
            {s.v === undefined ? (
              <div className="skeleton h-9 w-12 mb-1" />
            ) : (
              <p className={`text-3xl font-bold ${s.cls}`}>{s.v}</p>
            )}
            <p className="text-xs text-mutedfg mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="card p-6 !border-blocked/40 text-blocked text-sm" role="alert">
          {error}
        </div>
      )}

      {!rows && !error && (
        <div className="card p-6 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-10 w-full" />
          ))}
        </div>
      )}

      {rows && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-xs text-mutedfg border-b border-edge">
                <th className="p-4 font-medium tracking-widest">ADDRESS HASH</th>
                <th className="p-4 font-medium tracking-widest">VERDICT</th>
                <th className="p-4 font-medium tracking-widest">PROOF</th>
                <th className="p-4 font-medium tracking-widest">TIME</th>
                <th className="p-4 font-medium tracking-widest">TX</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {rows.map((r, i) => (
                <tr
                  key={i}
                  className="border-b border-edge/50 last:border-0 transition duration-150 hover:bg-surface"
                >
                  <td className="p-4 text-mutedfg">{r.addressHash.slice(0, 18)}…</td>
                  <td className="p-4">
                    <span
                      className={`inline-block border rounded-lg px-2.5 py-1 font-bold ${BADGE[r.verdict] ?? ""}`}
                    >
                      {VERDICT_LABELS[r.verdict]}
                    </span>
                  </td>
                  <td className="p-4">
                    {r.fdcVerified ? (
                      <span className="inline-flex items-center gap-1.5 text-clear">
                        <ShieldCheck className="w-4 h-4" /> FDC
                      </span>
                    ) : (
                      <span className="text-mutedfg">attestor</span>
                    )}
                  </td>
                  <td className="p-4 text-mutedfg whitespace-nowrap">
                    {new Date(r.timestamp * 1000).toLocaleString()}
                  </td>
                  <td className="p-4">
                    <a
                      className="link text-mutedfg inline-flex items-center gap-1"
                      target="_blank"
                      href={`${EXPLORER}/tx/${r.tx}`}
                    >
                      {r.tx.slice(0, 12)}…
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="p-4 text-mutedfg" colSpan={5}>
                    No screenings yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-mutedfg mt-5 font-mono">
        contract:{" "}
        <a className="link" target="_blank" href={`${EXPLORER}/address/${GATE_ADDRESS}`}>
          {GATE_ADDRESS}
        </a>
      </p>
    </div>
  );
}
