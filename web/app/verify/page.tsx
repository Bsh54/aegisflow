"use client";

import { useState } from "react";
import { gate, addressHash, VERDICT_LABELS, EXPLORER, GATE_ADDRESS } from "@/lib/contract";
import { Check, AlertTriangle, XCircle, Lock, Loader, ExternalLink } from "@/components/icons";

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

const STYLE: Record<
  number,
  { badge: string; label: string; icon: React.ReactNode; note: string }
> = {
  1: {
    badge: "bg-clear/10 text-clear border-clear/40",
    label: "CLEAR",
    icon: <Check className="w-5 h-5" />,
    note: "Not sanctioned — FXRP mint would be authorized.",
  },
  2: {
    badge: "bg-review/10 text-review border-review/40",
    label: "REVIEW",
    icon: <AlertTriangle className="w-5 h-5" />,
    note: "Uncertain result — held for manual review (fail-closed).",
  },
  3: {
    badge: "bg-blocked/10 text-blocked border-blocked/40",
    label: "BLOCKED",
    icon: <XCircle className="w-5 h-5" />,
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
  const [verifierSource, setVerifierSource] = useState("");
  const [error, setError] = useState("");

  const busy = step === "screening" || step === "onchain";

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
      if (!res.ok) throw new Error(`Verifier unavailable (HTTP ${res.status})`);
      setVerifierSource(res.headers.get("x-aegis-verifier") ?? "");
      const data: ScreenResult = await res.json();
      setResult(data);

      setStep("onchain");
      try {
        const [v, ts, , fdcVerified] = await gate().getScreening(addressHash(addr.trim()));
        setOnchain({ verdict: Number(v), fdcVerified, timestamp: Number(ts) });
      } catch {
        /* no on-chain record yet — screening result still stands */
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
      <h1 className="text-3xl font-bold mb-2">Compliance verification</h1>
      <p className="text-mutedfg mb-10">
        Screen an XRPL address against the official OFAC sanctions list — confidentially.
      </p>

      <div className="card p-7">
        <label htmlFor="xrpl" className="text-xs text-mutedfg font-mono tracking-widest">
          XRPL ADDRESS
        </label>
        <div className="flex flex-col sm:flex-row gap-3 mt-3">
          <input
            id="xrpl"
            className="input"
            placeholder="r…"
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addr && !busy && run()}
          />
          <button className="btn shrink-0" onClick={run} disabled={!addr || busy}>
            {busy ? <Loader className="w-4 h-4" /> : null}
            {busy ? "Verifying…" : "Verify"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-4 text-xs text-mutedfg">
          <span>try:</span>
          {SAMPLES.map((sample) => (
            <button
              key={sample.value}
              className="link"
              onClick={() => setAddr(sample.value)}
            >
              {sample.label}
            </button>
          ))}
        </div>
      </div>

      {step !== "idle" && step !== "error" && (
        <div className="card p-7 mt-5 font-mono text-sm space-y-3" aria-live="polite">
          <StepRow
            active={step === "screening"}
            done={step !== "screening"}
            icon={<Lock className="w-4 h-4" />}
            label="Confidential screening (OFAC SDN, sealed in enclave)…"
          />
          <StepRow
            active={step === "onchain"}
            done={step === "done"}
            pending={step === "screening"}
            icon={<ExternalLink className="w-4 h-4" />}
            label="Reading gate contract on Coston2…"
          />
        </div>
      )}

      {step === "error" && (
        <div className="card p-6 mt-5 !border-blocked/40 text-blocked text-sm" role="alert">
          {error}
        </div>
      )}

      {result && s && step === "done" && (
        <div className="card p-7 mt-5">
          <div
            className={`inline-flex items-center gap-2.5 border rounded-xl px-5 py-3 font-bold text-lg ${s.badge}`}
          >
            {s.icon}
            {s.label}
          </div>
          <p className="text-mutedfg mt-4">{s.note}</p>
          <dl className="mt-6 text-xs font-mono text-mutedfg space-y-2">
            <div className="flex gap-3">
              <dt className="w-32 shrink-0">source</dt>
              <dd className="text-fg">
                {result.source}
                {verifierSource && (
                  <span className="ml-2 text-mutedfg">
                    · served by {verifierSource === "tee" ? "TDX enclave" : "standby node"}
                  </span>
                )}
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-32 shrink-0">evidence (sealed)</dt>
              <dd className="text-fg break-all">{result.evidence_hash.slice(0, 34)}…</dd>
            </div>
            {onchain && onchain.verdict !== 0 && (
              <div className="flex gap-3">
                <dt className="w-32 shrink-0">on-chain</dt>
                <dd className="text-fg">
                  {VERDICT_LABELS[onchain.verdict]}
                  {onchain.fdcVerified ? (
                    <span className="text-clear ml-2">FDC-verified ✓</span>
                  ) : (
                    <span className="ml-2">attestor</span>
                  )}
                </dd>
              </div>
            )}
            <div className="flex gap-3">
              <dt className="w-32 shrink-0">gate</dt>
              <dd>
                <a
                  className="link text-fg inline-flex items-center gap-1.5"
                  target="_blank"
                  href={`${EXPLORER}/address/${GATE_ADDRESS}`}
                >
                  {GATE_ADDRESS.slice(0, 10)}…{GATE_ADDRESS.slice(-6)}
                  <ExternalLink />
                </a>
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}

function StepRow({
  active,
  done,
  pending,
  icon,
  label,
}: {
  active?: boolean;
  done?: boolean;
  pending?: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <p
      className={`flex items-center gap-3 ${
        active ? "text-fg" : done ? "text-mutedfg" : "text-mutedfg/40"
      }`}
    >
      {active ? <Loader className="w-4 h-4" /> : done && !pending ? <Check className="w-4 h-4 text-clear" /> : icon}
      {label}
    </p>
  );
}
