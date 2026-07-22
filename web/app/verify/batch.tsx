"use client";

import { useState } from "react";
import { Check, AlertTriangle, XCircle, Loader } from "@/components/icons";

interface BatchRow {
  address: string;
  verdict?: number;
  error?: string;
}

const BADGE: Record<number, { cls: string; label: string; icon: React.ReactNode }> = {
  1: { cls: "text-clear bg-clear/10 border-clear/30", label: "CLEAR", icon: <Check className="w-3.5 h-3.5" /> },
  2: { cls: "text-review bg-review/10 border-review/30", label: "REVIEW", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  3: { cls: "text-blocked bg-blocked/10 border-blocked/30", label: "BLOCKED", icon: <XCircle className="w-3.5 h-3.5" /> },
};

export function BatchScreen() {
  const [input, setInput] = useState("");
  const [rows, setRows] = useState<BatchRow[] | null>(null);
  const [running, setRunning] = useState(false);

  async function run() {
    const addresses = Array.from(
      new Set(
        input
          .split(/[\s,;]+/)
          .map((a) => a.trim())
          .filter((a) => a.length > 10)
      )
    ).slice(0, 50); // sane cap
    if (addresses.length === 0) return;

    setRunning(true);
    setRows(addresses.map((address) => ({ address })));

    await Promise.all(
      addresses.map(async (address, i) => {
        try {
          const res = await fetch("/screen", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ xrpl_address: address }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          setRows((prev) =>
            prev!.map((r, j) => (j === i ? { ...r, verdict: data.verdict } : r))
          );
        } catch (e: any) {
          setRows((prev) =>
            prev!.map((r, j) => (j === i ? { ...r, error: e.message } : r))
          );
        }
      })
    );
    setRunning(false);
  }

  return (
    <div className="card p-7 mt-5">
      <div className="flex items-center justify-between mb-3">
        <label htmlFor="batch" className="text-xs text-mutedfg font-mono tracking-widest">
          BATCH SCREENING
        </label>
        <span className="text-xs text-mutedfg">up to 50 addresses</span>
      </div>
      <textarea
        id="batch"
        className="input !font-mono min-h-[110px] resize-y"
        placeholder={"Paste multiple XRPL addresses — one per line, or separated by spaces/commas\nr...\nr...\nr..."}
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      <div className="flex items-center gap-4 mt-4">
        <button className="btn !py-2 !min-h-[40px] text-sm" onClick={run} disabled={running || !input.trim()}>
          {running ? <Loader className="w-4 h-4" /> : null}
          {running ? "Screening…" : "Screen all"}
        </button>
        {rows && !running && (
          <span className="text-xs text-mutedfg font-mono">
            {rows.filter((r) => r.verdict === 1).length} clear ·{" "}
            {rows.filter((r) => r.verdict === 3).length} blocked ·{" "}
            {rows.filter((r) => r.error).length} errors
          </span>
        )}
      </div>

      {rows && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-xs font-mono min-w-[480px]">
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-edge/50 last:border-0">
                  <td className="py-2.5 pr-4 text-mutedfg break-all">{r.address}</td>
                  <td className="py-2.5 text-right">
                    {r.error ? (
                      <span className="text-blocked">{r.error}</span>
                    ) : r.verdict === undefined ? (
                      <Loader className="w-3.5 h-3.5 inline-block" />
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1.5 border rounded-md px-2 py-0.5 font-bold ${BADGE[r.verdict]?.cls ?? ""}`}
                      >
                        {BADGE[r.verdict]?.icon}
                        {BADGE[r.verdict]?.label}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
