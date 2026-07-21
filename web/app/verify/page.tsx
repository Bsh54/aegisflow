"use client";

import { useState } from "react";
import { gate, addressHash, VERDICT_LABELS, EXPLORER, GATE_ADDRESS } from "@/lib/contract";

type Step = "idle" | "screening" | "onchain" | "done" | "error";

interface ScreenResult {
  verdict: number;
  verdict_label: string;
  evidence_hash: string;
  source: string;
}

interface OnChain {
  verdict: number;
  fdcVerified: boolean;
  timestamp: number;
}

const STYLE: Record<number, { badge: string; label: string; note: string }> = {
  1: {
    badge: "bg-clear/15 text-clear border-clear/40",
    label: "✅ CLEAR",
    note: "Not sanctioned — FXRP mint would be authorized.",
  },
  2: {
    badge: "bg-review/15 text-review border-review/40",
    label: "⚠️ REVIEW",
    note: "Uncertain result — held for manual review (fail-closed).",
  },
  3: {
    badge: "bg-blocked/15 text-blocked border-blocked/40",
    label: "⛔ BLOCKED",
    note: "OFAC SDN match — FXRP mint denied.",
  },
};

const SAMPLES = [
  { label: "clean address", value: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh" },
  { label: "OFAC-sanctioned", value: "rnXyVQzgxZe7TR1EPzTkGj2jxH4LMJYh66" },
];

export default function Verify() {
  const [addr, setAddr] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [result, setResult] = useState<ScreenResult | null>(null);
  const [onchain, setOnchain] = useState<OnChain | null>(null);
  const [error, setError] = useState("");

  async function run() {
    setStep("screening");
    setResult(null);
    setOnchain(null);
    setError("");
    try {
      const res = await fetch("/screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xrpl_address: addr.trim() }),
      });
      if (!res.ok) throw new Error(`verifier HTTP ${res.status}`);
      const data: ScreenResult = await res.json();
      setResult(data);

      setStep("onchain");
      try {
        const [v, ts, , fdcVerified] = await gate().getScreening(addressHash(addr.trim()));
        setOnchain({ verdict: Number(v), fdcVerified, timestamp: Number(ts) });
      } catch {
        /* on-chain record may not exist yet — screening result still stands */
      }
      setStep("done");
    } catch (e: any) {
      setError(e.message ?? String(e));
      setStep("error");
    }
  }

  const s = result ? STYLE[result.verdict] : undefined;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Compliance verification</h1>
      <p className="text-sm text-slate-400 mb-8">
        Screen an XRPL address against the official OFAC sanctions list —
        confidentially.
      </p>

      <div className="card p-6">
        <label className="text-xs text-slate-400 font-mono">XRPL ADDRESS</label>
        <div className="flex gap-3 mt-2">
          <input
            className="input"
            placeholder="r..."
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addr && run()}
          />
          <button className="btn" onClick={run} disabled={!addr || step === "screening" || step === "onchain"}>
            Verify
          </button>
        </div>
        <div className="flex gap-3 mt-3 text-xs text-slate-500">
          try:
          {SAMPLES.map((sample) => (
            <button
              key={sample.value}
              className="underline hover:text-slate-300 transition"
              onClick={() => setAddr(sample.value)}
            >
              {sample.label}
            </button>
          ))}
        </div>
      </div>

      {step !== "idle" && (
        <div className="card p-6 mt-5 font-mono text-sm space-y-2">
          <p className={step === "screening" ? "text-white" : "text-slate-500"}>
            {step === "screening" ? "◌" : "✔"} 🔒 Confidential screening (OFAC SDN)…
          </p>
          <p className={step === "onchain" ? "text-white" : step === "done" ? "text-slate-500" : "text-slate-700"}>
            {step === "onchain" ? "◌" : step === "done" ? "✔" : "·"} ⛓️ Reading gate contract on Coston2…
          </p>
        </div>
      )}

      {step === "error" && (
        <div className="card p-6 mt-5 border-blocked/40 text-blocked text-sm">{error}</div>
      )}

      {result && s && step === "done" && (
        <div className="card p-6 mt-5">
          <div className={`inline-block border rounded-lg px-4 py-2 font-bold ${s.badge}`}>
            {s.label}
          </div>
          <p className="text-sm text-slate-300 mt-3">{s.note}</p>
          <div className="mt-5 text-xs font-mono text-slate-500 space-y-1">
            <p>source: {result.source}</p>
            <p>evidence (sealed): {result.evidence_hash.slice(0, 34)}…</p>
            {onchain && onchain.verdict !== 0 && (
              <p>
                on-chain: {VERDICT_LABELS[onchain.verdict]}{" "}
                {onchain.fdcVerified ? (
                  <span className="text-clear">· FDC-verified ✓</span>
                ) : (
                  "· attestor"
                )}
              </p>
            )}
            <p>
              gate:{" "}
              <a
                className="underline hover:text-slate-300"
                target="_blank"
                href={`${EXPLORER}/address/${GATE_ADDRESS}`}
              >
                {GATE_ADDRESS.slice(0, 10)}… ↗
              </a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
