"use client";

import { useState } from "react";
import { gate, addressHash, VERDICT_LABELS, EXPLORER, GATE_ADDRESS } from "@/lib/contract";
import { Check, AlertTriangle, XCircle, Lock, Loader, ExternalLink } from "@/components/icons";

type Step = "idle" | "screening" | "onchain" | "done" | "error";

interface ScreenResult {
  verdict: number;
  verdict_label: string;
  matched_list?: string | null;
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
  {
    ring: string;
    text: string;
    bg: string;
    label: string;
    headline: string;
    icon: React.ReactNode;
    note: string;
  }
> = {
  1: {
    ring: "!border-clear/50",
    text: "text-clear",
    bg: "bg-clear/10",
    label: "CLEAR",
    headline: "Address authorized",
    icon: <Check className="w-8 h-8" />,
    note: "This address is not on the OFAC SDN sanctions list. The FXRP mint would be authorized (verdict valid 24h).",
  },
  2: {
    ring: "!border-review/50",
    text: "text-review",
    bg: "bg-review/10",
    label: "REVIEW",
    headline: "Held for review",
    icon: <AlertTriangle className="w-8 h-8" />,
    note: "The screening could not complete with certainty. Fail-closed policy: the mint stays blocked until a compliance officer reviews it.",
  },
  3: {
    ring: "!border-blocked/50",
    text: "text-blocked",
    bg: "bg-blocked/10",
    label: "BLOCKED",
    headline: "Mint denied",
    icon: <XCircle className="w-8 h-8" />,
    note: "This address appears on the U.S. Treasury OFAC SDN sanctions list — public information. The FXRP mint is denied and a sealed audit proof is kept.",
  },
};

const SAMPLES = [
  { label: "clean address", value: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh" },
  { label: "OFAC-sanctioned", value: "rnXyVQzgxZe7TR1EPzTkGj2jxH4LMJYh66" },
  { label: "FBI Lazarus wallet", value: "bc1qqvpjgaurtnhc8smkmdtwhx9c8207m0prsyxyjx" },
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
      <p className="text-mutedfg mb-8">
        Screen a wallet address against real sanctions &amp; threat lists — confidentially.
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
        <div className={`card mt-5 overflow-hidden border-2 ${s.ring}`} role="status">
          {/* Verdict header */}
          <div className={`flex items-center gap-5 p-7 ${s.bg}`}>
            <span className={s.text}>{s.icon}</span>
            <div>
              <p className={`text-2xl font-bold ${s.text}`}>{s.headline}</p>
              <p className="font-mono text-xs text-mutedfg mt-1">
                verdict: {s.label}
                {result.matched_list && ` · matched: ${result.matched_list}`}
                {verifierSource &&
                  ` · served by ${verifierSource === "tee" ? "TDX enclave" : "standby node"}`}
              </p>
            </div>
          </div>

          <div className="p-7">
            {/* The screened address, in full */}
            <p className="text-xs text-mutedfg font-mono tracking-widest mb-2">
              SCREENED ADDRESS
            </p>
            <p className="font-mono text-sm text-fg break-all bg-base border border-edge rounded-xl px-4 py-3">
              {addr.trim()}
            </p>

            <p className="text-sm text-mutedfg leading-relaxed mt-5">{s.note}</p>
            {result.verdict === 3 && (
              <a
                className="link text-xs font-mono text-mutedfg inline-flex items-center gap-1.5 mt-2"
                href="/sanctions"
              >
                view the monitored threat lists →
              </a>
            )}

            {/* Proof trail */}
            <dl className="mt-6 text-xs font-mono text-mutedfg space-y-2 border-t border-edge pt-5">
              <div className="flex gap-3">
                <dt className="w-32 shrink-0">evidence (sealed)</dt>
                <dd className="text-fg break-all">{result.evidence_hash.slice(0, 34)}…</dd>
              </div>
              {onchain && onchain.verdict !== 0 && (
                <div className="flex gap-3">
                  <dt className="w-32 shrink-0">on-chain record</dt>
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
                <dt className="w-32 shrink-0">gate contract</dt>
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

            {/* Next steps (error recovery / clear paths) */}
            <div className="flex flex-wrap gap-3 mt-6">
              <button
                className="btn-ghost !py-2 !min-h-[40px] text-sm"
                onClick={() => {
                  setAddr("");
                  setStep("idle");
                  setResult(null);
                  setOnchain(null);
                }}
              >
                Screen another address
              </button>
              <a href="/proof" className="btn-ghost !py-2 !min-h-[40px] text-sm">
                How is this proven?
              </a>
              <a href="/dashboard" className="btn-ghost !py-2 !min-h-[40px] text-sm">
                View compliance log
              </a>
            </div>
          </div>
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
