"use client";

import { useEffect, useState } from "react";
import { gate, VERDICT_LABELS, EXPLORER, GATE_ADDRESS } from "@/lib/contract";

interface Row {
  addressHash: string;
  verdict: number;
  timestamp: number;
  fdcVerified: boolean;
  tx: string;
}

const BADGE: Record<number, string> = {
  1: "text-clear",
  2: "text-review",
  3: "text-blocked",
};

export default function Dashboard() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const g = gate();
        const events = await g.queryFilter(g.filters.Screened(), -50000);
        const parsed = events
          .map((e: any) => ({
            addressHash: e.args[0] as string,
            verdict: Number(e.args[1]),
            timestamp: Number(e.args[2]),
            fdcVerified: Boolean(e.args[4]),
            tx: e.transactionHash,
          }))
          .reverse();
        setRows(parsed);
      } catch (e: any) {
        setError(e.message ?? String(e));
      }
    })();
  }, []);

  const allowed = rows?.filter((r) => r.verdict === 1).length ?? 0;
  const blocked = rows?.filter((r) => r.verdict === 3).length ?? 0;
  const fdc = rows?.filter((r) => r.fdcVerified).length ?? 0;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Compliance dashboard</h1>
      <p className="text-sm text-slate-400 mb-8">
        Live on-chain screening log — read directly from the gate contract on Coston2.
      </p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="card p-5">
          <p className="text-3xl font-bold text-clear">{allowed}</p>
          <p className="text-xs text-slate-400 mt-1">cleared</p>
        </div>
        <div className="card p-5">
          <p className="text-3xl font-bold text-blocked">{blocked}</p>
          <p className="text-xs text-slate-400 mt-1">blocked</p>
        </div>
        <div className="card p-5">
          <p className="text-3xl font-bold">{fdc}</p>
          <p className="text-xs text-slate-400 mt-1">FDC-verified</p>
        </div>
      </div>

      {error && <div className="card p-5 border-blocked/40 text-blocked text-sm">{error}</div>}
      {!rows && !error && <p className="text-slate-500 text-sm">Loading on-chain events…</p>}

      {rows && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-edge">
                <th className="p-4">ADDRESS HASH</th>
                <th className="p-4">VERDICT</th>
                <th className="p-4">PROOF</th>
                <th className="p-4">TIME</th>
                <th className="p-4">TX</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-edge/50">
                  <td className="p-4 text-slate-400">{r.addressHash.slice(0, 18)}…</td>
                  <td className={`p-4 font-bold ${BADGE[r.verdict] ?? ""}`}>
                    {VERDICT_LABELS[r.verdict]}
                  </td>
                  <td className="p-4">
                    {r.fdcVerified ? (
                      <span className="text-clear">FDC ✓</span>
                    ) : (
                      <span className="text-slate-500">attestor</span>
                    )}
                  </td>
                  <td className="p-4 text-slate-400">
                    {new Date(r.timestamp * 1000).toLocaleString()}
                  </td>
                  <td className="p-4">
                    <a
                      className="underline text-slate-400 hover:text-slate-200"
                      target="_blank"
                      href={`${EXPLORER}/tx/${r.tx}`}
                    >
                      {r.tx.slice(0, 12)}… ↗
                    </a>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="p-4 text-slate-500" colSpan={5}>
                    No screenings yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-500 mt-4 font-mono">
        contract:{" "}
        <a className="underline" target="_blank" href={`${EXPLORER}/address/${GATE_ADDRESS}`}>
          {GATE_ADDRESS} ↗
        </a>
      </p>
    </div>
  );
}
